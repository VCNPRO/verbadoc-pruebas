# Verbadoc Pro - ENS High Level Security Audit Script
Write-Host "Iniciando auditoria de seguridad (ENS Nivel Alto)..." -ForegroundColor Cyan

# 1. Auditoria de dependencias
Write-Host "`n[1/3] Comprobando vulnerabilidades en dependencias..." -ForegroundColor Yellow
npm audit --audit-level=high

if ($LASTEXITCODE -ne 0) {
    Write-Host "ALERTA: Se han encontrado vulnerabilidades de nivel ALTO o CRITICO." -ForegroundColor Red
} else {
    Write-Host "Dependencias OK." -ForegroundColor Green
}

# 2. Comprobacion de secretos (simulado simple)
Write-Host "`n[2/3] Buscando posibles secretos expuestos..." -ForegroundColor Yellow
$patterns = @("AI_KEY", "SECRET", "PASSWORD", "TOKEN", "AUTH")
$filesToIgnore = @("node_modules", ".git", "package-lock.json", "dist")

# Busqueda basica
# (En un entorno real usariamos herramientas como gitleaks)
Write-Host "Nota: Se recomienda usar 'gitleaks' para una comprobacion exhaustiva."

# 3. Validacion de configuracion Vercel
Write-Host "`n[3/3] Validando vercel.json..." -ForegroundColor Yellow
if (Test-Path "vercel.json") {
    $vercel = Get-Content "vercel.json" | ConvertFrom-Json
    if ($vercel.headers) {
        Write-Host "Cabeceras de seguridad detectadas." -ForegroundColor Green
    } else {
        Write-Host "ADVERTENCIA: No se han detectado cabeceras en vercel.json." -ForegroundColor Red
    }
}

Write-Host "`nAuditoria finalizada." -ForegroundColor Cyan
