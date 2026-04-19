# Stahne PixiJS a pixi-filters do vendor/ pro offline / Tauri build.
# Spust z rootu repa: powershell -ExecutionPolicy Bypass -File vendor/fetch.ps1
# POZOR: ASCII-only — PowerShell 5.1 cti .ps1 jako cp1252.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$PixiVer = "7.3.2"
$FiltersVer = "5.3.0"

Write-Host "-> Stahuji pixi.js $PixiVer..."
Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/$PixiVer/pixi.min.js" `
    -OutFile "pixi.min.js" -UseBasicParsing

Write-Host "-> Stahuji pixi-filters $FiltersVer..."
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/pixi-filters@$FiltersVer/dist/browser/pixi-filters.min.js" `
    -OutFile "pixi-filters.min.js" -UseBasicParsing

Write-Host "[OK] Hotovo. Soubory:"
Get-Item pixi.min.js, pixi-filters.min.js | Format-Table Name, Length
