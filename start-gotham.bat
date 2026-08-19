@echo off
title Gotham Nexoraform Launcher
color 0A

set "ERROR_COUNT=0"
set "FATAL_ERROR="

echo ==============================================================
echo            Nexora GOTHAM PLATFORM LAUNCHER
echo ==============================================================
echo.

rem ==============================================================
rem 1. NODE.JS CHECK
rem ==============================================================
echo [PHASE 1/7] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Node.js not found! Installing Node.js...
    echo.
    echo Downloading Node.js LTS installer...
    curl -L -o "%TEMP%\nodejs.msi" "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi" --progress-bar
    if not exist "%TEMP%\nodejs.msi" (
        echo.
        echo ============================================================
        echo   [FAILURE] Failed to download Node.js installer
        echo   Step: Node.js download
        echo   Exit Code: %errorlevel%
        echo.
        echo   Suggested Fix:
        echo   Check internet | Run: curl -L -o nodejs.msi ... | Install from https://nodejs.org
        echo ============================================================
        echo.
        pause
        exit /b 1
    )
    echo [OK] Download complete!
    echo Installing Node.js silently...
    msiexec /i "%TEMP%\nodejs.msi" /quiet /norestart
    if %errorlevel% neq 0 (
        echo.
        echo ============================================================
        echo   [FAILURE] Node.js installation failed (error %errorlevel%)
        echo   Step: Node.js install
        echo   Exit Code: %errorlevel%
        echo.
        echo   Suggested Fix:
        echo   Run installer manually | Run as Administrator
        echo ============================================================
        echo.
        pause
        exit /b 1
    )
    del "%TEMP%\nodejs.msi" >nul 2>nul
    echo [OK] Node.js installed successfully!
) else (
    for /f "tokens=*" %%a in ('node --version') do echo          %%~a
)
echo.

rem ==============================================================
rem 2. OLLAMA CHECK
rem ==============================================================
echo [PHASE 2/7] Checking Ollama...
where ollama >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ============================================================
    echo   [FAILURE] Ollama is not installed!
    echo   Step: Ollama check
    echo ============================================================
    echo.
    echo   Suggested Fix:
    echo   Download from https://ollama.com/download | Run installer
    echo.
    pause
    exit /b 1
)

ollama list 2>nul | findstr dolphin-llama3 >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] dolphin-llama3 model not found!
    echo Installing dolphin-llama3:8b model... (requires ~4.7GB)
    echo.
    ollama pull dolphin-llama3:8b
    if %errorlevel% neq 0 (
        echo.
        echo ============================================================
        echo   [FAILURE] Failed to install dolphin-llama3 model
        echo   Exit Code: %errorlevel%
        echo ============================================================
        echo.
        echo   Suggested Fix:
        echo   Check disk space (4.7GB free) | Run: ollama pull dolphin-llama3:8b
        echo.
        pause
        exit /b 1
    )
)
echo [OK] Ollama and model check complete
echo.

rem ==============================================================
rem 3. RECON TOOLS AUTO-INSTALL
rem ==============================================================
echo [PHASE 3/7] Reconnaissance Tools Setup
echo ==============================================================
echo.

set INSTALL_COUNT=0
set FAIL_COUNT=0
set FAILED_TOOLS=

rem Check winget
where winget >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Windows Package Manager (winget) detected
    set HAVE_WINGET=1
) else (
    echo [INFO] winget not available - using direct downloads
    set HAVE_WINGET=0
)

rem ---- 1. nmap ----
where nmap >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing nmap...
    if "%HAVE_WINGET%"=="1" winget install --id Insecure.Nmap --silent --accept-package-agreements >nul 2>nul
    where nmap >nul 2>nul
    if %errorlevel% neq 0 (
        echo [WARN] Trying direct download...
        curl -L -o "%TEMP%\nmap-setup.exe" "https://nmap.org/dist/nmap-7.95-setup.exe" --progress-bar
        if exist "%TEMP%\nmap-setup.exe" (
            "%TEMP%\nmap-setup.exe" /S >nul 2>nul
            del "%TEMP%\nmap-setup.exe" >nul 2>nul
        )
    )
    where nmap >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% nmap )
) else (
    echo [OK] nmap found
)

rem ---- 2. dig ----
where dig >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing dig (BIND utilities)...
    if "%HAVE_WINGET%"=="1" winget install --id=9PBNT2N0VQ6Z --source msstore --silent >nul 2>nul
    where dig >nul 2>nul
    if %errorlevel% neq 0 (
        echo [WARN] Downloading BIND tools...
        curl -L -o "%TEMP%\BIND.zip" "https://downloads.isc.org/isc/bind9/9.18.28/BIND9.18.28.x64.zip" --progress-bar
        if exist "%TEMP%\BIND.zip" (
            powershell -Command "Expand-Archive -Path '%TEMP%\BIND.zip' -DestinationPath '%TEMP%\bind' -Force" >nul 2>nul
            if exist "%TEMP%\bind\bin\dig.exe" copy /Y "%TEMP%\bind\bin\dig.exe" "C:\Windows\System32\" >nul 2>nul
            rmdir /S /Q "%TEMP%\bind" >nul 2>nul
            del "%TEMP%\BIND.zip" >nul 2>nul
        )
    )
    where dig >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% dig )
) else (
    echo [OK] dig found
)

rem ---- 3. whois ----
where whois >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing whois...
    if "%HAVE_WINGET%"=="1" winget install --id=GnuWin32.Whois --silent --accept-package-agreements >nul 2>nul
    where whois >nul 2>nul
    if %errorlevel% neq 0 (
        echo [WARN] Downloading whois binary...
        curl -L -o "%TEMP%\whois.zip" "https://downloads.sourceforge.net/project/gnuwin32/whois/5.2.10/whois-5.2.10-bin.zip" --progress-bar
        if exist "%TEMP%\whois.zip" (
            powershell -Command "Expand-Archive -Path '%TEMP%\whois.zip' -DestinationPath '%TEMP%\whois-extract' -Force" >nul 2>nul
            if exist "%TEMP%\whois-extract\bin\whois.exe" copy /Y "%TEMP%\whois-extract\bin\whois.exe" "C:\Windows\System32\" >nul 2>nul
            rmdir /S /Q "%TEMP%\whois-extract" >nul 2>nul
            del "%TEMP%\whois.zip" >nul 2>nul
        )
    )
    where whois >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% whois )
) else (
    echo [OK] whois found
)

rem ---- 4. subfinder ----
where subfinder >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing subfinder (ProjectDiscovery)...
    curl -L -o "%TEMP%\subfinder.zip" "https://github.com/projectdiscovery/subfinder/releases/latest/download/subfinder_2.6.6_windows_amd64.zip" --progress-bar
    if not exist "%TEMP%\subfinder.zip" (
        curl -L -o "%TEMP%\subfinder.zip" "https://github.com/projectdiscovery/subfinder/releases/download/v2.6.6/subfinder_2.6.6_windows_amd64.zip" --progress-bar
    )
    if exist "%TEMP%\subfinder.zip" (
        powershell -Command "Expand-Archive -Path '%TEMP%\subfinder.zip' -DestinationPath '%TEMP%\subfinder' -Force" >nul 2>nul
        if exist "%TEMP%\subfinder\subfinder.exe" copy /Y "%TEMP%\subfinder\subfinder.exe" "C:\Windows\System32\" >nul 2>nul
        rmdir /S /Q "%TEMP%\subfinder" >nul 2>nul
        del "%TEMP%\subfinder.zip" >nul 2>nul
    )
    where subfinder >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% subfinder )
) else (
    echo [OK] subfinder found
)

rem ---- 5. httpx ----
where httpx >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing httpx (ProjectDiscovery)...
    curl -L -o "%TEMP%\httpx.zip" "https://github.com/projectdiscovery/httpx/releases/latest/download/httpx_1.6.8_windows_amd64.zip" --progress-bar
    if not exist "%TEMP%\httpx.zip" (
        curl -L -o "%TEMP%\httpx.zip" "https://github.com/projectdiscovery/httpx/releases/download/v1.6.8/httpx_1.6.8_windows_amd64.zip" --progress-bar
    )
    if exist "%TEMP%\httpx.zip" (
        powershell -Command "Expand-Archive -Path '%TEMP%\httpx.zip' -DestinationPath '%TEMP%\httpx' -Force" >nul 2>nul
        if exist "%TEMP%\httpx\httpx.exe" copy /Y "%TEMP%\httpx\httpx.exe" "C:\Windows\System32\" >nul 2>nul
        rmdir /S /Q "%TEMP%\httpx" >nul 2>nul
        del "%TEMP%\httpx.zip" >nul 2>nul
    )
    where httpx >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% httpx )
) else (
    echo [OK] httpx found
)

rem ---- 6. nuclei ----
where nuclei >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing nuclei (ProjectDiscovery)...
    curl -L -o "%TEMP%\nuclei.zip" "https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_3.3.3_windows_amd64.zip" --progress-bar
    if not exist "%TEMP%\nuclei.zip" (
        curl -L -o "%TEMP%\nuclei.zip" "https://github.com/projectdiscovery/nuclei/releases/download/v3.3.3/nuclei_3.3.3_windows_amd64.zip" --progress-bar
    )
    if exist "%TEMP%\nuclei.zip" (
        powershell -Command "Expand-Archive -Path '%TEMP%\nuclei.zip' -DestinationPath '%TEMP%\nuclei' -Force" >nul 2>nul
        if exist "%TEMP%\nuclei\nuclei.exe" copy /Y "%TEMP%\nuclei\nuclei.exe" "C:\Windows\System32\" >nul 2>nul
        rmdir /S /Q "%TEMP%\nuclei" >nul 2>nul
        del "%TEMP%\nuclei.zip" >nul 2>nul
        echo [*] Initializing nuclei templates...
        start /B cmd /c "nuclei -update-templates >nul 2>nul"
        set /a INSTALL_COUNT+=1
    ) else (
        set /a FAIL_COUNT+=1
        set FAILED_TOOLS=%FAILED_TOOLS% nuclei
    )
) else (
    echo [OK] nuclei found
)

rem ---- 7. amass ----
where amass >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing amass (OWASP)...
    curl -L -o "%TEMP%\amass.zip" "https://github.com/owasp-amass/amass/releases/latest/download/amass_windows_amd64.zip" --progress-bar
    if not exist "%TEMP%\amass.zip" (
        curl -L -o "%TEMP%\amass.zip" "https://github.com/owasp-amass/amass/releases/download/v4.2.0/amass_windows_amd64.zip" --progress-bar
    )
    if exist "%TEMP%\amass.zip" (
        powershell -Command "Expand-Archive -Path '%TEMP%\amass.zip' -DestinationPath '%TEMP%\amass-extract' -Force" >nul 2>nul
        for /r "%TEMP%\amass-extract" %%f in (amass.exe) do copy /Y "%%f" "C:\Windows\System32\" >nul 2>nul
        rmdir /S /Q "%TEMP%\amass-extract" >nul 2>nul
        del "%TEMP%\amass.zip" >nul 2>nul
    )
    where amass >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% amass )
) else (
    echo [OK] amass found
)

rem ---- 8. rustscan ----
where rustscan >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing rustscan...
    if "%HAVE_WINGET%"=="1" winget install --id=RustScan.RustScan --silent --accept-package-agreements >nul 2>nul
    where rustscan >nul 2>nul
    if %errorlevel% neq 0 (
        curl -L -o "%TEMP%\rustscan.zip" "https://github.com/RustScan/RustScan/releases/latest/download/rustscan_2.2.3_windows_amd64.zip" --progress-bar
        if not exist "%TEMP%\rustscan.zip" (
            curl -L -o "%TEMP%\rustscan.zip" "https://github.com/RustScan/RustScan/releases/download/2.2.3/rustscan_2.2.3_windows_amd64.zip" --progress-bar
        )
        if exist "%TEMP%\rustscan.zip" (
            powershell -Command "Expand-Archive -Path '%TEMP%\rustscan.zip' -DestinationPath '%TEMP%\rustscan' -Force" >nul 2>nul
            if exist "%TEMP%\rustscan\rustscan.exe" copy /Y "%TEMP%\rustscan\rustscan.exe" "C:\Windows\System32\" >nul 2>nul
            rmdir /S /Q "%TEMP%\rustscan" >nul 2>nul
            del "%TEMP%\rustscan.zip" >nul 2>nul
        )
    )
    where rustscan >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% rustscan )
) else (
    echo [OK] rustscan found
)

rem ---- 9. naabu ----
where naabu >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing naabu (ProjectDiscovery)...
    curl -L -o "%TEMP%\naabu.zip" "https://github.com/projectdiscovery/naabu/releases/latest/download/naabu_2.3.1_windows_amd64.zip" --progress-bar
    if exist "%TEMP%\naabu.zip" (
        powershell -Command "Expand-Archive -Path '%TEMP%\naabu.zip' -DestinationPath '%TEMP%\naabu' -Force" >nul 2>nul
        for /r "%TEMP%\naabu" %%f in (naabu.exe) do copy /Y "%%f" "C:\Windows\System32\" >nul 2>nul
        rmdir /S /Q "%TEMP%\naabu" >nul 2>nul
        del "%TEMP%\naabu.zip" >nul 2>nul
    )
    where naabu >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% naabu )
) else (
    echo [OK] naabu found
)

rem ---- 10. masscan ----
where masscan >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing masscan...
    curl -L -o "%TEMP%\masscan.exe" "https://github.com/robertdavidgraham/masscan/releases/latest/download/masscan.exe" --progress-bar
    if not exist "%TEMP%\masscan.exe" (
        curl -L -o "%TEMP%\masscan.exe" "https://github.com/robertdavidgraham/masscan/releases/download/1.3.2/masscan.exe" --progress-bar
    )
    if exist "%TEMP%\masscan.exe" (
        copy /Y "%TEMP%\masscan.exe" "C:\Windows\System32\" >nul 2>nul
        del "%TEMP%\masscan.exe" >nul 2>nul
    )
    where masscan >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% masscan )
) else (
    echo [OK] masscan found
)

rem ---- 11. wget ----
where wget >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing wget...
    curl -L -o "%TEMP%\wget.exe" "https://eternallybored.org/misc/wget/1.21.4/64/wget.exe" --progress-bar
    if exist "%TEMP%\wget.exe" (
        copy /Y "%TEMP%\wget.exe" "C:\Windows\System32\" >nul 2>nul
        del "%TEMP%\wget.exe" >nul 2>nul
    )
    where wget >nul 2>nul
    if %errorlevel% equ 0 ( set /a INSTALL_COUNT+=1 ) else ( set /a FAIL_COUNT+=1 & set FAILED_TOOLS=%FAILED_TOOLS% wget )
) else (
    echo [OK] wget found
)

echo.
echo ==============================================================
echo   Recon Tools Setup Complete
echo ==============================================================
echo   Installed: %INSTALL_COUNT% tools
if %FAIL_COUNT% gtr 0 (
    echo   Failed:    %FAIL_COUNT% tools
    echo   List:      %FAILED_TOOLS%
    echo.
    echo   The Recon Engine will use built-in fallback methods.
)
echo.

rem ==============================================================
rem 4. POSTGRESQL CHECK
rem ==============================================================
echo [PHASE 4/7] Checking PostgreSQL...

set PG_INSTALLED=0
set PGPATH=C:\Program Files\PostgreSQL\16\bin

if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
    set PG_INSTALLED=1
    echo [OK] PostgreSQL 16 found
)
if "%PG_INSTALLED%"=="0" if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" (
    set PG_INSTALLED=1
    set PGPATH=C:\Program Files\PostgreSQL\17\bin
    echo [OK] PostgreSQL 17 found
)
if "%PG_INSTALLED%"=="0" if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" (
    set PG_INSTALLED=1
    set PGPATH=C:\Program Files\PostgreSQL\15\bin
    echo [OK] PostgreSQL 15 found
)

if "%PG_INSTALLED%"=="0" (
    echo [WARNING] PostgreSQL not found! Installing...
    echo.
    echo Downloading PostgreSQL installer...
    curl -L -o "%TEMP%\postgresql.exe" "https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64.exe" --progress-bar
    if not exist "%TEMP%\postgresql.exe" (
        echo.
        echo ============================================================
        echo   [FAILURE] Failed to download PostgreSQL
        echo ============================================================
        echo.
        pause
        exit /b 1
    )
    echo [OK] Download complete!
    echo Installing PostgreSQL...
    "%TEMP%\postgresql.exe" --mode unattended --unattendedmodeui minimal --superaccount postgres --superpassword postgres --servicename "postgresql-x64-16"
    if %errorlevel% neq 0 (
        echo.
        echo ============================================================
        echo   [FAILURE] PostgreSQL install failed (error %errorlevel%)
        echo ============================================================
        echo.
        pause
        exit /b 1
    )
    del "%TEMP%\postgresql.exe" >nul 2>nul
    echo [INFO] Waiting for PostgreSQL...
    timeout /t 10 /nobreak >nul
    
    set PG_FOUND=0
    if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set PG_FOUND=1
    if "%PG_FOUND%"=="0" if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set PG_FOUND=1
    if "%PG_FOUND%"=="0" if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set PG_FOUND=1
    if "%PG_FOUND%"=="0" if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" set PG_FOUND=1
    if "%PG_FOUND%"=="0" (
        echo.
        echo ============================================================
        echo   [FAILURE] PostgreSQL not found after install
        echo ============================================================
        echo.
        pause
        exit /b 1
    )
    echo [OK] PostgreSQL installed!
    timeout /t 3 /nobreak >nul
)

set "PATH=%PATH%;%PGPATH%"

rem Start PostgreSQL
sc query postgresql-x64-16 | findstr RUNNING >nul 2>nul
if %errorlevel% equ 0 goto pg_running

sc query postgres | findstr RUNNING >nul 2>nul
if %errorlevel% equ 0 goto pg_running

sc query "PostgreSQL" | findstr RUNNING >nul 2>nul
if %errorlevel% equ 0 goto pg_running

echo [INFO] Starting PostgreSQL...
net start postgresql-x64-16 >nul 2>nul
if %errorlevel% neq 0 net start postgres >nul 2>nul
if %errorlevel% neq 0 net start "PostgreSQL" >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] Could not start PostgreSQL. Run: net start postgresql-x64-16
) else (
    echo [OK] PostgreSQL started
)
timeout /t 5 /nobreak >nul

:pg_running
echo [OK] PostgreSQL is running

start "PostgreSQL Setup" powershell -ExecutionPolicy Bypass -File "%~dp0create-db.ps1"
echo [OK] Database setup started.
echo.

rem ==============================================================
rem 5. KILL EXISTING PROCESSES
rem ==============================================================
echo [PHASE 5/7] Stopping existing processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe 2>nul
taskkill /F /IM electron.exe 2>nul
timeout /t 2 /nobreak >nul
echo [OK] Processes stopped
echo.

rem ==============================================================
rem 6. NPM DEPENDENCIES
rem ==============================================================
echo [PHASE 6/7] Installing npm dependencies...
cd /d "%~dp0"

call npm.cmd install
if %errorlevel% neq 0 (
    echo.
    echo ============================================================
    echo   [FAILURE] npm install failed (error %errorlevel%)
    echo ============================================================
    echo.
    echo   Suggested Fix:
    echo   Check internet | Run: npm install | Delete node_modules and retry
    echo.
    pause
    exit /b 1
)
echo [OK] All npm modules installed.
echo.

rem ==============================================================
rem 7. START ALL SERVICES
rem ==============================================================
echo [PHASE 7/7] Starting services...
echo.

echo [1/4] Starting Ollama Server...
start "Ollama Server" cmd /c "ollama serve"
timeout /t 3 /nobreak >nul

echo [2/4] Starting Node.js API on port 3000...
start "Node.js API" cmd /c "npm run api:dev"
timeout /t 3 /nobreak >nul

echo [3/4] Starting Python HTTP Server on port 8080...
start "Python Server" cmd /k "python -m http.server 8080 --directory dashboard --bind 127.0.0.1"
timeout /t 2 /nobreak >nul

echo [4/4] Starting Electron App...
timeout /t 3 /nobreak >nul
start "Gotham" cmd /c "npx electron . --dev"

rem ==============================================================
rem FINAL SUMMARY
rem ==============================================================
echo.
echo ==============================================================
echo   Launcher Complete - Final Status
echo ==============================================================
echo.
if "%ERROR_COUNT%" gtr "0" (
    echo   [WARNING] %ERROR_COUNT% error(s) occurred during setup.
    echo.
)
if "%FAIL_COUNT%" gtr 0 (
    echo   Recon Issues: %FAIL_COUNT% tool(s) failed: %FAILED_TOOLS%
    echo.
)
echo   Services:
echo   - PostgreSQL:       localhost:5432 (database: gotham)
echo   - Ollama:           http://localhost:11434
echo   - Node.js API:      http://localhost:3000
echo   - Dashboard:        http://localhost:8080
echo   - Electron App:     (Window should appear)
echo.
echo   Troubleshooting:
echo   1. npm run api:dev
echo   2. python -m http.server 8080 --directory dashboard
echo   3. net start postgresql-x64-16
echo   4. ollama serve
echo.
echo   Press any key to close...
echo ==============================================================
pause >nul
start /min "%~dp0stop-gotham.bat"
exit /b 0