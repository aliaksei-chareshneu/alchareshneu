@echo off
setlocal
cd /d "%~dp0"
echo.
echo IMPERION Agent 5 - ONE synthetic Notepad test only.
echo No personal files, no browser restart, no model, no payment.
echo You must physically approve in the Windows dialog.
echo After clicking YES, do not touch mouse or keyboard for 15 seconds.
echo.
python -B "%~dp0pc5_gui_owner_finish.py" --run
set "RESULT=%ERRORLEVEL%"
echo.
echo Agent5 finished with exit code %RESULT%.
echo Exit 0 means independent on-disk GUI readback was verified.
echo Exit 2 or 3 means blocked/failed; do not retry consumed approvals.
echo.
pause
exit /b %RESULT%
