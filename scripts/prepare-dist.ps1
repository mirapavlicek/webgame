# Windows varianta prepare-dist.sh. Spusť z rootu repa:
#   powershell -ExecutionPolicy Bypass -File scripts/prepare-dist.ps1
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot/.."
Set-Location $root

$dist = "dist-game"
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Path $dist | Out-Null

Copy-Item index.html -Destination $dist
Copy-Item manifest.webmanifest -Destination $dist
Copy-Item sw.js -Destination $dist
Copy-Item css -Destination $dist -Recurse
Copy-Item js -Destination $dist -Recurse

if (Test-Path vendor) {
  if (-not (Test-Path 'vendor/pixi.min.js') -or -not (Test-Path 'vendor/pixi-filters.min.js')) {
    Write-Host "→ vendor/pixi*.min.js chybí, spouštím vendor/fetch.ps1..." -ForegroundColor Yellow
    try { powershell -ExecutionPolicy Bypass -File vendor/fetch.ps1 }
    catch { Write-Host "⚠ vendor fetch selhal — hra poběží bez WebGL FX (graceful degradation)." -ForegroundColor Yellow }
  }
  New-Item -ItemType Directory -Path "$dist/vendor" -Force | Out-Null
  foreach ($f in @('vendor/pixi.min.js','vendor/pixi-filters.min.js')) {
    if (Test-Path $f) { Copy-Item $f -Destination "$dist/vendor/" }
  }
}

New-Item -ItemType Directory -Path "$dist/src-tauri/icons" -Force | Out-Null
foreach ($f in @('src-tauri/icons/favicon.svg','src-tauri/icons/logo.svg')) {
  if (Test-Path $f) { Copy-Item $f -Destination "$dist/src-tauri/icons/" }
}

Write-Host "✓ dist-game/ připraveno" -ForegroundColor Green
