@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_shortfactory.ps1" -AutoInstallTools -EnableSchedule
if errorlevel 1 (
  echo.
  echo Installation incomplete. Read the error above. No video has been published.
  pause
  exit /b 1
)
echo.
echo Installer finished. The machine runs locally on Windows Task Scheduler.
pause
