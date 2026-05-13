@echo off
echo Building Nexora Gotham Platform Installer...

REM Create installer directory
if not exist "installer" mkdir "installer"
cd installer

REM Download dependencies
echo Downloading Node.js installer...
powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.12.2/node-v20.12.2-x64.msi' -OutFile 'nodejs.msi'"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to download Node.js installer
    cd ..
    exit /b 1
)

echo Downloading Ollama installer...
powershell -Command "Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile 'ollama.exe'"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to download Ollama installer
    cd ..
    exit /b 1
)

REM Copy application files
echo Copying application files...
xcopy "..\dist" "app" /E /I /Y >nul 2>&1
copy "..\package.json" "app\" >nul 2>&1
copy "..\main.js" "app\" >nul 2>&1
copy "..\preload.js" "app\" >nul 2>&1
copy "..\icon.ico" "app\" >nul 2>&1

REM Create installation script
echo Creating installation script...
(
echo @echo off
echo echo Installing Nexora Gotham Platform...
echo echo.
echo echo Installing Node.js...
echo msiexec /i nodejs.msi /quiet /norestart
echo echo.
echo echo Installing Ollama...
echo ollama.exe /S
echo echo.
echo echo Installing application dependencies...
echo cd app
echo npm install --production
echo echo.
echo echo Creating desktop shortcut...
echo powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%%USERPROFILE%%\Desktop\Nexora Gotham Platform.lnk'); $Shortcut.TargetPath = '%%CD%%\node_modules\.bin\electron.cmd'; $Shortcut.WorkingDirectory = '%%CD%%'; $Shortcut.Save()"
echo echo.
echo echo Installation complete!
echo pause
) > install.bat

REM Create uninstall script
echo Creating uninstall script...
(
echo @echo off
echo echo Uninstalling Nexora Gotham Platform...
echo del "%%USERPROFILE%%\Desktop\Nexora Gotham Platform.lnk" >nul 2>&1
echo cd ..
echo rmdir /s /q installer >nul 2>&1
echo echo Uninstallation complete!
echo pause
) > uninstall.bat

REM Create README
echo Creating README...
(
echo Nexora Gotham Platform - Self-Contained Installer
echo ================================================
echo.
echo To install:
echo 1. Run install.bat as Administrator
echo 2. Wait for all installations to complete
echo.
echo To uninstall:
echo 1. Run uninstall.bat
echo.
echo This installer includes:
echo - Node.js v20.12.2
echo - Ollama AI Engine
echo - Nexora Gotham Platform application
) > README.txt

REM Create zip package
echo Creating installer package...
powershell -Command "Compress-Archive -Path * -DestinationPath '../NexoraGothamInstaller.zip' -Force"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to create zip package
    cd ..
    exit /b 1
)

cd ..

echo.
echo === Installer package created successfully! ===
echo File: NexoraGothamInstaller.zip
echo.
echo To distribute: Extract the zip and run install.bat
echo.
pause
exit /b 0
