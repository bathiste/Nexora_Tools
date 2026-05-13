; Nexora Gotham Platform Installer Script
; Requires NSIS 3.0 or later

!define APPNAME "Nexora Gotham Platform"
!define VERSION "1.0.0"
!define PUBLISHER "Nexora Technologies"
!define DESCRIPTION "Cybersecurity Analytics Platform"
!define URL "https://palantir.com"

; Include required plugins
!include "MUI2.nsh"
!include "nsExec.nsh"
!include "InetC.nsh"

; General
Name "${APPNAME}"
OutFile "NexoraGothamInstaller.exe"
InstallDir "$PROGRAMFILES\${APPNAME}"
InstallDirRegKey HKLM "Software\${APPNAME}" "InstallPath"
RequestExecutionLevel admin

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installer sections
Section "Core Files" SecCore
    SectionIn RO
    
    SetOutPath "$INSTDIR"
    
    ; Copy application files
    File /r "dist\*"
    File "package.json"
    File "main.js"
    File "preload.js"
    File "icon.ico"
    
    ; Store installation path
    WriteRegStr HKLM "Software\${APPNAME}" "InstallPath" "$INSTDIR"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Add to Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLInfoAbout" "${URL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\icon.ico"
    
    ; Create desktop shortcut
    CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\electron.exe" "" "$INSTDIR\icon.ico"
    
    ; Create start menu shortcuts
    CreateDirectory "$SMPROGRAMS\${APPNAME}"
    CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\electron.exe" "" "$INSTDIR\icon.ico"
    CreateShortCut "$SMPROGRAMS\${APPNAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Node.js Runtime" SecNodeJS
    DetailPrint "Installing Node.js runtime..."
    
    ; Install Node.js from MSI file
    ExecWait '"msiexec.exe" /i "$PLUGINSDIR\nodejs.msi" /quiet /norestart'
    Pop $0
    DetailPrint "Node.js installation result: $0"
SectionEnd

Section "Ollama AI Engine" SecOllama
    DetailPrint "Installing Ollama AI engine..."
    
    ; Download and install Ollama silently
    InitPluginsDir
    nsExec::ExecToLog '"$PLUGINSDIR\ollama.exe" /S'
    Pop $0
    DetailPrint "Ollama installation result: $0"
SectionEnd

Section "Dependencies" SecDeps
    DetailPrint "Installing application dependencies..."
    
    ; Install npm dependencies
    nsExec::ExecToLog '"$INSTDIR\node.exe" --version'
    Pop $0
    
    ${If} $0 != ""
        nsExec::ExecToLog '"$INSTDIR\npm.exe" install --production'
        Pop $0
        DetailPrint "npm install result: $0"
    ${EndIf}
SectionEnd

; Functions
Function .onInit
    InitPluginsDir
    
    ; Download Node.js installer
    DetailPrint "Downloading Node.js installer..."
    inetc::get "https://nodejs.org/dist/v20.12.2/node-v20.12.2-x64.msi" "$PLUGINSDIR\nodejs.msi" /END
    Pop $0
    ${If} $0 != "OK"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to download Node.js installer"
        Abort
    ${EndIf}
    
    ; Download Ollama installer
    DetailPrint "Downloading Ollama installer..."
    inetc::get "https://ollama.com/download/OllamaSetup.exe" "$PLUGINSDIR\ollama.exe" /END
    Pop $0
    ${If} $0 != "OK"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to download Ollama installer"
        Abort
    ${EndIf}
FunctionEnd

; Uninstaller section
Section "Uninstall"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir /r "$INSTDIR"
    
    Delete "$DESKTOP\${APPNAME}.lnk"
    RMDir /r "$SMPROGRAMS\${APPNAME}"
    
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
    DeleteRegKey HKLM "Software\${APPNAME}"
SectionEnd
