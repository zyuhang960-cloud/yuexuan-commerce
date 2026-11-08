@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Yuexuan Shop - Launcher

set "SITE_URL=http://127.0.0.1:8787/"
set "APP_DIR="
set "YX_NODE_EXE="

rem Find the app folder that contains server.js (avoids Chinese path literals)
for /d %%D in ("%~dp0*") do if exist "%%D\server.js" set "APP_DIR=%%D"
if not defined APP_DIR goto FILE_MISSING

rem Use the bundled Node runtime when present (no install needed)
if exist "%~dp0runtime\node.exe" set "YX_NODE_EXE=%~dp0runtime\node.exe"

echo.
echo   Yuexuan Shop - local demo
echo   -------------------------
echo.

call :CHECK_SERVER
if not errorlevel 1 goto OPEN_SITE

echo Starting local server...
if not defined YX_NODE_EXE for /f "delims=" %%N in ('where.exe node 2^>nul') do if not defined YX_NODE_EXE set "YX_NODE_EXE=%%~fN"
if not defined YX_NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "YX_NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined YX_NODE_EXE goto NODE_MISSING

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path $env:APP_DIR 'server.js'; Start-Process -FilePath $env:YX_NODE_EXE -ArgumentList @($p) -WorkingDirectory $env:APP_DIR -WindowStyle Hidden"
if errorlevel 1 goto START_FAILED

for /L %%I in (1,1,30) do (
  powershell.exe -NoProfile -Command "Start-Sleep -Milliseconds 500" >nul 2>nul
  call :CHECK_SERVER
  if not errorlevel 1 goto OPEN_SITE
)
goto START_FAILED

:CHECK_SERVER
powershell.exe -NoProfile -Command "try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/health' -TimeoutSec 2; if ($r.ok) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>nul
exit /b %errorlevel%

:OPEN_SITE
echo Ready. Opening browser...
if not "%YUEXUAN_NO_BROWSER%"=="1" start "" "%SITE_URL%"
echo.
echo   Shop URL : %SITE_URL%
echo   Merchant : merchant / YueXuan@2026Admin
echo.
echo Next time just double-click this file.
ping -n 3 127.0.0.1 >nul
endlocal
exit /b 0

:FILE_MISSING
echo [ERROR] server.js was not found. Copy the whole project folder, not just this file.
pause
exit /b 1

:NODE_MISSING
echo [ERROR] node.exe not found.
echo Keep runtime\node.exe inside this folder, or install Node.js 22+.
pause
exit /b 1

:START_FAILED
echo [ERROR] The server did not answer on port 8787.
echo The port may be in use, or the folder is incomplete.
pause
exit /b 1
