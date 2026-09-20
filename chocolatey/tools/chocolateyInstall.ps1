$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/Asdmir786/HalalDL/releases/download/v0.6.1/HalalDL-Full-v0.6.1-win10%2B11-x64-setup.exe'
  checksum64     = '30A54030A5AC9C1B63E7349225C96DCEA7DE3B1BCB933E3704BAA889652FF606'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'HalalDL*'
}

Install-ChocolateyPackage @packageArgs
