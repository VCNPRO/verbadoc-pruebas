# 🗄️ GUÍA DE MIGRACIONES - VERBADOCPRO

## 📋 ¿Qué son las migraciones?

Las **migraciones** son scripts SQL que crean o modifican la estructura de la base de datos (tablas, índices, triggers, etc.).

Esta guía te enseña cómo ejecutar la migración que crea las 3 tablas nuevas para el sistema de procesamiento de formularios FUNDAE.

---

## 📁 Archivos Creados

```
verbadocpro/
├── database/
│   ├── migrations/
│   │   └── 001_create_extraction_tables.sql   ← SQL con CREATE TABLE
│   ├── runMigration.ts                         ← Script para ejecutar migraciones
│   └── README_MIGRACIONES.md                   ← Esta guía
│
└── src/
    └── lib/
        └── extractionDB.ts                     ← Servicio TypeScript para CRUD
```

---

## 🎯 ¿Qué crea la migración 001?

### Tablas creadas:

1. **`extraction_results`** - Almacena todos los formularios procesados
   - Datos extraídos (JSON)
   - Estado de validación
   - Validación cruzada con Excel del cliente
   - Modelo IA usado
   - Correcciones manuales

2. **`validation_errors`** - Errores detectados en cada formulario
   - Tipo de error (formato, rango, múltiples respuestas, etc.)
   - Campo con error
   - Valor inválido y corrección sugerida
   - Posición en el PDF (para resaltar)
   - Estado de resolución

3. **`email_notifications`** - Log de emails enviados
   - Destinatario
   - Tipo de notificación
   - Estado (enviado, fallido, pendiente)
   - Proveedor (Resend, etc.)

### Extras:

- ✅ **Índices** para búsquedas rápidas
- ✅ **Triggers** para auto-actualizar `updated_at` y contador de errores
- ✅ **Foreign keys** para integridad referencial
- ✅ **Comentarios** en tablas y columnas para documentación

---

## 🚀 OPCIÓN 1: Ejecutar desde Vercel Dashboard (Recomendado)

### Paso 1: Acceder a Vercel Postgres

1. Ve a: https://vercel.com/solammedia-9886s-projects/verbadocpro
2. Click en **"Storage"** en el menú lateral
3. Click en tu base de datos **"Vercel Postgres"**
4. Click en **"Query"** (pestaña arriba)

### Paso 2: Copiar el SQL

1. Abre el archivo `database/migrations/001_create_extraction_tables.sql`
2. **Copia TODO el contenido** (Ctrl+A, Ctrl+C)

### Paso 3: Ejecutar el SQL

1. **Pega el SQL** en el editor de Vercel
2. Click en **"Run Query"** (botón azul)
3. Espera 5-10 segundos
4. Verás: ✅ **"Query executed successfully"**

### Paso 4: Verificar que se crearon las tablas

Ejecuta este SQL para verificar:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('extraction_results', 'validation_errors', 'email_notifications')
ORDER BY table_name;
```

Deberías ver las 3 tablas listadas.

---

## 🖥️ OPCIÓN 2: Ejecutar desde tu computadora (Avanzado)

### Requisitos previos:

- Node.js instalado
- Variables de entorno configuradas (`.env.local`)

### Paso 1: Instalar dependencias

```bash
npm install tsx --save-dev
```

### Paso 2: Configurar variables de entorno

Crea o verifica `.env.local`:

```bash
# Estas variables ya deberían existir en tu .env.local
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
```

**Copiarlas desde Vercel:**

1. Ve a: https://vercel.com/solammedia-9886s-projects/verbadocpro
2. Click en **"Settings"**
3. Click en **"Environment Variables"**
4. Busca las variables `POSTGRES_*`
5. Cópialas a tu `.env.local`

### Paso 3: Ejecutar el script de migración

```bash
npx tsx database/runMigration.ts
```

**Salida esperada:**

```
╔════════════════════════════════════════════════════════════╗
║  VERBADOCPRO - Sistema de Migraciones de Base de Datos    ║
╚════════════════════════════════════════════════════════════╝

🔌 Probando conexión a Vercel Postgres...
✅ Conexión exitosa! Hora del servidor: 2026-01-08 12:34:56

🚀 Ejecutando migración: 001_create_extraction_tables.sql
📝 Ejecutando 25 statements...
✅ Statement 1/25 ejecutado
✅ Statement 2/25 ejecutado
...
✅ Migración 001_create_extraction_tables.sql completada

╔════════════════════════════════════════════════════════════╗
║  ✅ TODAS LAS MIGRACIONES COMPLETADAS                      ║
╚════════════════════════════════════════════════════════════╝

🔍 Verificando tablas creadas...

📊 Tablas encontradas:
   ✅ extraction_results
   ✅ validation_errors
   ✅ email_notifications

✅ Base de datos lista para usar!
```

---

## 🔍 Verificación Manual

### Ver esquema de las tablas:

```sql
-- Ver columnas de extraction_results
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'extraction_results'
ORDER BY ordinal_position;

-- Ver columnas de validation_errors
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'validation_errors'
ORDER BY ordinal_position;

-- Ver columnas de email_notifications
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'email_notifications'
ORDER BY ordinal_position;
```

### Ver índices creados:

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('extraction_results', 'validation_errors', 'email_notifications');
```

### Ver triggers creados:

```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('extraction_results', 'validation_errors');
```

---

## 🧪 Probar las Tablas

### Insertar un registro de prueba:

```sql
-- Primero necesitas el ID de un usuario existente
SELECT id, email FROM users LIMIT 1;

-- Insertar extracción de prueba (reemplaza 'tu-user-id-aqui' con el ID real)
INSERT INTO extraction_results (
  user_id,
  filename,
  extracted_data,
  model_used,
  validation_status
) VALUES (
  'tu-user-id-aqui',
  'formulario_prueba.pdf',
  '{"cif": "B12345678", "nombre": "Empresa Test"}',
  'gemini-2.5-flash',
  'pending'
) RETURNING *;
```

### Ver el registro insertado:

```sql
SELECT * FROM extraction_results ORDER BY created_at DESC LIMIT 1;
```

### Limpiar datos de prueba:

```sql
DELETE FROM extraction_results WHERE filename = 'formulario_prueba.pdf';
```

---

## 🔧 Usar el Servicio TypeScript

Una vez creadas las tablas, puedes usar el servicio desde tu código:

```typescript
import { ExtractionResultDB, ValidationErrorDB } from '../src/lib/extractionDB';

// Crear una extracción
const extraction = await ExtractionResultDB.create({
  userId: user.id,
  filename: 'formulario_001.pdf',
  extractedData: {
    cif: 'B12345678',
    expediente: 'FUNDAE2024-001',
    dni: '12345678A',
    valoracion: {
      pregunta1: 4,
      pregunta2: 3
    }
  },
  modelUsed: 'gemini-2.5-flash',
  processingTimeMs: 35000
});

console.log('Extracción creada:', extraction.id);

// Crear errores de validación
await ValidationErrorDB.create({
  extractionId: extraction.id,
  fieldName: 'valoracion.pregunta3',
  errorType: 'multiple_answers',
  errorMessage: 'Se detectaron múltiples respuestas (2, 3)',
  invalidValue: '[2, 3]',
  suggestedCorrection: 'NC'
});

// Obtener extracciones que necesitan revisión
const needsReview = await ExtractionResultDB.findNeedingReview(user.id);
console.log(`Formularios pendientes: ${needsReview.length}`);
```

---

## ❌ Solución de Problemas

### Error: "relation already exists"

✅ **Normal** - La tabla ya existe. Puedes ignorar este error o ejecutar:

```sql
DROP TABLE IF EXISTS email_notifications CASCADE;
DROP TABLE IF EXISTS validation_errors CASCADE;
DROP TABLE IF EXISTS extraction_results CASCADE;
```

Y luego volver a ejecutar la migración.

### Error: "permission denied"

❌ No tienes permisos. Verifica que:
- Estás usando las variables `POSTGRES_URL` correctas
- Estás conectado a la BD correcta de Vercel

### Error: "column does not exist"

❌ La migración no se ejecutó completamente. Ejecuta:

```sql
-- Ver qué tablas existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

Y elimina las tablas incompletas para volver a empezar.

---

## 🎯 Próximos Pasos

Una vez ejecutada la migración:

1. ✅ **Modificar App.tsx** para guardar en BD en lugar de localStorage
2. ✅ **Crear API endpoints** para CRUD de extracciones
3. ✅ **Integrar validación con reglas** en el flujo de procesamiento
4. ✅ **Crear el Front de Revisión** (`/review`)
5. ✅ **Configurar emails automáticos** con Resend

---

## 📚 Referencias

- **Vercel Postgres Docs**: https://vercel.com/docs/storage/vercel-postgres
- **PostgreSQL JSON Functions**: https://www.postgresql.org/docs/current/functions-json.html
- **SQL Tutorial**: https://www.postgresql.org/docs/current/tutorial.html

---

**Fecha:** 2026-01-08
**Proyecto:** verbadocpro
**Autor:** Claude Sonnet 4.5
