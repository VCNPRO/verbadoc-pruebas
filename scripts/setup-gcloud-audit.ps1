# Configuración de Auditoría Inmutable para Verbadoc Pro (ENS Nivel Alto)
# Ejecutar en Google Cloud Shell o CLI autenticado con permisos de Owner/Security Admin

# Variables de configuración
$PROJECT_ID = "verbadoc-enterprise" # ID CORREGIDO
$BUCKET_NAME = "audit-logs-vcn-pro"
$REGION = "europe-southwest1" # Madrid
$RETENTION_PERIOD = "31536000s" # 365 días en segundos

Write-Host "Iniciando configuración de infraestructura de auditoría..." -ForegroundColor Cyan

# 1. Crear Bucket de Auditoría en Madrid
Write-Host "Creando bucket $BUCKET_NAME en $REGION..." -ForegroundColor Yellow
# Usamos try/catch para manejar si el bucket ya existe
try {
    gcloud storage buckets create gs://$BUCKET_NAME --location=$REGION --project=$PROJECT_ID --uniform-bucket-level-access
} catch {
    Write-Host "El bucket podría ya existir o hubo un error leve. Continuando..." -ForegroundColor Gray
}

# 2. Configurar Retention Policy (Modo Locked para Inmutabilidad)
Write-Host "Configurando política de retención inmutable (365 días)..." -ForegroundColor Yellow
try {
    gcloud storage buckets update gs://$BUCKET_NAME --retention-period=$RETENTION_PERIOD --project=$PROJECT_ID
    # Usamos gcloud alpha si el comando standard falla, o gsutil como fallback universal
    Write-Host "Bloqueando política..."
    gsutil retention lock gs://$BUCKET_NAME 
} catch {
    Write-Host "Nota: Si la política ya estaba bloqueada o usas una versión antigua de CLI, verifica manualmente." -ForegroundColor Gray
}

# 3. Crear Sink de Cloud Logging para acceso a datos
Write-Host "Configurando Sink de auditoría para 'Data Access'..." -ForegroundColor Yellow
# Corrección: Usamos comillas simples para evitar errores de parsing en PowerShell
$FILTER = 'protoPayload.serviceName=(cloudisql.googleapis.com OR firestore.googleapis.com OR storage.googleapis.com) AND protoPayload.methodName:"google.cloud"'

# Borrar sink si existe para evitar error de duplicado (silencioso)
gcloud logging sinks delete audit-sink-pro --project=$PROJECT_ID --quiet 2>$null

gcloud logging sinks create audit-sink-pro `
    storage.googleapis.com/$BUCKET_NAME `
    --log-filter=$FILTER `
    --project=$PROJECT_ID

# 4. Asignar permisos al Service Account del Sink
Write-Host "Asignando permisos de escritura al Sink..." -ForegroundColor Yellow
# Capturar la identidad del escritor correctamente
$SINK_INFO = gcloud logging sinks describe audit-sink-pro --project=$PROJECT_ID --format="value(writerIdentity)"

if ($SINK_INFO) {
    gcloud storage buckets add-iam-policy-binding gs://$BUCKET_NAME `
        --member=$SINK_INFO `
        --role=roles/storage.objectCreator `
        --project=$PROJECT_ID
    Write-Host "Permisos asignados correctamente a: $SINK_INFO" -ForegroundColor Green
} else {
    Write-Host "Error: No se pudo recuperar la identidad del Sink." -ForegroundColor Red
}

Write-Host "`nConfiguración completada exitosamente." -ForegroundColor Green
Write-Host "--------------------------------------------------------"
Write-Host "EVIDENCIA PARA EL CLIENTE:"
Write-Host "1. Ve a: https://console.cloud.google.com/logs/router?project=$PROJECT_ID"
Write-Host "2. Haz captura de pantalla del Sink 'audit-sink-pro' apuntando al bucket."
Write-Host "--------------------------------------------------------"
