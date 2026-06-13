$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "Agent Desk setup" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Host ""
  Write-Host "Docker not found. Install Docker Desktop or use a hosted Postgres URL in .env" -ForegroundColor Yellow
  Write-Host "See scripts/SETUP.md for hosted database instructions."
  Write-Host ""
  Write-Host "Installing npm dependencies..."
  npm run install:all
  exit 0
}

Write-Host "Starting Docker services..."
docker compose up -d

Write-Host "Waiting for Postgres..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    docker compose exec -T postgres pg_isready -U agentdesk -d agentdesk 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 2
}

if (-not $ready) {
  Write-Host "Postgres did not become ready in time. Check: docker compose logs postgres" -ForegroundColor Red
  exit 1
}

Write-Host "Postgres is ready."
Write-Host "Installing npm dependencies..."
npm run install:all

Write-Host "Seeding database..."
npm run seed

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:5173"
Write-Host "  API:       http://localhost:3001"
Write-Host "  n8n:       http://localhost:5678"
Write-Host "  Login:     admin@agentdesk.local / admin123"
Write-Host ""
Write-Host "Run: npm run dev"
