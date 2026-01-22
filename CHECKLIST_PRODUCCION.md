# ✅ CHECKLIST COMPLETO PARA PASO A PRODUCCIÓN
## VerbadocPro - FUNDAE Form Processing System

Fecha: 13 Enero 2026
Estado actual: Pre-producción

---

## 🎯 TAREAS COMPLETADAS HOY

### ✅ 1. **ERROR CRÍTICO LÍNEA 2269 - RESUELTO**
- **Problema**: Matching incorrecto permitía que "465" coincidiera con "45465"
- **Causa**: `.includes()` demasiado permisivo + campo de grupo incorrecto
- **Solución**:
  - Eliminado `.includes()` de matching
  - Cambiado orden de búsqueda: `codigo_grupo_detalle` primero, luego `num_grupo`
  - Solo coincidencias exactas ahora
- **Estado**: ✅ Desplegado en producción
- **Commit**: `8510ecc`

### ✅ 2. **FIX VISOR PDF - Campo Incorrecto**
- **Problema**: PDFs no se guardaban en `pdf_blob_url`, solo en `file_url`
- **Solución**: Actualizado endpoint `/api/extractions/upload.ts` para guardar en campo correcto
- **Estado**: ✅ Desplegado
- **Commit**: `9f27982`
- **Nota**: PDFs procesados ANTES del fix no tienen visor

### ✅ 3. **FIX DOCUMENTOS NO PROCESABLES**
- **Problema**: Documentos rechazados desaparecían (categoría inválida)
- **Solución**: Cambiado `expediente_no_existe` → `sin_referencia`
- **Estado**: ✅ Desplegado
- **Commit**: `7c2540f`

### ✅ 4. **FIX EXCEL MASTER - 45 Columnas**
- **Problema**: Solo generaba 19-22 columnas en vez de 45
- **Solución**: Reescrito download.ts para usar `column_mappings`
- **Estado**: ✅ Desplegado y funcionando
- **Commit**: Anterior

### ✅ 5. **Eliminado Código de Barras de Plantilla**
- **Problema**: Campo innecesario que causaba confusión
- **Solución**: Eliminado `codigo_barras` de `FUNDAE_SCHEMA`
- **Estado**: ✅ Desplegado
- **Commit**: `57935e6`

---

## 🚨 TAREAS URGENTES (Hacer ANTES de producción)

### 1. **VALIDAR PLANTILLA FUNDAE COMPLETA** ⏱️ 30 min
**Prioridad**: CRÍTICA
**Responsable**: Usuario + Claude

**Tareas**:
- [ ] Revisar todos los 100+ campos en `fundae-template.ts`
- [ ] Confirmar que nombres coinciden con PDFs reales
- [ ] Verificar tipos de datos (STRING, NUMBER, etc.)
- [ ] Probar con 5-10 formularios reales diferentes
- [ ] Documentar cualquier campo que falte o sobre

**Archivo**: `src/constants/fundae-template.ts`

**Preguntas para el usuario**:
- ¿Todos los formularios FUNDAE tienen la misma estructura?
- ¿Hay versiones diferentes del formulario?
- ¿Los campos de valoración siempre van del 1-10?

---

### 2. **CREAR 5 USUARIOS NORMADAT** ⏱️ 45 min
**Prioridad**: CRÍTICA
**Descripción**: Acceso restringido solo a `/review` y `/unprocessable`

**Usuarios a crear**:
```
nmd_01@verbadocpro.eu
nmd_02@verbadocpro.eu
nmd_03@verbadocpro.eu
nmd_04@verbadocpro.eu
nmd_05@verbadocpro.eu
```

**Permisos**:
- ✅ Ver `/review` (formularios con errores)
- ✅ Ver `/unprocessable` (documentos no procesables)
- ✅ Aprobar/rechazar formularios
- ✅ Corregir errores
- ❌ NO acceso a `/admin`
- ❌ NO acceso a cargar Excel de referencia
- ❌ NO acceso a `/master-excel/download` (solo visualizar)

**Implementación**:
1. Crear rol `reviewer` en base de datos
2. Añadir usuarios con rol `reviewer`
3. Modificar `ProtectedRoute` para permitir `reviewer` en rutas específicas
4. Añadir middleware de permisos

**Archivos a modificar**:
- `database/migrations/xxx_add_reviewer_role.sql`
- `src/contexts/AuthContext.tsx`
- `App.tsx` (rutas protegidas)

---

### 3. **IMPLEMENTAR LOGS DE ACCESO COMPLETOS** ⏱️ 2 horas
**Prioridad**: CRÍTICA (requisito legal)

**Información a registrar**:
- ✅ Quién (email del usuario)
- ✅ Cuándo (timestamp)
- ✅ Desde dónde (IP, navegador, ubicación)
- ✅ Qué acción (login, download, approve, reject, etc.)
- ✅ Recurso accedido (formulario ID, archivo, etc.)

**Tabla a crear**:
```sql
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  user_email VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL, -- 'login', 'download_excel', 'approve_form', etc.
  resource_type VARCHAR(50), -- 'extraction', 'excel_master', 'unprocessable'
  resource_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  location JSONB, -- {country, city, etc.}
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_access_logs_user ON access_logs(user_id);
CREATE INDEX idx_access_logs_action ON access_logs(action);
CREATE INDEX idx_access_logs_created ON access_logs(created_at DESC);
```

**Acciones a registrar**:
- `login` - Usuario inicia sesión
- `logout` - Usuario cierra sesión
- `view_review` - Acceso a /review
- `view_unprocessable` - Acceso a /unprocessable
- `view_master_excel` - Acceso a /master-excel
- `download_excel` - Descarga Excel Master
- `approve_form` - Aprueba formulario
- `reject_form` - Rechaza formulario
- `fix_error` - Corrige error
- `upload_reference` - Carga Excel de referencia (admin)

**Archivos a crear/modificar**:
- `database/migrations/xxx_create_access_logs.sql`
- `api/_lib/accessLogger.ts`
- Añadir logging en cada endpoint relevante

---

### 4. **ARREGLAR VISOR PDF USANDO SCRIPTORIUM** ⏱️ 3-4 horas
**Prioridad**: ALTA
**Referencia**: https://github.com/VCNPRO/scriptoriumIA

**Problema actual**:
- Visor usa `pdfjs-dist` básico
- No muestra highlights correctamente
- Rendimiento mejorable

**Solución**:
- Copiar implementación de Scriptorium
- Usar `react-pdf` o solución más robusta
- Añadir highlights para errores
- Sincronizar scroll PDF ↔ Panel de errores

**Archivos**:
- `src/components/PdfViewerProfessional.tsx` (reescribir)
- `src/components/ReviewPanel.tsx` (integración)

---

### 5. **SISTEMA DE BACKUP COMPLETO** ⏱️ 4-6 horas
**Prioridad**: CRÍTICA

**Componentes del sistema**:

#### A. Backup de Base de Datos
- [ ] **Vercel Postgres** - Configurar backups automáticos diarios
- [ ] Guardar en Vercel Blob Storage
- [ ] Retención: 30 días (diarios), 12 meses (mensuales)
- [ ] Script de restauración documentado

#### B. Backup del Excel Master
**Política de copias**:
- [ ] Copia automática cada vez que se añade un formulario
- [ ] Guardar con timestamp en nombre: `Master_YYYYMMDD_HHMMSS.xlsx`
- [ ] Ubicaciones (3 copias):
  1. **Vercel Blob Storage** (`/backups/excel/`)
  2. **GitHub** (repo privado `verbadocpro-backups`)
  3. **Local** (descargar semanalmente)

#### C. Backup de PDFs Procesados
- [ ] Vercel Blob ya guarda PDFs
- [ ] Verificar política de retención
- [ ] Plan de recuperación si se borra Blob accidentalmente

#### D. Backup del Código
- [x] GitHub (ya está)
- [ ] Tag de versión para cada release
- [ ] Branch `production` separado de `main`

**Script de Backup Automático**:
```typescript
// api/cron/backup.ts
- Ejecutar diariamente a las 3 AM
- Backup BD completo
- Backup Excel Master actual
- Verificar integridad
- Notificar por email si falla
```

**Plan de Recuperación de Desastres**:
- [ ] Documentar paso a paso cómo restaurar desde backup
- [ ] Probar restauración en entorno de pruebas
- [ ] Tiempo objetivo de recuperación (RTO): 4 horas
- [ ] Punto objetivo de recuperación (RPO): 24 horas

---

## ⚙️ TAREAS IMPORTANTES (Hacer después de urgentes)

### 6. **PRUEBAS DE CARGA** ⏱️ 2-3 horas
**Prioridad**: ALTA

**Escenarios a probar**:
- [ ] 100 formularios simultáneos
- [ ] 5 usuarios concurrentes descargando Excel
- [ ] Carga del Excel de referencia (2397 filas)
- [ ] 1000 formularios en base de datos

**Herramientas**:
- Apache JMeter
- k6.io
- Vercel Analytics

**Métricas objetivo**:
- Procesamiento de formulario: < 30 segundos
- Descarga de Excel: < 5 segundos
- API response time: < 2 segundos (p95)
- Uptime: 99.9%

---

### 7. **PRUEBAS DE CALIDAD (QA)** ⏱️ 4-6 horas
**Prioridad**: ALTA

**Test Cases**:
- [ ] **Happy Path**: Formulario correcto → Procesado → Excel Master
- [ ] **Formulario con errores**: → Review → Corregir → Excel Master
- [ ] **Formulario sin referencia**: → No procesable
- [ ] **Campos faltantes**: → No procesable
- [ ] **Múltiples archivos batch**: 50 formularios
- [ ] **Excel de referencia**: Actualizar y verificar
- [ ] **Permisos**: reviewer vs admin
- [ ] **Logs**: Verificar que se registran todas las acciones

**Navegadores a probar**:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Safari (si disponible)

**Dispositivos**:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (opcional)

---

### 8. **VALIDAR REVIEW PAGE COMPLETAMENTE** ⏱️ 1 hora
**Prioridad**: MEDIA

**Verificar**:
- [ ] Se muestran TODOS los formularios con errores
- [ ] Visor PDF funciona correctamente
- [ ] Se pueden corregir errores
- [ ] Botón "Aprobar" funciona
- [ ] Botón "Rechazar" funciona
- [ ] Botón "Anular" funciona
- [ ] Formularios aprobados van a Excel Master
- [ ] Formularios rechazados van a Unprocessable

---

## 📋 CONFIGURACIÓN Y DOCUMENTACIÓN

### 9. **DOCUMENTACIÓN TÉCNICA** ⏱️ 3-4 horas
**Prioridad**: MEDIA

**Documentos a crear**:
- [ ] `README_PRODUCCION.md` - Guía de producción
- [ ] `MANUAL_USUARIO.md` - Manual para Normadat users
- [ ] `MANUAL_ADMIN.md` - Manual para administradores
- [ ] `API_DOCUMENTATION.md` - Documentación de endpoints
- [ ] `TROUBLESHOOTING.md` - Problemas comunes y soluciones
- [ ] `BACKUP_RECOVERY.md` - Plan de recuperación

---

### 10. **VARIABLES DE ENTORNO PRODUCTION** ⏱️ 30 min
**Prioridad**: ALTA

**Verificar en Vercel**:
```
# Database
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Blob Storage
BLOB_READ_WRITE_TOKEN=

# Auth
JWT_SECRET=
SESSION_SECRET=

# API Keys
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Email (si aplica)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# Monitoring
SENTRY_DSN= (opcional)
```

---

## 🎯 CRITERIOS DE ACEPTACIÓN PARA PRODUCCIÓN

**La app está lista para producción cuando**:

### Funcionalidad
- [x] Procesamiento de formularios funciona al 100%
- [x] Excel Master se genera con todas las columnas
- [x] Validación contra Excel de referencia funciona
- [x] Formularios con errores van a Review
- [x] Documentos no procesables se registran
- [ ] Visor PDF funciona perfectamente
- [ ] 5 usuarios Normadat pueden acceder
- [ ] Logs de acceso se registran

### Seguridad
- [ ] HTTPS configurado
- [ ] Autenticación funciona
- [ ] Autorización por roles funciona
- [ ] Sesiones seguras
- [ ] Datos sensibles encriptados
- [ ] Rate limiting configurado
- [ ] CORS configurado correctamente

### Rendimiento
- [ ] Pruebas de carga pasadas
- [ ] Tiempo de respuesta < 2s (p95)
- [ ] No hay memory leaks
- [ ] Base de datos optimizada (índices)

### Backups
- [ ] Backup automático de BD configurado
- [ ] Backup de Excel Master configurado
- [ ] Plan de recuperación documentado y probado
- [ ] 3 copias del Excel de producción

### Monitoreo
- [ ] Logs de acceso funcionando
- [ ] Logs de errores configurados
- [ ] Alertas configuradas (email/Slack)
- [ ] Dashboard de métricas (opcional)

### Documentación
- [ ] Manual de usuario completado
- [ ] Manual de administrador completado
- [ ] Documentación técnica actualizada
- [ ] Plan de recuperación de desastres documentado

---

## 📞 CONTACTO Y SOPORTE

**En caso de problemas**:
1. Revisar `TROUBLESHOOTING.md`
2. Consultar logs en Vercel
3. Contactar a soporte técnico

**Responsables**:
- Desarrollo: Claude + Usuario
- Operaciones: Usuario
- Usuarios finales: Normadat team

---

## 📊 RESUMEN EJECUTIVO

### Completado Hoy (13 Enero 2026)
- ✅ Error crítico matching línea 2269 - RESUELTO
- ✅ Visor PDF campo incorrecto - CORREGIDO
- ✅ Documentos no procesables - CORREGIDO
- ✅ Excel Master 45 columnas - FUNCIONANDO
- ✅ Código de barras eliminado - HECHO

### Pendiente URGENTE (Antes de producción)
- ⏳ Validar plantilla FUNDAE completa
- ⏳ Crear 5 usuarios Normadat
- ⏳ Implementar logs de acceso
- ⏳ Arreglar visor PDF (Scriptorium)
- ⏳ Sistema de backup completo

### Estimación de Tiempo Total: **12-18 horas de desarrollo**
### Fecha objetivo de producción: **Depende de prioridades del usuario**

---

**Última actualización**: 13 Enero 2026 - 12:00 PM
**Versión del documento**: 1.0
**Estado del proyecto**: Pre-producción (90% completado)
