# Windows varianta prepare-dist.sh. Spust z rootu repa:
#   powershell -ExecutionPolicy Bypass -File scripts/prepare-dist.ps1
# POZOR: ASCII-only — PowerShell 5.1 cti .ps1 jako cp1252, UTF-8 znaky lamou parser.
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
    Write-Host "-> vendor/pixi*.min.js chybi, spoustim vendor/fetch.ps1..." -ForegroundColor Yellow
    try { powershell -ExecutionPolicy Bypass -File vendor/fetch.ps1 }
    catch { Write-Host "[WARN] vendor fetch selhal - hra pobezi bez WebGL FX (graceful degradation)." -ForegroundColor Yellow }
  }
  New-Item -ItemType Directory -Path "$dist/vendor" -Force | Out-Null
  foreach ($f in @('vendor/pixi.min.js','vendor/pixi-filters.min.js')) {
    if (Test-Path $f) { Copy-Item $f -Destination "$dist/vendor/" }
  }
}

# Ikony pro PWA manifest + favicon. Tauri v2 odmita frontendDist obsahujici
# slozku "src-tauri" — proto kopirujeme do icons/ (bez prefixu).
New-Item -ItemType Directory -Path "$dist/icons" -Force | Out-Null
$iconFiles = @(
  'src-tauri/icons/favicon.svg',
  'src-tauri/icons/logo.svg',
  'src-tauri/icons/128x128.png',
  'src-tauri/icons/128x128@2x.png',
  'src-tauri/icons/icon.png',
  'src-tauri/icons/32x32.png'
)
foreach ($f in $iconFiles) {
  if (Test-Path $f) { Copy-Item $f -Destination "$dist/icons/" }
}

Write-Host "[OK] dist-game/ pripraveno" -ForegroundColor Green
