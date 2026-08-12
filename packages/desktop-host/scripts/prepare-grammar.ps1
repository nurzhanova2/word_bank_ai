$ErrorActionPreference = "Stop"

$packageRoot = Split-Path -Parent $PSScriptRoot
$vendorRoot = Join-Path $packageRoot "vendor\grammar"
$languageToolRoot = Join-Path $vendorRoot "languagetool"
$javaRoot = Join-Path $vendorRoot "jre"
$downloadRoot = Join-Path $vendorRoot ".downloads"

New-Item -ItemType Directory -Force -Path $vendorRoot, $downloadRoot | Out-Null

function Download-OfficialArchive([string]$url, [string]$destination) {
  if (Test-Path -LiteralPath $destination) { return }
  & curl.exe --fail --location --ssl-no-revoke --output $destination $url
  if ($LASTEXITCODE -ne 0) { throw "Не удалось скачать $url" }
}

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

Write-Host "LanguageTool и Java Runtime подготовлены в $vendorRoot"
