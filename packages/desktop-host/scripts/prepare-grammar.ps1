$ErrorActionPreference = "Stop"

$packageRoot = Split-Path -Parent $PSScriptRoot
$vendorRoot = Join-Path $packageRoot "vendor\grammar"
$languageToolRoot = Join-Path $vendorRoot "languagetool"
$javaRoot = Join-Path $vendorRoot "jre"
$kazakhRoot = Join-Path $vendorRoot "hunspell-kk"
$downloadRoot = Join-Path $vendorRoot ".downloads"

# Release inputs: versioned artifacts only. These values are intentionally not
# derived from a "stable", "latest", or API selector.
$LANGUAGE_TOOL_VERSION = "6.6"
$LANGUAGE_TOOL_URL = "https://languagetool.org/download/LanguageTool-6.6.zip"
$LANGUAGE_TOOL_SHA256 = "53600506B399BB5FFE1E4C8DEC794FD378212F14AAF38CCEF9B6F89314D11631"
$JRE_VENDOR = "Eclipse Temurin"
$JRE_VERSION = "17.0.16+8"
$JRE_URL = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.16%2B8/OpenJDK17U-jre_x64_windows_hotspot_17.0.16_8.zip"
$JRE_SHA256 = "D35B05F4832215D8877D0DBF15C6370C854D7D5B812F890A9C0DB8AD412A6BF2"

New-Item -ItemType Directory -Force -Path $vendorRoot, $downloadRoot | Out-Null

function Download-VerifiedArchive([string]$url, [string]$destination, [string]$expectedHash) {
  if (Test-Path -LiteralPath $destination) {
    try { Assert-Sha256 $destination $expectedHash; return }
    catch { Remove-Item -LiteralPath $destination -Force }
  }
  & curl.exe --fail --location --ssl-no-revoke --output $destination $url
  if ($LASTEXITCODE -ne 0) { throw "Не удалось скачать $url" }
  Assert-Sha256 $destination $expectedHash
}

function Assert-Sha256([string]$path, [string]$expected) {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($path)
  try {
    $actual = ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace("-", "")
  } finally {
    $stream.Dispose()
    $sha256.Dispose()
  }
  if ($actual -ne $expected) { throw "Контрольная сумма не совпала для $path" }
}

if (
  -not (Test-Path -LiteralPath (Join-Path $kazakhRoot "kk_KZ.aff")) -or
  -not (Test-Path -LiteralPath (Join-Path $kazakhRoot "kk_KZ.dic")) -or
  -not (Test-Path -LiteralPath (Join-Path $kazakhRoot "README_kk_KZ.txt"))
) {
  New-Item -ItemType Directory -Force -Path $kazakhRoot | Out-Null
  $kazakhSource = "https://raw.githubusercontent.com/kergalym/myspell-kk/master"
  & curl.exe --fail --location --ssl-no-revoke --output (Join-Path $kazakhRoot "kk_KZ.aff") "$kazakhSource/kk_KZ.aff"
  & curl.exe --fail --location --ssl-no-revoke --output (Join-Path $kazakhRoot "kk_KZ.dic") "$kazakhSource/kk_KZ.dic"
  & curl.exe --fail --location --ssl-no-revoke --output (Join-Path $kazakhRoot "README_kk_KZ.txt") "$kazakhSource/README_kk_KZ.txt"
}
Assert-Sha256 (Join-Path $kazakhRoot "kk_KZ.aff") "254293C1C6AE893B87EC5C1FEA3B72F696FE7821A3D87740EBAD86B780D6E33A"
Assert-Sha256 (Join-Path $kazakhRoot "kk_KZ.dic") "80090F69C0D098425020AB378084D05EC7A4A90155750FAF73742CDDE7088012"
Assert-Sha256 (Join-Path $kazakhRoot "README_kk_KZ.txt") "FEE60A549EB2EDECC6C8C80A84852353932A02317881FC4F80888671931E90E5"

if (-not (Test-Path -LiteralPath (Join-Path $languageToolRoot "languagetool-server.jar"))) {
  $archive = Join-Path $downloadRoot "LanguageTool-$LANGUAGE_TOOL_VERSION.zip"
  $expanded = Join-Path $downloadRoot "languagetool-expanded"
  Download-VerifiedArchive $LANGUAGE_TOOL_URL $archive $LANGUAGE_TOOL_SHA256
  if (Test-Path -LiteralPath $expanded) { Remove-Item -LiteralPath $expanded -Recurse -Force }
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded
  $source = Get-ChildItem -LiteralPath $expanded -Directory | Select-Object -First 1
  if (-not $source) { throw "Архив LanguageTool имеет неожиданную структуру." }
  if (Test-Path -LiteralPath $languageToolRoot) { Remove-Item -LiteralPath $languageToolRoot -Recurse -Force }
  Move-Item -LiteralPath $source.FullName -Destination $languageToolRoot
}

if (-not (Test-Path -LiteralPath (Join-Path $javaRoot "bin\java.exe"))) {
  $archive = Join-Path $downloadRoot "OpenJDK17U-jre_x64_windows_hotspot_17.0.16_8.zip"
  $expanded = Join-Path $downloadRoot "jre-expanded"
  Download-VerifiedArchive $JRE_URL $archive $JRE_SHA256
  if (Test-Path -LiteralPath $expanded) { Remove-Item -LiteralPath $expanded -Recurse -Force }
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded
  $source = Get-ChildItem -LiteralPath $expanded -Directory | Select-Object -First 1
  if (-not $source) { throw "Архив Java Runtime имеет неожиданную структуру." }
  if (Test-Path -LiteralPath $javaRoot) { Remove-Item -LiteralPath $javaRoot -Recurse -Force }
  Move-Item -LiteralPath $source.FullName -Destination $javaRoot
}

Write-Host "LanguageTool, Java Runtime и казахский Hunspell-словарь подготовлены в $vendorRoot"
