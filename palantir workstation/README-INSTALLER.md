# Nexora Gotham Platform - Windows Installer

This installer package includes everything needed to run the Nexora Gotham Platform on Windows, including automatic installation of dependencies.

## Installation Methods

### Method 1: PowerShell Script (Recommended)

1. Right-click on `install.ps1`
2. Select "Run with PowerShell"
3. If prompted about execution policy, type `Y` and press Enter
4. Follow the prompts to install dependencies

### Method 2: Executable Installer

1. Run `build-installer.bat` to create the executable installer
2. This requires NSIS (Nullsoft Scriptable Install System) to be installed
3. The resulting `NexoraGothamInstaller.exe` can be distributed to users

### Method 3: Manual Installation

1. Install Node.js from https://nodejs.org
2. Install Ollama from https://ollama.com
3. Clone or download this repository
4. Run `npm install` in the project directory
5. Run `npm run electron:dev` to start the application

## What Gets Installed

- **Node.js** (v20.12.2) - JavaScript runtime
- **Ollama** - AI model engine for the AI Assistant
- **npm dependencies** - All required Node.js packages
- **Nexora Gotham Platform** - The main application

## System Requirements

- Windows 10 or later
- 4GB RAM minimum (8GB recommended)
- 2GB disk space for installation
- Internet connection for downloading dependencies

## Troubleshooting

### PowerShell Execution Policy
If you get an error about execution policy:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Antivirus Software
Some antivirus software may flag the installer. This is a false positive - the installer downloads legitimate software from official sources.

### Network Issues
If downloads fail:
- Check your internet connection
- Try running the installer as Administrator
- Manually download and install Node.js and Ollama from their official websites

## Development

To build the installer from source:
1. Install NSIS from https://nsis.sourceforge.io/
2. Run `build-installer.bat`
3. The installer will be created as `NexoraGothamInstaller.exe`

## Components

The installer includes the following components:
- **Core Files** - The main application files
- **Node.js Runtime** - JavaScript runtime environment
- **Ollama AI Engine** - AI model engine
- **Dependencies** - npm packages and modules

Each component can be selected/deselected during installation for custom setups.
