<#
.SYNOPSIS
  Update only the image of explicitly selected existing web apps.
.DESCRIPTION
  No provisioning, bootstrap, secret copying, state reset or theme changes.
  Build a uniquely tagged image first. Use -WhatIf to inspect targets.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)][string]$SubscriptionId,
  [Parameter(Mandatory)][string]$ResourceGroup,
  [Parameter(Mandatory)][string[]]$Apps,
  [Parameter(Mandatory)][string]$Image
)
$ErrorActionPreference = 'Stop'
if ($Image -notmatch '^[a-z0-9.-]+/[a-zA-Z0-9/_.-]+(:[a-zA-Z0-9_.-]+|@sha256:[a-f0-9]{64})$' -or $Image -match ':latest$') {
  throw 'Use a registry image with a unique release tag or SHA-256 digest, not latest.'
}
if (@($Apps | Sort-Object -Unique).Count -ne $Apps.Count) { throw 'App names must be unique.' }
function Read-App($name) {
  $raw = az containerapp show --subscription $SubscriptionId -g $ResourceGroup -n $name --only-show-errors -o json
  if ($LASTEXITCODE -ne 0) { throw "Cannot read $name. No fallback or creation is permitted." }
  return $raw | ConvertFrom-Json
}
$targets = foreach ($name in $Apps) {
  $app = Read-App $name
  if ($app.properties.template.containers.Count -ne 1) { throw "$name is not a single-container app." }
  if ($app.properties.configuration.activeRevisionsMode -ne 'Single') { throw "$name requires an explicit multi-revision traffic plan." }
  [pscustomobject]@{ Name=$name; Before=$app }
}
foreach ($target in $targets) {
  $name = $target.Name
  $before = $target.Before
  $oldImage = $before.properties.template.containers[0].image
  Write-Host "$name : $oldImage -> $Image"
  if (!$PSCmdlet.ShouldProcess("$SubscriptionId/$ResourceGroup/$name", 'Update image only')) { continue }
  $current = Read-App $name
  if ($current.properties.latestRevisionName -ne $before.properties.latestRevisionName) { throw "$name changed during preflight. Review before retrying." }
  az containerapp update --subscription $SubscriptionId -g $ResourceGroup -n $name --image $Image --only-show-errors -o none
  if ($LASTEXITCODE -ne 0) { throw "Update failed for $name. Previous image: $oldImage. Other apps were not advanced." }
  $after = Read-App $name
  $deadline = (Get-Date).AddMinutes(5)
  while (($after.properties.latestRevisionName -ne $after.properties.latestReadyRevisionName -or $after.properties.runningStatus -ne 'Running') -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    $after = Read-App $name
  }
  if ($after.properties.latestRevisionName -ne $after.properties.latestReadyRevisionName -or $after.properties.runningStatus -ne 'Running') {
    throw "$name is not ready. Inspect the revision; previous image: $oldImage."
  }
  if (($before.properties.template.containers[0].env | ConvertTo-Json -Depth 10 -Compress) -cne
      ($after.properties.template.containers[0].env | ConvertTo-Json -Depth 10 -Compress)) {
    throw "$name environment changed unexpectedly. Inspect before continuing."
  }
  if ($after.properties.template.containers[0].image -ne $Image) { throw "$name did not retain the requested image." }
  Write-Host "$name ready: $($after.properties.latestReadyRevisionName). Rollback image: $oldImage"
}
