$ErrorActionPreference = "Stop"

$packageRoot = Split-Path -Parent $PSScriptRoot
$vendorRoot = Join-Path $packageRoot "vendor\grammar"
$languageToolRoot = Join-Path $vendorRoot "languagetool"
$javaRoot = Join-Path $vendorRoot "jre"
$kazakhRoot = Join-Path $vendorRoot "hunspell-kk"
$downloadRoot = Join-Path $vendorRoot ".downloads"

New-Item -ItemType Directory -Force -Path $vendorRoot, $downloadRoot | Out-Null

function Download-OfficialArchive([string]$url, [string]$destination) {
  if (Test-Path -LiteralPath $destination) { return }
  & curl.exe --fail --location --ssl-no-revoke --output $destination $url
  if ($LASTEXITCODE -ne 0) { throw "Не удалось скачать $url" }
}

function Assert-Sha256([string]$path, [string]$expected) {
  $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
  if ($actual -ne $expected) { throw "Контрольная сумма не совпала для $path" }
}

if (
  -not (Test-Path -LiteralPath (Join-Path $kazakhRoot "kk_KZ.aff")) -or
  -not (Test-Path -LiteralPath (Join-Path $kazakhRoot "kk_KZ.dic")) -or
  -not (Test-Path -LiteralPath (Join-Path $kazakhRoot "README_kk_KZ.txt"))
) {
  New-Item -ItemType Directory -Force -Path $kazakhRoot | Out-Null
  $kazakhSource = "https://raw.githubusercontent.com/kergalym/myspell-kk/master"
  Download-OfficialArchive "$kazakhSource/kk_KZ.aff" (Join-Path $kazakhRoot "kk_KZ.aff")
  Download-OfficialArchive "$kazakhSource/kk_KZ.dic" (Join-Path $kazakhRoot "kk_KZ.dic")
  Download-OfficialArchive "$kazakhSource/README_kk_KZ.txt" (Join-Path $kazakhRoot "README_kk_KZ.txt")
}
Assert-Sha256 (Join-Path $kazakhRoot "kk_KZ.aff") "254293C1C6AE893B87EC5C1FEA3B72F696FE7821A3D87740EBAD86B780D6E33A"
Assert-Sha256 (Join-Path $kazakhRoot "kk_KZ.dic") "80090F69C0D098425020AB378084D05EC7A4A90155750FAF73742CDDE7088012"
Assert-Sha256 (Join-Path $kazakhRoot "README_kk_KZ.txt") "FEE60A549EB2EDECC6C8C80A84852353932A02317881FC4F80888671931E90E5"

if (-not (Test-Path -LiteralPath (Join-Path $languageToolRoot "languagetool-server.jar"))) {
  $archive = Join-Path $downloadRoot "LanguageTool-stable.zip"
  $expanded = Join-Path $downloadRoot "languagetool-expanded"
  Download-OfficialArchive "https://languagetool.org/download/LanguageTool-stable.zip" $archive
  if (Test-Path -LiteralPath $expanded) { Remove-Item -LiteralPath $expanded -Recurse -Force }
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded
  $source = Get-ChildItem -LiteralPath $expanded -Directory | Select-Object -First 1
  if (-not $source) { throw "Архив LanguageTool имеет неожиданную структуру." }
  if (Test-Path -LiteralPath $languageToolRoot) { Remove-Item -LiteralPath $languageToolRoot -Recurse -Force }
  Move-Item -LiteralPath $source.FullName -Destination $languageToolRoot
}

if (-not (Test-Path -LiteralPath (Join-Path $javaRoot "bin\java.exe"))) {
  $metadata = Invoke-RestMethod "https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse"
  $javaUrl = $metadata[0].binary.package.link
  if (-not $javaUrl) { throw "Adoptium API не вернул ссылку на Java Runtime." }
  $archive = Join-Path $downloadRoot "adoptium-jre17.zip"
  $expanded = Join-Path $downloadRoot "jre-expanded"
  Download-OfficialArchive $javaUrl $archive
  if (Test-Path -LiteralPath $expanded) { Remove-Item -LiteralPath $expanded -Recurse -Force }
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded
  $source = Get-ChildItem -LiteralPath $expanded -Directory | Select-Object -First 1
  if (-not $source) { throw "Архив Java Runtime имеет неожиданную структуру." }
  if (Test-Path -LiteralPath $javaRoot) { Remove-Item -LiteralPath $javaRoot -Recurse -Force }
  Move-Item -LiteralPath $source.FullName -Destination $javaRoot
}

Write-Host "LanguageTool, Java Runtime и казахский Hunspell-словарь подготовлены в $vendorRoot"
