# Wait for the GitHub Actions "nightly" build for a commit, download Portable, extract, launch.
# Usage:
#   pnpm qa:portable
#   pwsh -File scripts/wait-download-portable.ps1
#   pwsh -File scripts/wait-download-portable.ps1 -Sha <full-or-short-sha>
#   pwsh -File scripts/wait-download-portable.ps1 -NoLaunch

[CmdletBinding()]
param(
  [string]$Sha = "",
  [string]$OutDir = "",
  [switch]$NoLaunch,
  [int]$PollSeconds = 20,
  [int]$TimeoutMinutes = 90
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

Require-Command "gh"
Require-Command "git"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if (-not $Sha) {
  $Sha = (git rev-parse HEAD).Trim()
}
$Sha = $Sha.Trim().ToLowerInvariant()
$shortSha = if ($Sha.Length -ge 7) { $Sha.Substring(0, 7) } else { $Sha }

if (-not $OutDir) {
  $OutDir = Join-Path $repoRoot ".tmp-qa-nightly"
}

$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
Write-Host "Repo:     $repoRoot"
Write-Host "Commit:   $Sha"
Write-Host "Out dir:  $OutDir"
Write-Host "Waiting for workflow 'nightly' (up to $TimeoutMinutes min)..."

$runId = $null
while ((Get-Date) -lt $deadline) {
  $runsJson = gh run list --workflow nightly.yml --branch main --limit 25 --json databaseId,headSha,status,conclusion,url,createdAt,displayTitle
  $runs = $runsJson | ConvertFrom-Json
  $prefixLen = [Math]::Min(7, $Sha.Length)
  $prefix = $Sha.Substring(0, $prefixLen)
  $match = $runs | Where-Object {
    $_.headSha -and $_.headSha.ToLowerInvariant().StartsWith($prefix)
  } | Select-Object -First 1

  if (-not $match -and $Sha.Length -ge 40) {
    $match = $runs | Where-Object { $_.headSha -eq $Sha } | Select-Object -First 1
  }

  if ($match) {
    $runId = [string]$match.databaseId
    Write-Host ("Found run {0} ({1}) {2}" -f $runId, $match.status, $match.url)
    break
  }

  $now = Get-Date -Format "HH:mm:ss"
  Write-Host ("{0}  no run yet for {1} - polling every {2}s..." -f $now, $shortSha, $PollSeconds)
  Start-Sleep -Seconds $PollSeconds
}

if (-not $runId) {
  throw "Timed out waiting for a nightly Actions run for commit $Sha"
}

Write-Host "Watching run $runId until it finishes..."
gh run watch $runId --exit-status

$runView = gh run view $runId --json conclusion,headSha,url | ConvertFrom-Json
if ($runView.conclusion -ne "success") {
  throw ("Nightly run failed (conclusion={0}). See {1}" -f $runView.conclusion, $runView.url)
}

$fullSha = $runView.headSha
$artifactName = "HalalDL-nightly-$fullSha"
Write-Host "Downloading artifact: $artifactName"

if (Test-Path $OutDir) {
  Remove-Item $OutDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

gh run download $runId -n $artifactName -D $OutDir

$zip = Get-ChildItem -Path $OutDir -Filter "HalalDL-Portable-*.zip" -File | Select-Object -First 1
if (-not $zip) {
  $names = @(Get-ChildItem $OutDir -File | ForEach-Object { $_.Name }) -join ", "
  throw "Portable ZIP not found under $OutDir. Files: $names"
}

$extractDir = Join-Path $OutDir "portable-extract"
if (Test-Path $extractDir) {
  Remove-Item $extractDir -Recurse -Force
}
Expand-Archive -Path $zip.FullName -DestinationPath $extractDir -Force

$exe = Join-Path $extractDir "HalalDL.exe"
if (-not (Test-Path $exe)) {
  throw "HalalDL.exe missing after extract: $extractDir"
}

$binDir = Join-Path $extractDir "portable-data\bin"
Write-Host ""
Write-Host "Portable ready:"
Write-Host ("  ZIP:  {0}" -f $zip.FullName)
Write-Host ("  App:  {0}" -f $exe)
if (Test-Path $binDir) {
  Write-Host ("  Bin:  {0}" -f $binDir)
  Get-ChildItem $binDir -File | ForEach-Object {
    Write-Host ("         - {0}" -f $_.Name)
  }
}

$sumFile = Join-Path $OutDir "SHA256SUMS.txt"
if (Test-Path $sumFile) {
  $expected = (Get-Content $sumFile | Where-Object { $_ -like ("*{0}*" -f $zip.Name) } | Select-Object -First 1)
  if ($expected) {
    $hash = (Get-FileHash -Path $zip.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $want = ($expected -split '\s+', 2)[0].ToLowerInvariant()
    if ($hash -ne $want) {
      throw ("SHA256 mismatch for {0}: got {1} expected {2}" -f $zip.Name, $hash, $want)
    }
    Write-Host "  SHA256 OK"
  }
}

if ($NoLaunch) {
  Write-Host ("Done (-NoLaunch). Run manually: {0}" -f $exe)
  exit 0
}

Write-Host "Launching..."
Start-Process -FilePath $exe
Write-Host ("Launched Portable from commit {0}" -f $shortSha)
