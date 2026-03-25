; Inno Setup Script for 数据运维工作台
; Compile with: iscc /DMyAppVersion=v3.7.0 setup.iss

#ifndef MyAppVersion
  #define MyAppVersion "v3.7.0"
#endif

[Setup]
AppId={{E8F3A1B2-5C6D-4E7F-8A9B-0C1D2E3F4A5B}
AppName=数据运维工作台
AppVersion={#MyAppVersion}
AppPublisher=DataOps Team
DefaultDirName={autopf}\DataOpsWorkbench
DefaultGroupName=数据运维工作台
AllowNoIcons=yes
OutputDir=dist
OutputBaseFilename=data-ops-workbench-{#MyAppVersion}-win-x64-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
UninstallDisplayName=数据运维工作台
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加图标:"; Flags: checked
Name: "startupicon"; Description: "开机自动启动"; GroupDescription: "系统设置:"; Flags: unchecked

[Files]
Source: "dist\data-ops-workbench\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{app}\data"; Permissions: users-full
Name: "{app}\backups"; Permissions: users-full
Name: "{app}\logs"; Permissions: users-full

[Icons]
; 优先使用 exe 启动器，如无则用 start.bat
Name: "{group}\数据运维工作台"; Filename: "{app}\数据运维工作台.exe"; Check: FileExists(ExpandConstant('{app}\数据运维工作台.exe'))
Name: "{group}\数据运维工作台"; Filename: "{app}\start.bat"; Check: not FileExists(ExpandConstant('{app}\数据运维工作台.exe'))
Name: "{group}\卸载数据运维工作台"; Filename: "{uninstallexe}"
Name: "{autodesktop}\数据运维工作台"; Filename: "{app}\数据运维工作台.exe"; Tasks: desktopicon; Check: FileExists(ExpandConstant('{app}\数据运维工作台.exe'))
Name: "{autodesktop}\数据运维工作台"; Filename: "{app}\start.bat"; Tasks: desktopicon; Check: not FileExists(ExpandConstant('{app}\数据运维工作台.exe'))

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "DataOpsWorkbench"; ValueData: """{app}\start.bat"""; Flags: uninsdeletevalue; Tasks: startupicon

[Run]
Filename: "{app}\数据运维工作台.exe"; Description: "立即启动数据运维工作台"; Flags: nowait postinstall skipifsilent; Check: FileExists(ExpandConstant('{app}\数据运维工作台.exe'))
Filename: "{app}\start.bat"; Description: "立即启动数据运维工作台"; Flags: nowait postinstall skipifsilent; Check: not FileExists(ExpandConstant('{app}\数据运维工作台.exe'))

[UninstallDelete]
Type: filesandirs; Name: "{app}\logs"
Type: filesandirs; Name: "{app}\data"
Type: filesandirs; Name: "{app}\backups"
