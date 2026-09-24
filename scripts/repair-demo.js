import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import config, { hydrateConfig } from '../src/bff/config.js';
import { createSearchAdapter } from '../src/bff/adapters/search.js';
import { createFoundryAdapter } from '../src/bff/adapters/foundry.js';
import { listConnections, projectArmId } from '../src/bff/adapters/foundry-connections.js';
import { createPurviewAdapter, toAttributeMap } from '../src/bff/adapters/purview.js';
import { LiveStorage } from '../src/bff/adapters/storage.js';
import { getToken } from '../src/bff/adapters/token.js';

const version = '2026-08-01-preview';
const products = JSON.parse(readFileSync(new URL('../bootstrap/data-products.json', import.meta.url), 'utf8'));
const journey = JSON.parse(readFileSync(new URL('../bootstrap/demo-journey.json', import.meta.url), 'utf8'));
const agentIds = new Map(journey.agents.map((agent) => [agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), agent]));

export function neutralSeedText(text) {
  return typeof text === 'string' ? text
    .replaceAll('not Novo company data', 'not company data')
    .replaceAll('No real Novo sites', 'No real sites')
    .replaceAll('not Novo operational or clinical data', 'not real operational or clinical data')
    .replaceAll('Demo - Novo operations briefing', 'Demo - Operations briefing') : text;
}

export function neutralSeedState(name, state, agents = new Map()) {
  const next = structuredClone(state);
  if (name === 'automations') {
    for (const item of Object.values(next.items)) {
      if (item.name === 'Demo - Novo operations briefing' &&
          item.steps?.length === 5 && item.steps.every((step) => agentIds.has(step.agentId))) {
        item.name = neutralSeedText(item.name);
      }
    }
  } else if (name === 'agents') {
    for (const [id, blueprint] of agentIds) {
      const item = next[id];
      if (item?.name !== blueprint.name || !item._agent?.definition?.builtById) continue;
      item._agent.definition.instructions = neutralSeedText(item._agent.definition.instructions);
      item.desc = neutralSeedText(item.desc);
      if (agents.has(id)) {
        item._agent.foundry = agents.get(id);
        item._agent.version = agents.get(id).version;
      }
    }
  }
  return next;
}

export async function main(args = process.argv.slice(2)) {
  const apply = args.includes('--apply');
  const skipCatalogue = args.includes('--skip-catalogue');
  const containers = args.find((arg) => arg.startsWith('--state-containers='))?.split('=')[1].split(',');
  if (!containers?.length || containers.some((name) => !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name))) {
    throw new Error('Supply explicit --state-containers=name,... for the reviewed web apps.');
  }
  await hydrateConfig();
  if (!config.search.knowledgeModelName || !config.search.knowledgeModelEndpoint || !config.foundry.model) {
    throw new Error('Restore the approved knowledge planning configuration before repair.');
  }
  if (apply && (!config.maintenance || !args.includes('--writers-stopped'))) {
    throw new Error('Apply requires maintenance on every affected app and --writers-stopped after checking other writers.');
  }
  const search = createSearchAdapter(), foundry = createFoundryAdapter(), purview = createPurviewAdapter();
  const storage = new LiveStorage({ storageAccount: config.state.blobAccount, scope: config.state.scope });
  const dataStorage = new LiveStorage(config.data);
  const armToken = await getToken('https://management.azure.com/.default');
  const connections = await listConnections();
  const catalogue = await purview.listDataProducts();
  const knowledge = [];
  for (const product of products) {
    const kbName = `cx-kb-${product.id}`;
    const kb = await search._fetch(`/knowledgebases/${kbName}`, { apiVersion: version });
    const connection = connections.find((item) => {
      const target = item.properties?.target;
      return target && new URL(target, 'https://invalid.local').origin === search.endpoint &&
        new URL(target).pathname === `/knowledgebases/${kbName}/mcp`;
    });
    if (!connection || connection.properties.authType !== 'ProjectManagedIdentity') throw new Error(`Missing approved connection for ${kbName}`);
    const entry = catalogue.find((item) => item.name === product.name || toAttributeMap(item.managedAttributes).cortexDataFolder === product.id);
    if (!entry) throw new Error(`Missing catalogue product ${product.name}`);
    const raw = await purview._fetch(`/datagovernance/catalog/dataProducts/${entry._source.id}`);
    knowledge.push({ kbName, kb, connection, raw });
  }
  const readmes = [];
  for (const product of products) {
    const blob = `${product.id}/README.md`;
    const response = await dataStorage._fetch(dataStorage.blobUrl(config.data.container, blob));
    const text = await response.text();
    if (neutralSeedText(text) !== text) readmes.push({ blob, text, etag: response.headers.get('etag') });
  }
  const states = [];
  for (const container of containers) {
    for (const name of ['agents', 'automations']) {
      const response = await storage._fetch(storage.blobUrl(container, `${name}.json`));
      const text = await response.text();
      states.push({ container, name, text, etag: response.headers.get('etag'), data: JSON.parse(text) });
    }
  }
  const agents = new Map();
  for (const [id, blueprint] of agentIds) {
    if (!states.some((item) => item.name === 'agents' && item.data[id]?.name === blueprint.name && item.data[id]._agent?.definition?.builtById)) {
      throw new Error(`No owned seed record for ${id}`);
    }
    const agent = await foundry.getAgent(id);
    if (!agent?.definition) throw new Error(`Missing Foundry definition for ${id}`);
    agents.set(id, agent);
  }
  console.log(JSON.stringify({ apply, knowledgeBases: knowledge.length, seedAgents: [...agents.keys()],
    stateContainers: containers, catalogueUpdatesDelegatedToOperator: skipCatalogue,
    policy: 'Preserve IDs, custom records, source rows, permissions and run history.' }));
  if (!apply) return;

  const prefix = `maintenance-backups/demo-repair-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const backup = async (name, text) => {
    const url = storage.blobUrl(config.state.blobContainer, `${prefix}/${name}`);
    await storage._fetch(url, { method: 'PUT', body: text, headers: {
      'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'application/json', 'If-None-Match': '*'
    } });
    if (await (await storage._fetch(url)).text() !== text) throw new Error(`Backup verification failed: ${name}`);
  };
  await backup('resources.json', JSON.stringify({ knowledge, agents: [...agents] }));
  await backup('sample-readmes.json', JSON.stringify(readmes));
  for (const state of states) await backup(`${state.container}-${state.name}.json`, state.text);
  console.log(`Verified private backups: ${config.state.blobAccount}/${config.state.blobContainer}/${prefix}`);

  for (const { kbName, kb, connection, raw } of knowledge) {
    const body = { ...kb, models: [{ kind: 'azureOpenAI', azureOpenAIParameters: {
      resourceUri: config.search.knowledgeModelEndpoint, deploymentId: config.foundry.model, modelName: config.search.knowledgeModelName
    } }], outputMode: 'extractiveData', retrievalReasoningEffort: { kind: 'low' } };
    delete body['@odata.etag'];
    await search._fetch(`/knowledgebases/${kbName}`, { method: 'PUT', apiVersion: version, body });
    const confirmed = await search._fetch(`/knowledgebases/${kbName}`, { apiVersion: version });
    if (confirmed.models?.[0]?.azureOpenAIParameters?.deploymentId !== config.foundry.model) throw new Error(`Model binding not confirmed: ${kbName}`);
    const target = new URL(connection.properties.target);
    target.searchParams.set('api-version', version);
    const url = `https://management.azure.com${projectArmId()}/connections/${connection.name}?api-version=2025-10-01-preview`;
    const response = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${armToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { ...connection.properties, target: target.href } }), signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Connection repair failed ${response.status}: ${await response.text()}`);
    if ((await response.json()).properties?.target !== target.href) throw new Error(`Connection target not confirmed: ${connection.name}`);
    const attrs = { ...toAttributeMap(raw.managedAttributes), cortexKnowledgeMcp: target.href, cortexKnowledgeReasoning: 'low' };
    if (!skipCatalogue) {
      await purview._fetch(`/datagovernance/catalog/dataProducts/${raw.id}`, { method: 'PUT', body: {
        ...raw, managedAttributes: Object.entries(attrs).map(([name, value]) => ({ name, value: String(value) }))
      } });
    }
    console.log(`Repaired ${kbName}`);
  }
  const changedAgents = new Map();
  for (const [id, agent] of agents) {
    const instructions = neutralSeedText(agent.definition.instructions);
    if (instructions === agent.definition.instructions) continue;
    // Keep the entire provider definition, including all tools and policies.
    const created = await foundry._fetch(`/agents/${id}/versions`, { method: 'POST',
      body: { definition: { ...agent.definition, instructions } } });
    if (!created.version) throw new Error(`New version not confirmed: ${id}`);
    changedAgents.set(id, created);
    console.log(`Neutralized ${id}, version ${created.version}`);
  }
  for (const state of states) {
    const next = neutralSeedState(state.name, state.data, changedAgents);
    if (JSON.stringify(next) === JSON.stringify(state.data)) continue;
    if (!state.etag) throw new Error('State ETag missing; refusing an unconditional write.');
    const text = JSON.stringify(next);
    await storage._fetch(storage.blobUrl(state.container, `${state.name}.json`), { method: 'PUT', body: text,
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'application/json', 'If-Match': state.etag } });
    if (await storage.download(state.container, `${state.name}.json`) !== text) throw new Error(`State verification failed: ${state.container}/${state.name}`);
    console.log(`Updated seed fields: ${state.container}/${state.name}`);
  }
  for (const { blob, text, etag } of readmes) {
    if (!etag) throw new Error(`Missing ETag for ${blob}`);
    const next = neutralSeedText(text);
    await dataStorage._fetch(dataStorage.blobUrl(config.data.container, blob), { method: 'PUT', body: next,
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'text/markdown; charset=utf-8', 'If-Match': etag } });
    if (await dataStorage.download(config.data.container, blob) !== next) throw new Error(`Sample README verification failed: ${blob}`);
  }
  if (skipCatalogue) console.log('Catalogue updates were explicitly delegated to the operator; verify those separately.');
  console.log('Knowledge and seed repair complete. Restart each web app before releasing maintenance so cached state cannot overwrite the repair.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
