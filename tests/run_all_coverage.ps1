$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$coverageRoot = Join-Path $repoRoot 'coverage'
$v8Coverage = Join-Path $coverageRoot 'v8'
New-Item -ItemType Directory -Force -Path $v8Coverage | Out-Null
Get-ChildItem -LiteralPath $v8Coverage -File | Remove-Item -Force

$env:NODE_V8_COVERAGE = $v8Coverage
node tests/frontend.test.cjs
$nodeStatus = $LASTEXITCODE
Remove-Item Env:NODE_V8_COVERAGE -ErrorAction SilentlyContinue
if ($nodeStatus -ne 0) { exit $nodeStatus }

node tests/make_lcov.cjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$pythonExe = Join-Path $repoRoot '.venv-1/Scripts/python.exe'
if (-not (Test-Path $pythonExe)) { $pythonExe = Join-Path $repoRoot '.venv/Scripts/python.exe' }
if (-not (Test-Path $pythonExe)) { throw 'Could not find the project virtual environment Python executable.' }
& $pythonExe tests/run_coverage.py
exit $LASTEXITCODE
