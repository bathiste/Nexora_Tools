# Nexora Gotham Platform Installer
# This script installs Ollama, Node.js, npm, and all dependencies

param (
    [switch]$Force,
    [switch]$SkipNode,
    [switch]$SkipOllama
)

Write-Host "=== Nexora Gotham Platform Installer ===" -ForegroundColor Cyan
Write-Host ""

# Function to check if command exists
function Test-Command {
    param ($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to download and install Ollama
function Install-Ollama {
    Write-Host "Installing Ollama..." -ForegroundColor Yellow
    $ollamaUrl = "https://ollama.com/download/OllamaSetup.exe"
    $installerPath = "$env:TEMP\OllamaSetup.exe"
    
    try {
        Write-Host "Downloading Ollama installer..."
        Invoke-WebRequest -Uri $ollamaUrl -OutFile $installerPath -UseBasicParsing
        
        Write-Host "Running Ollama installer (this may take a moment)..."
        Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait -NoNewWindow
        
        Write-Host "Ollama installed successfully!" -ForegroundColor Green
        Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
    }
    catch {
        Write-Host "Failed to install Ollama: $_" -ForegroundColor Red
        Write-Host "Please install Ollama manually from https://ollama.com" -ForegroundColor Yellow
    }
}

# Function to install Node.js
function Install-NodeJS {
    Write-Host "Installing Node.js..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v20.12.2/node-v20.12.2-x64.msi"
    $installerPath = "$env:TEMP\nodejs.msi"
    
    try {
        Write-Host "Downloading Node.js installer..."
        Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath -UseBasicParsing
        
        Write-Host "Running Node.js installer..."
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$installerPath`" /quiet /norestart" -Wait -NoNewWindow
        
        Write-Host "Node.js installed successfully!" -ForegroundColor Green
        Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
        
        # Refresh PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    }
    catch {
        Write-Host "Failed to install Node.js: $_" -ForegroundColor Red
        Write-Host "Please install Node.js manually from https://nodejs.org" -ForegroundColor Yellow
    }
}

# Function to install npm dependencies
function Install-NpmDependencies {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    
    try {
        Set-Location (Split-Path $PSScriptRoot)
        
        Write-Host "Running npm install..."
        npm install
        
        Write-Host "Dependencies installed successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to install dependencies: $_" -ForegroundColor Red
    }
}

# Function to create desktop shortcut
function Create-DesktopShortcut {
    $desktopPath = [System.Environment]::GetFolderPath("Desktop")
    $shortcutPath = "$desktopPath\Nexora Gotham Platform.lnk"
    $targetPath = (Split-Path $PSScriptRoot) + "\node_modules\.bin\electron.cmd"
    $workingDirectory = Split-Path $PSScriptRoot
    
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetPath
    $shortcut.WorkingDirectory = $workingDirectory
    $shortcut.IconLocation = "$workingDirectory\icon.ico"
    $shortcut.Description = "Nexora Gotham Platform"
    $shortcut.Save()
    
    Write-Host "Desktop shortcut created!" -ForegroundColor Green
}

# Main installation process
Write-Host "Checking system requirements..." -ForegroundColor Cyan

# Check for Ollama
if (-not $SkipOllama) {
    if (Test-Command "ollama") {
        Write-Host "✓ Ollama is already installed" -ForegroundColor Green
        ollama --version
    }
    else {
        Write-Host "✗ Ollama not found" -ForegroundColor Red
        if ($Force -or (Read-Host "Install Ollama? (y/n)") -eq 'y') {
            Install-Ollama
        }
    }
}

# Check for Node.js/npm
if (-not $SkipNode) {
    if (Test-Command "node") {
        Write-Host "✓ Node.js is already installed" -ForegroundColor Green
        node --version
    }
    else {
        Write-Host "✗ Node.js not found" -ForegroundColor Red
        if ($Force -or (Read-Host "Install Node.js? (y/n)") -eq 'y') {
            Install-NodeJS
        }
    }
    
    if (Test-Command "npm") {
        Write-Host "✓ npm is already installed" -ForegroundColor Green
        npm --version
    }
    else {
        Write-Host "✗ npm not found" -ForegroundColor Red
        Write-Host "npm should be installed with Node.js. If not, please install manually." -ForegroundColor Yellow
    }
}

# Install npm dependencies
if (Test-Command "npm") {
    Write-Host "Installing project dependencies..." -ForegroundColor Yellow
    Install-NpmDependencies
}
else {
    Write-Host "Cannot install dependencies - npm not available" -ForegroundColor Red
}

# Create desktop shortcut
try {
    Create-DesktopShortcut
}
catch {
    Write-Host "Could not create desktop shortcut: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host "To run the application:" -ForegroundColor Cyan
Write-Host "1. Open Command Prompt or PowerShell" -ForegroundColor White
Write-Host "2. Navigate to: $(Split-Path $PSScriptRoot)" -ForegroundColor White
Write-Host "3. Run: npm run electron:dev" -ForegroundColor White
Write-Host ""
Write-Host "Or use the desktop shortcut if created successfully." -ForegroundColor Cyan

# Ask if user wants to start the app now
if ((Read-Host "Start the application now? (y/n)") -eq 'y') {
    try {
        Set-Location (Split-Path $PSScriptRoot)
        npm run electron:dev
    }
    catch {
        Write-Host "Failed to start application: $_" -ForegroundColor Red
    }
}
