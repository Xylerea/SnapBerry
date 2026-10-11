$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$taskRoot = Join-Path (Split-Path $PSScriptRoot -Parent) '.android-build'
New-Item -ItemType Directory -Path $taskRoot -Force | Out-Null
$jdkZip = Join-Path $taskRoot 'jdk.zip'
$sdkZip = Join-Path $taskRoot 'sdk-tools.zip'
if (!(Test-Path $jdkZip)) {
    & curl.exe --fail --location --retry 2 --output $jdkZip 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse'
    if ($LASTEXITCODE -ne 0) { throw 'JDK download failed.' }
}
if (!(Test-Path $sdkZip)) {
    & curl.exe --fail --location --retry 2 --output $sdkZip 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip'
    if ($LASTEXITCODE -ne 0) { throw 'Android tools download failed.' }
}
if ((Get-FileHash $sdkZip -Algorithm SHA256).Hash.ToLower() -ne '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a') { throw 'Android tools checksum mismatch.' }
Expand-Archive -LiteralPath $jdkZip -DestinationPath (Join-Path $taskRoot 'java') -Force
Expand-Archive -LiteralPath $sdkZip -DestinationPath (Join-Path $taskRoot 'tools') -Force
$env:JAVA_HOME = (Get-ChildItem (Join-Path $taskRoot 'java') -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = Join-Path $taskRoot 'sdk'
$sdkManager = Join-Path $taskRoot 'tools/cmdline-tools/bin/sdkmanager.bat'
# Running this script explicitly accepts the Android SDK licenses.
1..20 | ForEach-Object { 'y' } | & $sdkManager "--sdk_root=$env:ANDROID_HOME" --licenses
& $sdkManager "--sdk_root=$env:ANDROID_HOME" 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'
if ($LASTEXITCODE -ne 0) { throw 'Android SDK installation failed.' }
Write-Output 'Android build tools ready in .android-build.'
