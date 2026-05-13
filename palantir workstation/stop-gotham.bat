@echo off
title Gotham Platform - Stop Services
color 0C

echo ==============================================================
echo            STOP GOTHAM PLATFORM SERVICES
echo ==============================================================
echo.

echo [~] Stopping all Gotham services...
echo.

echo - Stopping Electron...
taskkill /F /IM electron.exe 2>nul
if %errorlevel% equ 0 (echo   [OK] Electron stopped) else (echo   [-] Electron not running)

echo - Stopping Node.js API...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (echo   [OK] Node.js stopped) else (echo   [-] Node.js not running)

echo - Stopping Python HTTP Server...
taskkill /F /IM python.exe 2>nul
if %errorlevel% equ 0 (echo   [OK] Python stopped) else (echo   [-] Python not running)

echo - Stopping Ollama...
taskkill /F /IM ollama.exe 2>nul
if %errorlevel% equ 0 (echo   [OK] Ollama stopped) else (echo   [-] Ollama not running)

echo.
echo [OK] All services stopped!
echo.
timeout /t 3 /nobreak >nul
exit /b 0