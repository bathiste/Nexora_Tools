$env:PGPASSWORD = "postgres"
$pgPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$schemaPath = Join-Path $scriptPath "schema.sql"

Write-Host "=============================================================="
Write-Host "           PostgreSQL Database Setup"
Write-Host "=============================================================="
Write-Host ""

# Check if database exists
Write-Host "Checking if database 'gotham' exists..."
$exists = & $pgPath -U postgres -d postgres -c "SELECT 1 FROM pg_database WHERE datname='gotham';" -t 2>$null

if ($LASTEXITCODE -eq 0 -and $exists -match "1") {
    Write-Host "[OK] Database 'gotham' already exists."
} else {
    Write-Host "Database 'gotham' does not exist. Creating..."
    & $pgPath -U postgres -d postgres -c "CREATE DATABASE gotham;"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Database 'gotham' created successfully!"
    } else {
        Write-Host "[ERROR] Failed to create database."
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""

# Run schema
if (Test-Path $schemaPath) {
    Write-Host "Running database migrations..."
    & $pgPath -U postgres -d gotham -f $schemaPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Database migrations completed!"
    } else {
        Write-Host "[WARNING] Database migration may have failed."
    }
} else {
    Write-Host "No schema.sql found at $schemaPath, skipping migrations."
}

Write-Host ""
Write-Host "=============================================================="
Write-Host "  Database setup complete!"
Write-Host ""
Write-Host "  Database: gotham"
Write-Host "  Host: localhost"
Write-Host "  Port: 5432"
Write-Host "  User: postgres"
Write-Host ""
Write-Host "=============================================================="

$env:PGPASSWORD = $null
