@echo off
setlocal EnableDelayedExpansion
title RESERVANCE
cd /d "%~dp0"
set "ROOT=%CD%"

echo.
echo ========================================
echo   RESERVANCE — starting on this PC
echo ========================================
echo   Project: %ROOT%
echo.

REM ---------- Setup tutorial popup (auto-checklist) ----------
if not exist "%ROOT%\.reservance-skip-setup-guide" (
  echo Opening setup tutorial...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\tools\setup-guide.ps1" -Root "%ROOT%"
  if errorlevel 1 (
    echo Setup tutorial was closed. RESERVANCE was not started.
    pause
    exit /b 1
  )
)

REM ---------- Find XAMPP (any drive / folder layout) ----------
set "XAMPP="

REM Project usually lives in xampp\htdocs\RESERVANCECAPSTONE
if exist "%ROOT%\..\..\mysql\bin\mysqld.exe" (
  for %%I in ("%ROOT%\..\..") do set "XAMPP=%%~fI"
)

if not defined XAMPP if exist "%ROOT%\..\mysql\bin\mysqld.exe" (
  for %%I in ("%ROOT%\..") do set "XAMPP=%%~fI"
)

if not defined XAMPP (
  for %%D in (C D E F G) do (
    if not defined XAMPP if exist "%%D:\xampp\mysql\bin\mysqld.exe" set "XAMPP=%%D:\xampp"
    if not defined XAMPP if exist "%%D:\XAMPP\mysql\bin\mysqld.exe" set "XAMPP=%%D:\XAMPP"
  )
)

if not defined XAMPP if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\Programs\xampp\mysql\bin\mysqld.exe" (
  set "XAMPP=%LOCALAPPDATA%\Programs\xampp"
)

if not defined XAMPP (
  echo ERROR: XAMPP MySQL was not found on this computer.
  echo.
  echo Install XAMPP, or put this project inside xampp\htdocs\, then try again.
  echo You can also open XAMPP Control Panel, start MySQL, and run this again.
  echo.
  pause
  exit /b 1
)

echo XAMPP found: %XAMPP%

set "MYSQLADMIN=%XAMPP%\mysql\bin\mysqladmin.exe"
set "MYSQLD=%XAMPP%\mysql\bin\mysqld.exe"
set "MYSQLINI=%XAMPP%\mysql\bin\my.ini"
if not exist "%MYSQLINI%" set "MYSQLINI=%XAMPP%\mysql\bin\my.cnf"
if not exist "%MYSQLINI%" set "MYSQLINI=%XAMPP%\mysql\my.ini"

REM ---------- Find PHP (prefer this XAMPP copy) ----------
set "PHP="
if exist "%XAMPP%\php\php.exe" set "PHP=%XAMPP%\php\php.exe"
if not defined PHP (
  for /f "delims=" %%P in ('where php 2^>nul') do (
    if not defined PHP set "PHP=%%P"
  )
)
if not defined PHP (
  echo ERROR: PHP was not found.
  echo Install XAMPP PHP or add php.exe to PATH, then try again.
  pause
  exit /b 1
)
echo PHP: %PHP%

REM ---------- Find Node / npm ----------
set "NPM="
for /f "delims=" %%N in ('where npm.cmd 2^>nul') do (
  if not defined NPM set "NPM=%%N"
)
if not defined NPM for /f "delims=" %%N in ('where npm 2^>nul') do (
  if not defined NPM set "NPM=%%N"
)
if not defined NPM if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "NPM=%ProgramFiles(x86)%\nodejs\npm.cmd"
if not defined NPM (
  echo ERROR: Node.js / npm was not found.
  echo Install Node.js LTS from https://nodejs.org then open a NEW terminal and try again.
  pause
  exit /b 1
)
echo npm: %NPM%

REM ---------- Project folders ----------
if not exist "%ROOT%\backend\artisan" (
  echo ERROR: backend\artisan is missing. Put the full RESERVANCE project folder here.
  pause
  exit /b 1
)
if not exist "%ROOT%\frontend\package.json" (
  echo ERROR: frontend\package.json is missing.
  pause
  exit /b 1
)
if not exist "%ROOT%\realtime-server\package.json" (
  echo ERROR: realtime-server\package.json is missing.
  pause
  exit /b 1
)

REM ---------- First-time install on a new PC ----------
if not exist "%ROOT%\backend\vendor\autoload.php" (
  echo.
  echo Backend packages are missing. Running composer install...
  where composer >nul 2>&1
  if errorlevel 1 (
    if exist "%XAMPP%\php\php.exe" if exist "%ROOT%\backend\composer.phar" (
      pushd "%ROOT%\backend"
      "%PHP%" composer.phar install --no-interaction
      popd
    ) else (
      echo ERROR: Composer is not installed. Install Composer, then run this again.
      pause
      exit /b 1
    )
  ) else (
    pushd "%ROOT%\backend"
    composer install --no-interaction
    popd
  )
  if not exist "%ROOT%\backend\vendor\autoload.php" (
    echo ERROR: composer install failed.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%\frontend\node_modules\" (
  echo.
  echo Frontend packages are missing. Running npm install...
  pushd "%ROOT%\frontend"
  call "%NPM%" install
  popd
  if not exist "%ROOT%\frontend\node_modules\" (
    echo ERROR: frontend npm install failed.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%\realtime-server\node_modules\" (
  echo.
  echo Realtime packages are missing. Running npm install...
  pushd "%ROOT%\realtime-server"
  call "%NPM%" install
  popd
  if not exist "%ROOT%\realtime-server\node_modules\" (
    echo ERROR: realtime-server npm install failed.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%\backend\.env" (
  if exist "%ROOT%\backend\.env.example" (
    echo Creating backend\.env from .env.example ...
    copy /Y "%ROOT%\backend\.env.example" "%ROOT%\backend\.env" >nul
    "%PHP%" "%ROOT%\backend\artisan" key:generate --force >nul 2>&1
  )
)

REM ---------- MySQL ----------
echo.
echo Checking MySQL...
"%MYSQLADMIN%" -u root --silent ping >nul 2>&1
if not errorlevel 1 goto mysqlready

echo Starting XAMPP MySQL...
if exist "%MYSQLINI%" (
  start "RESERVANCE MySQL" /MIN "%MYSQLD%" --defaults-file="%MYSQLINI%"
) else (
  start "RESERVANCE MySQL" /MIN "%MYSQLD%"
)

set tries=0
:waitmysql
set /a tries+=1
timeout /t 2 /nobreak >nul
"%MYSQLADMIN%" -u root --silent ping >nul 2>&1
if not errorlevel 1 goto mysqlready
if !tries! LSS 25 goto waitmysql

echo.
echo MySQL did not start automatically.
echo Open XAMPP Control Panel, click Start on MySQL, then run RESERVANCE again.
pause
exit /b 1

:mysqlready
echo MySQL is running.

REM Make sure the database exists (safe if it already does)
"%XAMPP%\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS reservance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >nul 2>&1

REM Raise MySQL connection limit for a full classroom (safe if user lacks SUPER)
"%XAMPP%\mysql\bin\mysql.exe" -u root -e "SET GLOBAL max_connections = 300;" >nul 2>&1

REM Detect school LAN IP and write runtime config for student browsers
set "LAN_IP=127.0.0.1"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\tools\write-runtime-config.ps1" -Root "%ROOT%"`) do set "LAN_IP=%%I"
echo Classroom LAN address: %LAN_IP%

REM ---------- One window for every server ----------
echo.
echo Starting all servers in this window...
echo   4 PHP API workers + gateway on :8000
echo   Frontend on :5173    Realtime on :3001
echo.

set "RESERVANCE_PHP=%PHP%"
set "RESERVANCE_NPM=%NPM%"
set "RESERVANCE_LAN_IP=%LAN_IP%"
set "RESERVANCE_ROOT=%ROOT%"
node "%ROOT%\tools\dev-console.mjs"
set "NODE_EXIT=%ERRORLEVEL%"
if not "%NODE_EXIT%"=="0" (
  echo.
  echo RESERVANCE stopped with an error.
  pause
)
exit /b %NODE_EXIT%
