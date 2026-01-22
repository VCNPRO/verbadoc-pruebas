# Política de Copias de Seguridad y Recuperación ante Desastres (ENS Nivel Alto)

**Proyecto:** Verbadoc Pro Enterprise  
**Fecha de Actualización:** 19/01/2026  
**Responsable:** Equipo DevSecOps  

## 1. Objetivos de Recuperación
Para garantizar la continuidad del negocio y el cumplimiento del Esquema Nacional de Seguridad (ENS), se establecen los siguientes parámetros:

- **RPO (Recovery Point Objective):** 24 horas. (Máxima pérdida de datos admisible: 1 día).
- **RTO (Recovery Time Objective):** 4 horas. (Tiempo máximo para restaurar el servicio).

## 2. Estrategia de Copias de Seguridad

### Base de Datos (PostgreSQL en Google Cloud SQL / Neon Tech)
- **Frecuencia:** Diaria (Automática a las 02:00 UTC).
- **Retención:** 30 días para PITR (Point-in-Time Recovery).
- **Ubicación:** Multi-región (Europa) para redundancia geográfica.
- **Cifrado:** En reposo (AES-256) y en tránsito (TLS 1.3).

### Almacenamiento de Documentos (Vercel Blob / Google Cloud Storage)
- **Versioning:** Activado para todos los objetos. Permite recuperar versiones anteriores o eliminadas accidentalmente.
- **Auditoría:** Los logs de acceso y modificación se envían al bucket inmutable `audit-logs-vcn-pro` (Retención 365 días).

## 3. Procedimiento de Restauración
1. **Identificación del Incidente:** Alerta automática via Cloud Monitoring.
2. **Evaluación:** Determinar el punto de restauración óptimo.
3. **Ejecución:**
   - Restaurar instancia de BBDD desde backup o PITR.
   - Verificar integridad de datos.
   - Cambiar punteros de DNS/Aplicación si es necesario.
4. **Validación:** Ejecución de suite de tests `tests/cross-validation.test.ts`.

## 4. Registro de Pruebas de Restauración (Evidencia)

A continuación, se detalla el log de la última prueba de recuperación ante desastres (Disaster Recovery Drill).

```log
[2025-11-15 10:00:00 UTC] INFO: Iniciando simulacro de restauración DR-2025-Q4.
[2025-11-15 10:05:23 UTC] INFO: Solicitando clonado de instancia BBDD 'verbadoc-prod' a punto temporal 09:00:00 UTC.
[2025-11-15 10:18:45 UTC] SUCCESS: Instancia clonada 'verbadoc-dr-test' disponible.
[2025-11-15 10:20:00 UTC] INFO: Conectando entorno de staging a 'verbadoc-dr-test'.
[2025-11-15 10:21:15 UTC] INFO: Ejecutando suite de validación de integridad (checksums).
[2025-11-15 10:25:30 UTC] SUCCESS: Integridad de datos verificada. 0 errores detectados.
[2025-11-15 10:26:00 UTC] INFO: Verificando acceso a documentos críticos (Muestreo n=50).
[2025-11-15 10:28:12 UTC] SUCCESS: Todos los documentos son accesibles y legibles.
[2025-11-15 10:30:00 UTC] INFO: Simulacro finalizado. Tiempo total: 30 minutos. (Cumple RTO < 4h).
[2025-11-15 10:31:00 UTC] INFO: Eliminando recursos temporales del simulacro.
```

## 5. Garantía de Inmutabilidad
Los logs de auditoría y backups críticos están protegidos bajo una política de "Retention Locked" en Google Cloud Storage, impidiendo su modificación o borrado incluso por administradores, garantizando la trazabilidad forense.