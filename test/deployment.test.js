import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { neutralSeedState, neutralSeedText } from '../scripts/repair-demo.js';

test('demo migration preserves custom records, IDs, owner and historical runs', () => {
  const steps = ['usage-analyst', 'supply-analyst', 'quality-analyst', 'service-analyst', 'evidence-reviewer']
    .map((name) => ({ agentId: `demo-${name}` }));
  const seed = { id: 'AUT-0001', name: 'Demo - Novo operations briefing', steps, owner: { id: 'owner' },
    runs: [{ text: 'Historical Novo result' }] };
  const custom = { ...seed, id: 'AUT-0002', name: 'My Novo briefing' };
  const before = { seq: 2, items: { 'AUT-0001': seed, 'AUT-0002': custom } };
  const after = neutralSeedState('automations', before);
  assert.equal(after.items['AUT-0001'].name, 'Demo - Operations briefing');
  assert.deepEqual(after.items['AUT-0001'].runs, seed.runs);
  assert.deepEqual(after.items['AUT-0001'].owner, seed.owner);
  assert.deepEqual(after.items['AUT-0002'], custom);
  assert.equal(seed.name, 'Demo - Novo operations briefing');
  assert.deepEqual(neutralSeedState('automations', after), after);
});

test('agent migration touches only the seeded instruction phrases, not branding or custom agents', () => {
  assert.equal(neutralSeedText('No real Novo sites. These are not Novo company data.'), 'No real sites. These are not company data.');
  assert.equal(neutralSeedText('Novo Nordisk'), 'Novo Nordisk');
  const seed = { name: 'Demo - Usage analyst', desc: 'not Novo company data',
    _agent: { version: '1', definition: { builtById: 'owner', instructions: 'not Novo company data' } } };
  const state = { 'demo-usage-analyst': seed, 'custom-agent': structuredClone(seed) };
  const after = neutralSeedState('agents', state, new Map([['demo-usage-analyst', { version: '2' }]]));
  assert.equal(after['demo-usage-analyst']._agent.version, '2');
  assert.equal(after['demo-usage-analyst']._agent.definition.instructions, 'not company data');
  assert.deepEqual(after['custom-agent'], state['custom-agent']);
});

test('knowledge settings are wired through templates and local bootstrap', () => {
  const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const key of ['SEARCH_KNOWLEDGE_MODEL_NAME', 'SEARCH_KNOWLEDGE_MODEL_ENDPOINT']) {
    for (const file of ['infra/main.parameters.json', 'infra/modules/containerapps.bicep', 'scripts/Set-CortexEnv.ps1', 'scripts/Deploy-Cortex.ps1', 'scripts/Preprovision-Check.ps1']) {
      assert.ok(read(file).includes(key), `${file} must preserve ${key}`);
    }
  }
  const dockerignore = read('.dockerignore').split(/\r?\n/);
  for (const item of ['node_modules', '.venv', '.azure', '.git', '.env', '.env.*', 'src/web/assets/vendor']) assert.ok(dockerignore.includes(item));
  const updater = read('scripts/Update-CortexApps.ps1');
  assert.match(updater, /SupportsShouldProcess/);
  assert.doesNotMatch(updater, /--set-env-vars|--replace-env-vars|azd up|az group delete/);
  assert.match(read('scripts/Preprovision-Check.ps1'), /Provisioning would remove approved connectors/);
});

test('preprovision blocks missing connectors and permits a preserved configuration', {
  skip: Boolean(spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']).error)
}, () => {
  const guard = fileURLToPath(new URL('../scripts/Preprovision-Check.ps1', import.meta.url)).replaceAll("'", "''");
  for (const [desired, blocked] of [['[]', true], ['[{"id":"cortex-demo-api"}]', false]]) {
    const script = `
      $env:CORTEX_RESOURCE_GROUP = 'fixture'
      $env:CREATE_MODEL_DEPLOYMENT = 'false'
      $env:SERVICE_WEB_IMAGE_NAME = 'existing/web:tag'
      $env:SERVICE_PURVIEW_MCP_IMAGE_NAME = 'existing/mcp:tag'
      $env:CORTEX_CONNECTORS = '${desired}'
      function az {
        $global:LASTEXITCODE = 0
        if ($args[0] -eq 'group') { 'true'; return }
        if ($args[0] -eq 'containerapp' -and $args[1] -eq 'list') {
          @(@{ name='cortex-web'; properties=@{ template=@{ containers=@(@{ env=@(
            @{ name='CORTEX_CONNECTORS'; value='[{"id":"cortex-demo-api"}]' }
          ) }) } } }) | ConvertTo-Json -Depth 10 -AsArray
          return
        }
        throw 'Unexpected Azure command'
      }
      function azd { throw 'No environment mutation expected' }
      & '${guard}'
    `;
    const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });
    assert.equal(result.status === 0, !blocked, result.stdout + result.stderr);
    if (blocked) assert.match(result.stderr, /Provisioning would remove approved connectors/);
  }
});
