param([switch]$Clean)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$taskRoot = Join-Path $projectRoot '.android-build'
if (Test-Path (Join-Path $taskRoot 'java')) {
    $env:JAVA_HOME = (Get-ChildItem (Join-Path $taskRoot 'java') -Directory | Select-Object -First 1).FullName
}
if (Test-Path (Join-Path $taskRoot 'sdk')) { $env:ANDROID_HOME = Join-Path $taskRoot 'sdk' }
if (!$env:JAVA_HOME) { throw 'Install Android Studio and set JAVA_HOME to its jbr folder, or run setup-android-tools.ps1.' }
if (!$env:ANDROID_HOME) { throw 'Set ANDROID_HOME to your Android SDK folder.' }
$env:GRADLE_USER_HOME = Join-Path $taskRoot 'gradle-cache'
Push-Location (Join-Path $projectRoot 'android')
try {
    if ($Clean) { & .\gradlew.bat --no-daemon clean :app:assembleDebug }
    else { & .\gradlew.bat --no-daemon :app:assembleDebug }
    if ($LASTEXITCODE -ne 0) { throw 'Android APK build failed.' }
} finally { Pop-Location }
$output = Join-Path $projectRoot 'output'
New-Item -ItemType Directory -Path $output -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'android/app/build/outputs/apk/debug/app-debug.apk') -Destination (Join-Path $output 'SnapBerry-debug.apk')
$buildTools = Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory | Sort-Object Name -Descending | Select-Object -First 1
& (Join-Path $env:JAVA_HOME 'bin/java.exe') -jar (Join-Path $buildTools.FullName 'lib/apksigner.jar') verify (Join-Path $output 'SnapBerry-debug.apk')
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
Write-Output 'APK ready: output/SnapBerry-debug.apk'
