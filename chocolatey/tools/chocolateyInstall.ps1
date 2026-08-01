$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/Asdmir786/HalalDL/releases/download/v0.5.1/HalalDL-Full-v0.5.1-win10%2B11-x64-setup.exe'
  checksum64     = 'B8E440EAF9006790D6623CA62AFC3F87868359010044EACEC623FB56EBCB0575'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'HalalDL*'
}

Install-ChocolateyPackage @packageArgs
