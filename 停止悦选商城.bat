@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Stop Yuexuan Shop

set "ROOT=%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:ROOT; $p=Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($root) }; if ($p) { $p | Stop-Process -Force; Write-Host 'Server stopped.' } else { Write-Host 'No server is running.' }"

ping -n 3 127.0.0.1 >nul
exit /b 0
