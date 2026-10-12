; Windows installer for the Unity edition (Inno Setup 6: https://jrsoftware.org/isdl.php)
; Built automatically by Tools > ASFAN Anatomy > Build Windows Program when Inno Setup is installed,
; or manually: ISCC.exe /DSourceDir="<build folder>" /DAppVersion=6.0.0 HumanAnatomy3D.iss

#ifndef SourceDir
  #define SourceDir "..\Builds\HumanAnatomy3D"
#endif
#ifndef AppVersion
  #define AppVersion "6.0.0"
#endif
#define AppName "Human Anatomy 3D"
#define AppExe "HumanAnatomy3D.exe"

[Setup]
AppId={{6F3B2A1C-8E4D-4B7A-9C55-3A1F0D2E9B71}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=ASFAN
AppPublisherURL=https://wa.me/962776140404
AppSupportURL=mailto:info@asfanco.com
AppCopyright=Copyright (C) ASFAN, Amman, Jordan
VersionInfoCompany=ASFAN
VersionInfoProductName={#AppName}
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\ASFAN\{#AppName}
DefaultGroupName=ASFAN
DisableProgramGroupPage=yes
LicenseFile=license.txt
SetupIconFile=asfan.ico
UninstallDisplayIcon={app}\{#AppExe}
OutputDir=..\Builds\Installer
OutputBaseFilename=HumanAnatomy3D-VR-Setup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Excludes: "*_BurstDebugInformation_DoNotShip\*,*_BackUpThisFolder_ButDontShipItWithYourGame\*"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "license.txt"; DestDir: "{app}"; DestName: "EULA.txt"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
