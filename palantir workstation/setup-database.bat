@echo off
chcp 65001 >nul
title PostgreSQL Database Setup
color 0B

:: Change to script directory
cd /d "%~dp0"

set "PGPATH=C:\Program Files\PostgreSQL\16\bin"
set "PGPASSWORD=postgres"
set "SCHEMA_FILE=%~dp0schema.sql"

echo ==============================================================
echo           PostgreSQL Database Setup
echo ==============================================================
echo.
echo Setting up PostgreSQL database...
echo.

:: Check if gotham database exists
echo Checking if database 'gotham' exists...
%PGPATH%\psql -U postgres -d postgres -c "SELECT 1 FROM pg_database WHERE datname='gotham';" 2>nul | findstr "1 row" >nul 2>&1
if %errorlevel% neq 0 (
    echo Database 'gotham' does not exist. Creating...
    %PGPATH%\psql -U postgres -d postgres -c "CREATE DATABASE gotham;"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create database.
        pause
        exit /b 1
    )
    echo [OK] Database 'gotham' created successfully!
) else (
    echo [OK] Database 'gotham' already exists.
)

echo.

:: Run database migrations if schema.sql exists
if exist "%SCHEMA_FILE%" (
    echo Running database migrations...
    %PGPATH%\psql -U postgres -d gotham -f "%SCHEMA_FILE%"
    if %errorlevel% neq 0 (
        echo [WARNING] Database migration may have failed.
    ) else (
        echo [OK] Database migrations completed!
    )
) else (
    echo No schema.sql found at %SCHEMA_FILE%, skipping migrations.
)

echo.
echo ==============================================================
echo   Database setup complete!
echo.
echo   Database: gotham
echo   Host: localhost
echo   Port: 5432
echo   User: postgres
echo.
echo Press any key to close...
echo ==============================================================

set "PGPASSWORD="
pause >nul
exit /b 0
