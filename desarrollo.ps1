param(
  [ValidateSet('setup', 'dev', 'verify', 'start')]
  [string]$Command = 'dev'
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$appRoot = Join-Path $projectRoot 'label-printer-web'
$nodeVersion = (Get-Content -LiteralPath (Join-Path $projectRoot '.node-version') -Raw).Trim()
if ($nodeVersion -notmatch '^24\.\d+\.\d+$') { throw 'Se requiere una version valida de Node 24 LTS en .node-version.' }
$projectPackage = Get-Content -LiteralPath (Join-Path $appRoot 'package.json') -Raw | ConvertFrom-Json
if ($projectPackage.packageManager -notmatch '^npm@(11\.\d+\.\d+)$') { throw 'packageManager debe fijar una version de npm 11.' }
$npmVersion = $Matches[1]
$toolsRoot = Join-Path $projectRoot '.tools'
$nodeRoot = Join-Path $toolsRoot "node-v$nodeVersion-win-x64"
$nodeExecutable = Join-Path $nodeRoot 'node.exe'
$npmRoot = Join-Path $toolsRoot 'npm'
$npmCli = Join-Path $npmRoot 'node_modules\npm\bin\npm-cli.js'

if ($Command -eq 'setup') {
  New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
  if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    $archiveName = "node-v$nodeVersion-win-x64.zip"
    $archivePath = Join-Path $toolsRoot $archiveName
    $releaseUrl = "https://nodejs.org/dist/v$nodeVersion"
    $checksums = (Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/SHASUMS256.txt").Content
    $checksumLine = $checksums -split '\r?\n' | Where-Object { $_ -match ('\s+' + [regex]::Escape($archiveName) + '$') }
    if (@($checksumLine).Count -ne 1) { throw 'No se encontro una suma oficial unica para Node.' }
    $expectedHash = ($checksumLine.Trim() -split '\s+')[0]
    Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/$archiveName" -OutFile $archivePath
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'La descarga de Node no coincide con su suma oficial.' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
  }
  $bundledNpm = Join-Path $nodeRoot 'node_modules\npm\bin\npm-cli.js'
  & $nodeExecutable $bundledNpm install --prefix $npmRoot "npm@$npmVersion" --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar npm en el entorno local.' }
} elseif (-not (Test-Path -LiteralPath $nodeExecutable) -or -not (Test-Path -LiteralPath $npmCli)) {
  throw 'Prepara el entorno con: .\desarrollo.ps1 setup'
}

$previousPath = $env:PATH
$env:PATH = (Join-Path $npmRoot 'node_modules\.bin') + ';' + $nodeRoot + ';' + $previousPath
Push-Location $appRoot
try {
  & $nodeExecutable --version
  & $nodeExecutable $npmCli --version
  if ($Command -eq 'setup') { & $nodeExecutable $npmCli ci }
  elseif ($Command -eq 'start') { & $nodeExecutable $npmCli start }
  else { & $nodeExecutable $npmCli run $Command }
  $commandExitCode = $LASTEXITCODE
} finally {
  Pop-Location
  $env:PATH = $previousPath
}
exit $commandExitCode
