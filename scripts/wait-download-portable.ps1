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
  $match = $runs | Where-Object {
    $_.headSha -and $_.headSha.ToLowerInvariant().StartsWith($Sha.Substring(0, [Math]::Min(7, $Sha.Length)))
  } | Select-Object -First 1

  if (-not $match -and $Sha.Length -ge 40) {
    $match = $runs | Where-Object { $_.headSha -eq $Sha } | Select-Object -First 1
  }

  if ($match) {
    $runId = [string]$match.databaseId
    Write-Host "Found run $runId ($($match.status)) $($match.url)"
    break
  }

  Write-Host "$(Get-Date -Format 'HH:mm:ss')  no run yet for $shortSha — polling every ${PollSeconds}s..."
  Start-Sleep -Seconds $PollSeconds
}

if (-not $runId) {
  throw "Timed out waiting for a nightly Actions run for commit $Sha"
}

Write-Host "Watching run $runId until it finishes..."
gh run watch $runId --exit-status

$runView = gh run view $runId --json conclusion,headSha,url | ConvertFrom-Json
if ($runView.conclusion -ne "success") {
  throw "Nightly run failed (conclusion=$($runView.conclusion)). See $($runView.url)"
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
  throw "Portable ZIP not found under $OutDir. Files: $((Get-ChildItem $OutDir -File | ForEach-Object Name) -join ', ')"
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
Write-Host "  ZIP:  $($zip.FullName)"
Write-Host "  App:  $exe"
if (Test-Path $binDir) {
  Write-Host "  Bin:  $binDir"
  Get-ChildItem $binDir -File | ForEach-Object {
    Write-Host ("         - {0}" -f $_.Name)
  }
}

$sumFile = Join-Path $OutDir "SHA256SUMS.txt"
if (Test-Path $sumFile) {
  $expected = (Get-Content $sumFile | Where-Object { $_ -like "*$($zip.Name)" } | Select-Object -First 1)
  if ($expected) {
    $hash = (Get-FileHash -Path $zip.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $want = ($expected -split '\s+', 2)[0].ToLowerInvariant()
    if ($hash -ne $want) {
      throw "SHA256 mismatch for $($zip.Name): got $hash expected $want"
    }
    Write-Host "  SHA256 OK"
  }
}

if ($NoLaunch) {
  Write-Host "Done (-NoLaunch). Run manually: $exe"
  exit 0
}

Write-Host "Launching..."
Start-Process -FilePath $exe
Write-Host "Launched Portable from commit $shortSha"
