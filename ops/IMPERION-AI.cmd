@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
chcp 65001 >nul 2>nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not found in PATH. Open this folder in VS Code and check Node installation.
  pause
  exit /b 1
)
:menu
cls
echo ================================================
echo        IMPERION AI - ONE CLICK CONTROL
echo ================================================
echo 1  Status and account blockers
echo 2  Run all local safety tests
echo 3  Preview synthetic content - zero network
echo 4  Test real local Ollama - synthetic only
echo 5  Open this project in VS Code
echo 6  Open Codex - read-only sandbox
echo 7  Open Antigravity - plan and sandbox
echo 8  Chat with local CPU model
echo 9  Download better Qwen3 4B (explicit confirmation)
echo 0  Exit
echo.
choice /C 0123456789 /N /M "Choose 0-9: "
set "selected=%errorlevel%"
if "%selected%"=="1" exit /b 0
if "%selected%"=="2" node "%~dp0imperion-ai.cjs" status
if "%selected%"=="3" node "%~dp0imperion-ai.cjs" test
if "%selected%"=="4" node "%~dp0imperion-ai.cjs" preview
if "%selected%"=="5" node "%~dp0imperion-ai.cjs" smoke
if "%selected%"=="6" node "%~dp0imperion-ai.cjs" editor
if "%selected%"=="7" node "%~dp0imperion-ai.cjs" codex
if "%selected%"=="8" node "%~dp0imperion-ai.cjs" agy
if "%selected%"=="9" node "%~dp0imperion-ai.cjs" chat
if "%selected%"=="10" node "%~dp0imperion-ai.cjs" setup-model
echo.
echo If a smoke check reports QA_BLOCKED, the translation is NOT publishable.
echo No automatic publication, software install, plans or account access.
echo.
pause
goto menu
