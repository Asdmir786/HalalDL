$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/Asdmir786/HalalDL/releases/download/v0.6.0/HalalDL-Full-v0.6.0-win10%2B11-x64-setup.exe'
  checksum64     = 'F1B23403B68D825815F7F6967BDC263A9E906E7B218A1CEEE88552CDB25ED58F'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'HalalDL*'
}

Install-ChocolateyPackage @packageArgs
