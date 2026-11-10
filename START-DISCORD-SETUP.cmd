@echo off
setlocal
cd /d "%~dp0"
echo.
echo IMPERION / DRUZINA MORAVY / DISCORD COMMUNITY SETUP
echo -----------------------------------------------
echo [1] PREPARE  - Node, tests, public API (no login needed)
echo [2] INSPECT  - authenticate bot, read server only
echo [3] APPLY    - configure server after typed owner approval
 echo.
choice /c 123 /n /m "Select 1, 2 or 3: "
set "MODE=Preflight"
if errorlevel 3 set "MODE=Apply"
if errorlevel 2 if not errorlevel 3 set "MODE=Inspect"
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ops\discord-druzina-ready.ps1" -Mode %MODE%
set "EXITCODE=%ERRORLEVEL%"
echo.
if "%EXITCODE%"=="0" (echo SAFE_STEP_COMPLETED. Check the output and next requirements.) else (echo BLOCKED. No retry performed; see the reason above.)
pause
exit /b %EXITCODE%
