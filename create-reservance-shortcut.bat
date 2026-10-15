@echo off
setlocal
title Create RESERVANCE shortcut
cd /d "%~dp0"
set "ROOT=%CD%"

if not exist "%ROOT%\start-reservance.bat" (
  echo ERROR: start-reservance.bat was not found in:
  echo   %ROOT%
  echo Keep this file inside the RESERVANCE project folder.
  pause
  exit /b 1
)

echo Creating the RESERVANCE icon and Desktop shortcut for this PC...
echo   %ROOT%
echo.
echo The Desktop shortcut can sit outside the project folder and still show the logo.
echo Copying start-reservance.bat to the Desktop cannot keep that icon.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\tools\create-shortcut.ps1" -Root "%ROOT%"
if errorlevel 1 (
  echo Shortcut creation failed. You can still double-click start-reservance.bat
  pause
  exit /b 1
)

echo.
echo Done. Use the Desktop RESERVANCE icon.
echo On every new computer, run create-reservance-shortcut.bat once from the project folder.
echo.
pause
exit /b 0
