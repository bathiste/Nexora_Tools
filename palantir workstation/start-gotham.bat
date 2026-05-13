@echo off
chcp 65001 >nul
title Gotham Nexoraform Launcher
color 0A

echo ==============================================================
echo            Nexora GOTHAM PLATFORM LAUNCHER
echo ==============================================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Node.js not found! Installing Node.js...
    echo.
    echo Downloading Node.js LTS installer... This may take a few minutes.
    curl -L -o "%TEMP%\nodejs.msi" "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi" --progress-bar
    if not exist "%TEMP%\nodejs.msi" (
        echo [ERROR] Failed to download Node.js.
        echo Please install manually from: https://nodejs.org
        pause
        exit /b 1
    )
    echo [OK] Download complete!
    echo Installing Node.js silently... This may take a few minutes.
    msiexec /i "%TEMP%\nodejs.msi" /qn
    if %errorlevel% neq 0 (
        echo [ERROR] Node.js installation failed.
        pause
        exit /b 1
    )
    del "%TEMP%\nodejs.msi" >nul 2>&1
    echo [OK] Node.js installed successfully!
    :: Refresh PATH to pick up node/npm
    for /f "tokens=*" %%a in ('where node') do set "NODE_PATH=%%~dpa"
    set "PATH=%PATH%;%NODE_PATH%"
) else (
    echo [OK] Node.js found: 
    for /f "tokens=*" %%a in ('node --version') do echo          %%~a
)

:: Check if Ollama is installed
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Ollama not found! Please install from https://ollama.com
    pause
    exit /b 1
)

:: Check if dolphin-llama3 model exists
for /f "tokens=*" %%a in ('ollama list ^| findstr dolphin-llama3') do set MODEL_EXISTS=%%a
if not defined MODEL_EXISTS (
    echo [WARNING] dolphin-llama3 model not found!
    echo Installing dolphin-llama3:8b model... This may take several minutes.
    ollama pull dolphin-llama3:8b
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install model. Run manually: ollama pull dolphin-llama3:8b
        pause
        exit /b 1
    )
)

echo [OK] Ollama and model check complete
echo.

:: Check if PostgreSQL is installed (check directory directly)
if not exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
    echo [WARNING] PostgreSQL not found! Installing PostgreSQL 16...
    echo.
    echo Downloading PostgreSQL installer... This may take a few minutes.
    
    :: Use curl to download PostgreSQL (built into Windows 10+)
    curl -L -o "%TEMP%\postgresql.exe" "https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64.exe" --progress-bar
    
    if not exist "%TEMP%\postgresql.exe" (
        echo [ERROR] Failed to download PostgreSQL.
        echo Please install manually from: https://postgresql.org
        pause
        exit /b 1
    )
    
    echo [OK] Download complete!
    echo Installing PostgreSQL silently... This may take a few minutes.
    echo.
    
    :: Install PostgreSQL silently with correct options
    echo [INFO] Running installer... Please wait...
    "%TEMP%\postgresql.exe" --mode unattended --unattendedmodeui minimal --superaccount postgres --superpassword postgres --servicename "postgresql-x64-16"
    
    :: Clean up installer
    del "%TEMP%\postgresql.exe" >nul 2>&1
    
    :: Wait for installation to complete and service to register
    echo [INFO] Waiting for PostgreSQL to register...
    timeout /t 10 /nobreak >nul
    
    :: Check if PostgreSQL was actually installed
    if not exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
        echo [ERROR] PostgreSQL installation not found in expected location.
        echo Please install manually from: https://postgresql.org
        pause
        exit /b 1
    )
    
    echo [OK] PostgreSQL installed successfully!
    
    :: Wait a moment for service to register
    timeout /t 3 /nobreak >nul
) else (
    echo [OK] PostgreSQL found at C:\Program Files\PostgreSQL\16
)

:: Add PostgreSQL to PATH for this session
set "PATH=%PATH%;C:\Program Files\PostgreSQL\16\bin"

:: Check if PostgreSQL service is running (try different service name patterns)
sc query postgresql-x64-16 | findstr RUNNING >nul 2>&1
if %errorlevel% neq 0 (
    sc query postgres | findstr RUNNING >nul 2>&1
)
if %errorlevel% neq 0 (
    sc query "PostgreSQL" | findstr RUNNING >nul 2>&1
)
if %errorlevel% neq 0 (
    echo [INFO] Starting PostgreSQL service...
    net start postgresql-x64-16 >nul 2>&1
    if %errorlevel% neq 0 (
        net start postgres >nul 2>&1
    )
    if %errorlevel% neq 0 (
        net start "PostgreSQL" >nul 2>&1
    )
    timeout /t 5 /nobreak >nul
)

:: Set PostgreSQL path and password for commands
set "PGPATH=C:\Program Files\PostgreSQL\16\bin"

:: Run database setup in separate window
echo [INFO] Starting database setup in separate window...
start "PostgreSQL Database Setup" powershell -ExecutionPolicy Bypass -File "%~dp0create-db.ps1"

echo [OK] Database setup started in separate window.
echo.

:: Kill any existing processes
echo [*] Stopping any existing processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe 2>nul
taskkill /F /IM electron.exe 2>nul
timeout /t 2 /nobreak >nul

:: Change to script directory
cd /d "%~dp0"

:: Install/Update npm dependencies
echo [*] Installing all npm modules from package.json...
call npm.cmd install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Please run manually: npm install
    pause
    exit /b 1
)
echo [OK] All npm modules installed.
echo.

echo [OK] Starting services...
echo.

:: Start Ollama Server
echo [1/4] Starting Ollama Server on port 11434...
start "Ollama Server" cmd /c "ollama serve"
timeout /t 3 /nobreak >nul

:: Start Node.js API
echo [2/4] Starting Node.js API on port 3000...
start "Node.js API" cmd /c "npm run api:dev"
timeout /t 3 /nobreak >nul

:: Start Python HTTP Server for dashboard
echo [3/4] Starting Python HTTP Server on port 8080...
start "Python Dashboard Server" cmd /k "python -m http.server 8080 --directory dashboard --bind 127.0.0.1"
timeout /t 2 /nobreak >nul

:: Start Electron
echo [4/4] Starting Electron App...
timeout /t 3 /nobreak >nul
start "Gotham Nexoraform" cmd /c "npx electron . --dev"

echo.
echo ==============================================================
echo   All services started successfully!
echo.
echo   - PostgreSQL:       localhost:5432 (database: gotham)
echo   - Ollama Server:     http://localhost:11434
echo   - Node.js API:      http://localhost:3000
echo   - Dashboard Server: http://localhost:8080
echo   - Electron App:     (Window should appear)
echo.
echo   Press any key to open stop script...
echo ==============================================================

pause >nul
start stop-gotham.bat /min
exit /b 0