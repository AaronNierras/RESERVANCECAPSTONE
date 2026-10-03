@echo off
setlocal EnableDelayedExpansion
title RESERVANCE
cd /d "%~dp0"

echo Starting RESERVANCE...
echo.

echo Checking XAMPP MySQL...
"C:\xampp\mysql\bin\mysqladmin.exe" -u root --silent ping >nul 2>&1
if not errorlevel 1 goto mysqlready

echo Starting XAMPP MySQL...
start "RESERVANCE MySQL" /MIN "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini"
set tries=0

:waitmysql
set /a tries+=1
timeout /t 2 /nobreak >nul
"C:\xampp\mysql\bin\mysqladmin.exe" -u root --silent ping >nul 2>&1
if not errorlevel 1 goto mysqlready
if !tries! LSS 20 goto waitmysql

echo MySQL did not start. Open XAMPP Control Panel and start MySQL, then run RESERVANCE again.
pause
exit /b 1

:mysqlready
echo MySQL is running.
echo.

start "RESERVANCE API" cmd /k "cd /d "%~dp0backend" && php artisan serve"
start "RESERVANCE Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
start "RESERVANCE Realtime" cmd /k "cd /d "%~dp0realtime-server" && npm run dev"

echo Waiting for the app to start...
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo RESERVANCE is starting.
echo   App:      http://localhost:5173
echo   API:      http://localhost:8000
echo   Realtime: http://localhost:3001
echo.
echo Close the RESERVANCE windows to stop the system. Leave MySQL running.
timeout /t 4 /nobreak >nul
exit
