# 🏗️ ARQUITECTURA BASE DE DATOS Y FRONT DE REVISIÓN

## 📊 ESTADO ACTUAL DE LA APP

### ✅ Lo que YA EXISTE

**Base de datos: Vercel Postgres (PostgreSQL serverless)**
- ✅ **Segura**: Conexiones SSL/TLS encriptadas
- ✅ **Privada**: Solo accesible desde el backend de Vercel
- ✅ **Autenticada**: Sistema de usuarios con roles (admin/user)
- ✅ **Región**: Europa (GDPR compliant)

**Tablas actuales:**
1. **`users`** - Usuarios autenticados (email, password hash, role, client_id)
2. **`transcriptions`** - Transcripciones de audio/documentos
3. **`transcription_jobs`** - Cola de trabajos de procesamiento

**Autenticación:**
- ✅ Login/registro con JWT en cookies httpOnly
- ✅ Roles: `admin` (tú) y `user` (clientes)
- ✅ Protección CSRF

---

### ❌ PROBLEMA CRÍTICO: Datos en localStorage

**Actualmente (App.tsx líneas 79-98):**
```typescript
// ❌ INSEGURO - Datos solo en el navegador del cliente
localStorage.setItem('verbadoc-history', JSON.stringify(history));
```

**Problemas:**
1. ❌ **No hay persistencia real** - Si borras cache, pierdes TODO
2. ❌ **No hay seguridad** - Cualquiera con acceso al navegador puede ver/modificar
3. ❌ **No hay backups** - Si se borra, se pierde para siempre
4. ❌ **No hay acceso multiusuario** - Cada navegador tiene sus propios datos
5. ❌ **No puedes acceder desde otro dispositivo**
6. ❌ **No hay auditoría** - No sabes quién modificó qué y cuándo

---

## 🎯 SOLUCIÓN: Migrar a Base de Datos Real

### Nueva Estructura de Tablas

#### Tabla 1: `extraction_results` (Formularios procesados)

```sql
CREATE TABLE extraction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Metadata del archivo
  filename VARCHAR(500) NOT NULL,
  file_url TEXT, -- URL en Vercel Blob Storage
  file_type VARCHAR(50), -- 'application/pdf', 'image/jpeg', etc.
  file_size_bytes INTEGER,
  page_count INTEGER DEFAULT 1,

  -- Datos extraídos (JSON flexible)
  extracted_data JSONB NOT NULL,

  -- Validación
  validation_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'valid', 'invalid', 'needs_review'
  validation_errors JSONB, -- Array de errores encontrados

  -- Validación cruzada con Excel del cliente
  excel_validation_status VARCHAR(50), -- 'valid', 'rejected', 'not_found'
  excel_matched_record JSONB, -- Registro del Excel maestro que coincide
  rejection_reason TEXT, -- Motivo de rechazo si excel_validation_status = 'rejected'

  -- Procesamiento
  model_used VARCHAR(100), -- 'gemini-2.5-flash', etc.
  processing_time_ms INTEGER,
  confidence_score DECIMAL(3,2), -- 0.00 a 1.00

  -- Correcciones manuales
  has_corrections BOOLEAN DEFAULT FALSE,
  corrected_by_user_id UUID REFERENCES users(id),
  corrected_at TIMESTAMP,
  correction_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Índices para búsquedas rápidas
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_corrector FOREIGN KEY (corrected_by_user_id) REFERENCES users(id)
);

-- Índices para performance
CREATE INDEX idx_extraction_user_id ON extraction_results(user_id);
CREATE INDEX idx_extraction_validation_status ON extraction_results(validation_status);
CREATE INDEX idx_extraction_created_at ON extraction_results(created_at DESC);
CREATE INDEX idx_extraction_needs_review ON extraction_results(validation_status) WHERE validation_status = 'needs_review';

-- Índice GIN para búsquedas en JSON
CREATE INDEX idx_extraction_data ON extraction_results USING GIN (extracted_data);
```

#### Tabla 2: `validation_errors` (Errores para revisión)

```sql
CREATE TABLE validation_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID NOT NULL REFERENCES extraction_results(id) ON DELETE CASCADE,

  -- Detalles del error
  field_name VARCHAR(200) NOT NULL, -- 'cif', 'edad', 'valoracion.pregunta1', etc.
  error_type VARCHAR(100) NOT NULL, -- 'invalid_format', 'out_of_range', 'multiple_answers', 'missing_required', etc.
  error_message TEXT NOT NULL,

  -- Valor problemático
  invalid_value TEXT,
  expected_format TEXT,

  -- Posición en el documento (para resaltar)
  page_number INTEGER,
  field_position JSONB, -- {x, y, width, height} para resaltar en el PDF

  -- Resolución
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'fixed', 'ignored'
  resolved_by_user_id UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  corrected_value TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_validation_errors_extraction ON validation_errors(extraction_id);
CREATE INDEX idx_validation_errors_status ON validation_errors(status);
```

#### Tabla 3: `email_notifications` (Log de emails enviados)

```sql
CREATE TABLE email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID REFERENCES extraction_results(id) ON DELETE SET NULL,

  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  notification_type VARCHAR(100) NOT NULL, -- 'needs_review', 'batch_completed', etc.

  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMP,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_notifications_status ON email_notifications(status);
CREATE INDEX idx_email_notifications_extraction ON email_notifications(extraction_id);
```

---

## 🔒 SEGURIDAD: Solo Acceso Autorizado

### 1. Autenticación a Nivel de API

**Todos los endpoints requieren autenticación:**

```typescript
// middleware/auth.ts
import { verify } from 'jsonwebtoken';

export async function requireAuth(req: Request): Promise<User> {
  const token = req.cookies.get('auth-token');

  if (!token) {
    throw new Error('No autenticado');
  }

  const user = await verify(token, process.env.JWT_SECRET!);
  return user;
}

export async function requireAdmin(req: Request): Promise<User> {
  const user = await requireAuth(req);

  if (user.role !== 'admin') {
    throw new Error('Requiere permisos de administrador');
  }

  return user;
}
```

### 2. Row-Level Security (RLS)

**Cada usuario solo ve sus propios datos:**

```sql
-- Habilitar RLS en la tabla
ALTER TABLE extraction_results ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios solo ven sus propias extracciones
CREATE POLICY user_extraction_policy ON extraction_results
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- Política: Solo admins pueden ver TODO
CREATE POLICY admin_extraction_policy ON extraction_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = current_setting('app.current_user_id')::UUID
      AND role = 'admin'
    )
  );
```

### 3. Variables de Entorno Seguras

**En Vercel Dashboard → Settings → Environment Variables:**

```bash
# Base de datos (ya configurada automáticamente)
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."

# JWT para autenticación
JWT_SECRET="tu-secreto-aleatorio-muy-largo-y-seguro-aqui"

# Email (Resend, SendGrid, o Gmail SMTP)
RESEND_API_KEY="re_..."
NOTIFICATION_EMAIL="notificaciones@verbadocpro.eu"
CLIENT_REVIEW_EMAIL="cliente@empresa.com"

# Google Cloud (ya configuradas)
GOOGLE_APPLICATION_CREDENTIALS="..."
VITE_GEMINI_PROJECT_ID="..."
```

---

## 🖥️ FRONT WEB DE REVISIÓN Y CORRECCIÓN

### Requisitos del Cliente

1. **Visor del documento a la izquierda**
2. **Puntos numerados a corregir a la derecha**
3. **Editar y guardar en la BD en tiempo real**
4. **Email automático cuando se carga un archivo para corregir**
5. **Siempre disponible** (URL dedicada)

---

### Diseño de la Interfaz

```
┌─────────────────────────────────────────────────────────────────┐
│ 📄 VerbadocPro - Panel de Revisión                              │
│ Usuario: admin@verbadocpro.eu | Formularios pendientes: 3    🔔 │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────┬────────────────────────────────┐
│ 📄 DOCUMENTO                    │ ✏️ CORRECCIONES (3 pendientes) │
│                                │                                │
│ ┌────────────────────────────┐ │ ┌────────────────────────────┐ │
│ │                            │ │ │ 1. ❌ CIF inválido          │ │
│ │   [PDF Viewer]             │ │ │    Campo: empresa.cif      │ │
│ │                            │ │ │    Valor: "B1234567"       │ │
│ │   Formulario FUNDAE        │ │ │    Error: Dígito control   │ │
│ │   Página 1 de 2            │ │ │    📍 Página 1, línea 5    │ │
│ │                            │ │ │                            │ │
│ │   [Código barras visible]  │ │ │    Nuevo valor:            │ │
│ │   *156$24$7048$02*         │ │ │    [B12345678_____]        │ │
│ │                            │ │ │    [✓ Corregir] [↷ Saltar] │ │
│ │                            │ │ │                            │ │
│ │                            │ │ ├────────────────────────────┤ │
│ │   ⬅️ Anterior  Siguiente ➡️  │ │ │ 2. ⚠️ Múltiples respuestas │ │
│ └────────────────────────────┘ │ │    Campo: valoracion.p3    │ │
│                                │ │    Valores: [2, 3]         │ │
│ Archivo: formulario_001.pdf    │ │    Regla: Solo 1 respuesta │ │
│ 2 páginas | 2.3 MB             │ │ │    📍 Página 2, pregunta 3│ │
│                                │ │ │                            │ │
│                                │ │ │    ⭕ Marcar como NC       │ │
│                                │ │ │    O seleccionar:          │ │
│                                │ │ │    ( ) 2  ( ) 3            │ │
│                                │ │ │    [✓ Guardar] [↷ Saltar]  │ │
│                                │ │ │                            │ │
│                                │ │ ├────────────────────────────┤ │
│                                │ │ │ 3. ⚠️ Edad fuera de rango  │ │
│                                │ │ │    Campo: participante.edad│ │
│                                │ │ │    Valor: "150"            │ │
│                                │ │ │    Esperado: 16-99         │ │
│                                │ │ │                            │ │
│                                │ │ │    Corregir edad:          │ │
│                                │ │ │    [___15___]              │ │
│                                │ │ │    [✓ Corregir] [↷ Saltar] │ │
│                                │ │ └────────────────────────────┘ │
│                                │                                │
└────────────────────────────────┴────────────────────────────────┘

[⬅️ Formulario anterior]    [Descartar formulario]    [✅ Aprobar todo] [➡️ Siguiente formulario]
```

---

### Componente React: ReviewPanel.tsx

```typescript
/**
 * PANEL DE REVISIÓN Y CORRECCIÓN
 * components/ReviewPanel.tsx
 */

import React, { useState, useEffect } from 'react';
import { PdfViewer } from './PdfViewer';
import { ValidationErrorsList } from './ValidationErrorsList';

interface ReviewPanelProps {
  extractionId: string;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ extractionId }) => {
  const [extraction, setExtraction] = useState<any>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadExtraction();
  }, [extractionId]);

  const loadExtraction = async () => {
    setIsLoading(true);
    try {
      // Llamar a la API
      const response = await fetch(`/api/extractions/${extractionId}`);
      const data = await response.json();

      setExtraction(data.extraction);
      setErrors(data.errors);
    } catch (error) {
      console.error('Error al cargar extracción:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCorrectError = async (errorId: string, correctedValue: string) => {
    try {
      // Guardar corrección en la BD
      const response = await fetch(`/api/validation-errors/${errorId}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctedValue })
      });

      if (response.ok) {
        // Actualizar UI
        setErrors(errors.filter(e => e.id !== errorId));

        // Pasar al siguiente error
        if (currentErrorIndex < errors.length - 1) {
          setCurrentErrorIndex(currentErrorIndex + 1);
        }

        alert('✅ Corrección guardada en la base de datos');
      }
    } catch (error) {
      console.error('Error al guardar corrección:', error);
      alert('❌ Error al guardar corrección');
    }
  };

  const handleMarkAsNC = async (errorId: string) => {
    // Marcar campo como "NC" (No Contesta)
    await handleCorrectError(errorId, 'NC');
  };

  const handleApproveAll = async () => {
    if (!confirm('¿Aprobar formulario sin correcciones?')) return;

    try {
      await fetch(`/api/extractions/${extractionId}/approve`, {
        method: 'POST'
      });

      alert('✅ Formulario aprobado');
      // Navegar al siguiente
    } catch (error) {
      console.error('Error al aprobar:', error);
    }
  };

  const handleReject = async () => {
    if (!confirm('¿Rechazar este formulario permanentemente?')) return;

    try {
      await fetch(`/api/extractions/${extractionId}/reject`, {
        method: 'POST'
      });

      alert('❌ Formulario rechazado');
      // Navegar al siguiente
    } catch (error) {
      console.error('Error al rechazar:', error);
    }
  };

  if (isLoading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="review-panel grid grid-cols-2 gap-4">
      {/* Columna izquierda: Visor PDF */}
      <div className="pdf-viewer-column">
        <h2>📄 Documento</h2>
        <PdfViewer
          fileUrl={extraction.file_url}
          highlightPage={errors[currentErrorIndex]?.page_number}
          highlightPosition={errors[currentErrorIndex]?.field_position}
        />
        <p className="text-sm text-gray-500">
          {extraction.filename} | {extraction.page_count} páginas
        </p>
      </div>

      {/* Columna derecha: Errores y correcciones */}
      <div className="corrections-column">
        <h2>✏️ Correcciones ({errors.length} pendientes)</h2>

        {errors.length === 0 ? (
          <div className="text-green-600">
            ✅ No hay errores. Puedes aprobar el formulario.
          </div>
        ) : (
          <div className="space-y-4">
            {errors.map((error, index) => (
              <ErrorCorrectionCard
                key={error.id}
                error={error}
                index={index + 1}
                isActive={index === currentErrorIndex}
                onCorrect={(value) => handleCorrectError(error.id, value)}
                onMarkAsNC={() => handleMarkAsNC(error.id)}
                onSkip={() => setCurrentErrorIndex(index + 1)}
              />
            ))}
          </div>
        )}

        {/* Botones de acción */}
        <div className="actions mt-6 flex gap-4">
          <button onClick={handleReject} className="btn-reject">
            Descartar formulario
          </button>
          <button onClick={handleApproveAll} className="btn-approve">
            ✅ Aprobar todo
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

### API Endpoints Necesarios

```typescript
/**
 * API ENDPOINTS PARA REVISIÓN
 * api/extractions/[id].ts
 */

import { requireAuth } from '../../middleware/auth';

// GET /api/extractions/:id
export async function GET(req: Request) {
  const user = await requireAuth(req);
  const { id } = req.params;

  // Obtener extracción con sus errores
  const extraction = await sql`
    SELECT * FROM extraction_results WHERE id = ${id}
  `;

  const errors = await sql`
    SELECT * FROM validation_errors
    WHERE extraction_id = ${id} AND status = 'pending'
    ORDER BY created_at ASC
  `;

  return { extraction: extraction.rows[0], errors: errors.rows };
}

// POST /api/extractions/:id/approve
export async function approveExtraction(req: Request) {
  const user = await requireAuth(req);
  const { id } = req.params;

  await sql`
    UPDATE extraction_results
    SET validation_status = 'valid',
        has_corrections = TRUE,
        corrected_by_user_id = ${user.id},
        corrected_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;

  return { success: true };
}

// POST /api/validation-errors/:id/fix
export async function fixError(req: Request) {
  const user = await requireAuth(req);
  const { id } = req.params;
  const { correctedValue } = await req.json();

  // Actualizar error
  await sql`
    UPDATE validation_errors
    SET status = 'fixed',
        corrected_value = ${correctedValue},
        resolved_by_user_id = ${user.id},
        resolved_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;

  // Actualizar el campo en extracted_data
  const error = await sql`SELECT * FROM validation_errors WHERE id = ${id}`;
  const fieldName = error.rows[0].field_name;
  const extractionId = error.rows[0].extraction_id;

  await sql`
    UPDATE extraction_results
    SET extracted_data = jsonb_set(
      extracted_data,
      ${`{${fieldName.split('.').join(',')}}`},
      ${JSON.stringify(correctedValue)}
    )
    WHERE id = ${extractionId}
  `;

  return { success: true };
}
```

---

## 📧 SISTEMA DE NOTIFICACIONES POR EMAIL

### Cuándo Enviar Emails

1. **Cuando se detectan errores de validación** → Email inmediato al cliente
2. **Resumen diario** → Email a las 18:00 con formularios pendientes
3. **Batch completado** → Email cuando termina un lote de 1000 formularios

### Configuración con Resend (Recomendado)

**Por qué Resend:**
- ✅ Fácil de usar
- ✅ 100 emails/día gratis (3,000/mes)
- ✅ Excelente deliverability
- ✅ API simple
- ✅ Soporta HTML + attachments

**Instalación:**
```bash
npm install resend
```

**Configuración en Vercel:**
```bash
# Variables de entorno en Vercel Dashboard
RESEND_API_KEY="re_123456789..."
NOTIFICATION_EMAIL="notificaciones@verbadocpro.eu"
CLIENT_REVIEW_EMAIL="cliente@empresa.com"
```

### Servicio de Email

```typescript
/**
 * SERVICIO DE NOTIFICACIONES POR EMAIL
 * services/emailService.ts
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  /**
   * Enviar email cuando hay errores que requieren revisión
   */
  static async notifyNeedsReview(extraction: any, errors: any[]) {
    const reviewUrl = `https://www.verbadocpro.eu/review/${extraction.id}`;

    const emailHtml = `
      <h2>📋 Nuevo formulario requiere revisión</h2>

      <p><strong>Archivo:</strong> ${extraction.filename}</p>
      <p><strong>Fecha:</strong> ${new Date(extraction.created_at).toLocaleString('es-ES')}</p>
      <p><strong>Errores detectados:</strong> ${errors.length}</p>

      <h3>Errores encontrados:</h3>
      <ul>
        ${errors.map(e => `
          <li>
            <strong>${e.field_name}:</strong> ${e.error_message}
            <br><small>Valor: "${e.invalid_value}"</small>
          </li>
        `).join('')}
      </ul>

      <p>
        <a href="${reviewUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          🔍 Revisar y Corregir
        </a>
      </p>

      <hr>
      <p style="color: #666; font-size: 12px;">
        VerbadocPro - Sistema automatizado de procesamiento de formularios FUNDAE
      </p>
    `;

    try {
      const result = await resend.emails.send({
        from: 'VerbadocPro <notificaciones@verbadocpro.eu>',
        to: process.env.CLIENT_REVIEW_EMAIL!,
        subject: `📋 Formulario requiere revisión: ${extraction.filename}`,
        html: emailHtml
      });

      // Guardar log del email
      await sql`
        INSERT INTO email_notifications (extraction_id, recipient_email, subject, notification_type, status, sent_at)
        VALUES (${extraction.id}, ${process.env.CLIENT_REVIEW_EMAIL}, ${`Formulario requiere revisión: ${extraction.filename}`}, 'needs_review', 'sent', CURRENT_TIMESTAMP)
      `;

      console.log('✅ Email enviado:', result.id);
      return result;

    } catch (error) {
      console.error('❌ Error al enviar email:', error);

      // Guardar error en BD
      await sql`
        INSERT INTO email_notifications (extraction_id, recipient_email, subject, notification_type, status, error_message)
        VALUES (${extraction.id}, ${process.env.CLIENT_REVIEW_EMAIL}, ${`Formulario requiere revisión`}, 'needs_review', 'failed', ${error.message})
      `;

      throw error;
    }
  }

  /**
   * Resumen diario de formularios pendientes
   */
  static async sendDailySummary() {
    const pendingExtractions = await sql`
      SELECT COUNT(*) as count
      FROM extraction_results
      WHERE validation_status = 'needs_review'
    `;

    const count = pendingExtractions.rows[0].count;

    if (count === 0) {
      console.log('No hay formularios pendientes');
      return;
    }

    const emailHtml = `
      <h2>📊 Resumen diario - VerbadocPro</h2>

      <p><strong>Formularios pendientes de revisión:</strong> ${count}</p>

      <p>
        <a href="https://www.verbadocpro.eu/review" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          🔍 Revisar formularios
        </a>
      </p>
    `;

    await resend.emails.send({
      from: 'VerbadocPro <notificaciones@verbadocpro.eu>',
      to: process.env.CLIENT_REVIEW_EMAIL!,
      subject: `📊 Resumen diario: ${count} formularios pendientes`,
      html: emailHtml
    });
  }

  /**
   * Notificar cuando un batch se completa
   */
  static async notifyBatchCompleted(totalProcessed: number, validCount: number, rejectedCount: number) {
    const emailHtml = `
      <h2>✅ Batch de procesamiento completado</h2>

      <p><strong>Total procesado:</strong> ${totalProcessed} formularios</p>
      <p><strong>✅ Válidos:</strong> ${validCount} (${(validCount/totalProcessed*100).toFixed(1)}%)</p>
      <p><strong>❌ Rechazados:</strong> ${rejectedCount} (${(rejectedCount/totalProcessed*100).toFixed(1)}%)</p>

      <p>
        <a href="https://www.verbadocpro.eu/results" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          📥 Descargar resultados
        </a>
      </p>
    `;

    await resend.emails.send({
      from: 'VerbadocPro <notificaciones@verbadocpro.eu>',
      to: process.env.CLIENT_REVIEW_EMAIL!,
      subject: `✅ Batch completado: ${totalProcessed} formularios procesados`,
      html: emailHtml
    });
  }
}
```

### Integrar Email en el Flujo de Procesamiento

```typescript
/**
 * Después de procesar un formulario y validarlo
 */
async function processFormAndValidate(file: File) {
  // 1. Extraer datos con Gemini
  const extractedData = await extractWithGemini(file);

  // 2. Guardar en BD
  const extraction = await sql`
    INSERT INTO extraction_results (user_id, filename, extracted_data, ...)
    VALUES (${userId}, ${file.name}, ${JSON.stringify(extractedData)}, ...)
    RETURNING *
  `;

  // 3. Validar con reglas
  const errors = await validateExtraction(extractedData);

  if (errors.length > 0) {
    // Guardar errores en BD
    for (const error of errors) {
      await sql`
        INSERT INTO validation_errors (extraction_id, field_name, error_type, error_message, invalid_value)
        VALUES (${extraction.id}, ${error.field}, ${error.type}, ${error.message}, ${error.value})
      `;
    }

    // Marcar como "needs_review"
    await sql`
      UPDATE extraction_results
      SET validation_status = 'needs_review'
      WHERE id = ${extraction.id}
    `;

    // 🔥 ENVIAR EMAIL AUTOMÁTICO
    await EmailService.notifyNeedsReview(extraction.rows[0], errors);
  }
}
```

---

## ⚠️ REGLA ESPECIAL: Múltiples Respuestas = NC

### Descripción

En los formularios FUNDAE, hay campos tipo test donde el participante debe marcar **UNA sola opción**.

Si la IA detecta **más de una respuesta marcada** en el mismo campo:
- ❌ No intentar adivinar cuál es la correcta
- ✅ Marcar el campo como **"NC" (No Contesta)**
- ✅ Flaggear para revisión manual

### Implementación

```typescript
/**
 * VALIDACIÓN: Detectar múltiples respuestas en campos de test
 */
function validateSingleChoiceFields(extractedData: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Lista de campos que deben tener SOLO 1 respuesta
  const singleChoiceFields = [
    'valoracion.pregunta1',
    'valoracion.pregunta2',
    // ... hasta pregunta55
    'clasificacion.situacion_laboral',
    'clasificacion.nivel_estudios',
    // etc.
  ];

  for (const fieldPath of singleChoiceFields) {
    const value = getNestedValue(extractedData, fieldPath);

    // Si es un array con más de 1 elemento
    if (Array.isArray(value) && value.length > 1) {
      errors.push({
        field: fieldPath,
        type: 'multiple_answers',
        message: 'Se detectaron múltiples respuestas en un campo de opción única',
        value: value.join(', '),
        expectedFormat: 'Una sola respuesta',
        autoCorrection: 'NC' // Auto-corregir a "NC"
      });

      // Auto-corregir a "NC"
      setNestedValue(extractedData, fieldPath, 'NC');
    }

    // Si detectó múltiples valores separados por coma
    if (typeof value === 'string' && (value.includes(',') || value.includes('y'))) {
      errors.push({
        field: fieldPath,
        type: 'multiple_answers',
        message: 'Texto contiene múltiples respuestas',
        value: value,
        autoCorrection: 'NC'
      });

      setNestedValue(extractedData, fieldPath, 'NC');
    }
  }

  return errors;
}

// Funciones helper para acceder a propiedades anidadas
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}
```

### Ejemplo Real

**Formulario original (PDF):**
```
Pregunta 3: ¿Cómo valora la formación?
[ ] 1 - Muy mal
[X] 2 - Mal
[X] 3 - Bien  ← DOBLE MARCA (error del participante)
[ ] 4 - Muy bien
```

**IA extrae (antes de validación):**
```json
{
  "valoracion": {
    "pregunta3": [2, 3]  ← Array con 2 valores
  }
}
```

**Después de validación:**
```json
{
  "valoracion": {
    "pregunta3": "NC"  ← Auto-corregido
  }
}
```

**Error guardado:**
```json
{
  "field_name": "valoracion.pregunta3",
  "error_type": "multiple_answers",
  "error_message": "Se detectaron múltiples respuestas (2, 3)",
  "invalid_value": "[2, 3]",
  "expected_format": "Una sola respuesta (1-4)",
  "status": "fixed", // Auto-corregido a NC
  "corrected_value": "NC"
}
```

---

## 🚀 RESUMEN DE LA SOLUCIÓN COMPLETA

### ✅ Base de Datos Segura
- **PostgreSQL en Vercel** (ya configurada)
- **Tablas nuevas**: `extraction_results`, `validation_errors`, `email_notifications`
- **Row-Level Security**: Cada cliente solo ve sus datos
- **Backups automáticos** por Vercel
- **Región Europa** (GDPR)

### ✅ Autenticación y Seguridad
- **JWT en cookies httpOnly** (ya implementada)
- **Roles**: Admin (tú) y User (clientes)
- **Solo tú y clientes autorizados** pueden acceder

### ✅ Front Web de Revisión
- **URL dedicada**: `https://www.verbadocpro.eu/review`
- **Visor PDF a la izquierda**
- **Errores numerados a la derecha**
- **Edición en tiempo real** → Guarda en BD inmediatamente
- **Siempre disponible** 24/7

### ✅ Notificaciones Email
- **Email automático** cuando se detectan errores
- **Resumen diario** de formularios pendientes
- **Alertas de batch completado**
- **100 emails/día gratis** con Resend

### ✅ Regla NC (No Contesta)
- **Detección automática** de múltiples respuestas
- **Auto-corrección a "NC"**
- **Flaggeo para revisión** (opcional)

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Base de Datos (2-3 horas)
- [ ] Crear tablas `extraction_results`, `validation_errors`, `email_notifications`
- [ ] Crear índices para performance
- [ ] Migrar datos de localStorage a BD (si es necesario)
- [ ] Probar inserción y consulta

### Fase 2: API Endpoints (3-4 horas)
- [ ] Crear `/api/extractions` (CRUD)
- [ ] Crear `/api/validation-errors/[id]/fix`
- [ ] Crear `/api/extractions/[id]/approve`
- [ ] Crear `/api/extractions/[id]/reject`
- [ ] Añadir middleware de autenticación

### Fase 3: Front de Revisión (4-6 horas)
- [ ] Crear componente `ReviewPanel.tsx`
- [ ] Integrar visor PDF con resaltado de errores
- [ ] Crear lista de errores con formularios de corrección
- [ ] Añadir botones de acción (aprobar, rechazar, siguiente)
- [ ] Crear página `/review` en la app

### Fase 4: Sistema de Emails (2-3 horas)
- [ ] Registrarse en Resend.com
- [ ] Configurar API key en Vercel
- [ ] Crear servicio `EmailService`
- [ ] Integrar emails en flujo de procesamiento
- [ ] Probar envío de emails

### Fase 5: Validación NC (1-2 horas)
- [ ] Implementar detección de múltiples respuestas
- [ ] Auto-corrección a "NC"
- [ ] Añadir a pipeline de validación
- [ ] Probar con formularios reales

### Fase 6: Testing y Deploy (2-3 horas)
- [ ] Probar flujo completo con formularios reales
- [ ] Verificar emails llegan correctamente
- [ ] Verificar seguridad (solo admins acceden)
- [ ] Deploy a producción en Vercel
- [ ] Monitorizar primeros 100 formularios

---

## 💰 COSTES Y RECURSOS

**Base de datos (Vercel Postgres):**
- Gratis hasta 256 MB (suficiente para ~50,000 formularios con PDFs en Blob)
- Pro: $20/mes (60 GB storage)

**Emails (Resend):**
- Gratis: 100 emails/día (3,000/mes)
- Pro: $20/mes (50,000 emails/mes)

**Storage de PDFs (Vercel Blob):**
- Gratis: 1 GB
- Pro: $0.15/GB/mes

**Total estimado para 6,000 formularios/mes:**
- Base de datos: Gratis (ocupa ~100 MB)
- Emails: Gratis (200 emails/mes promedio)
- Storage: $3/mes (20 GB PDFs)
- **TOTAL: ~$3/mes** (increíblemente barato)

---

## 🎯 IMPACTO ESPERADO

### Sin este sistema:
- ❌ Datos en localStorage (se pierden fácilmente)
- ❌ Revisión manual de 100% formularios
- ❌ No hay alertas automáticas
- ❌ Correcciones en Excel offline

### Con este sistema:
- ✅ **Datos seguros en PostgreSQL**
- ✅ **Solo 5-10% requieren revisión manual**
- ✅ **Email automático en tiempo real**
- ✅ **Correcciones en BD instantáneas**
- ✅ **Ahorro: 150+ horas en 6,000 formularios**

---

**Fecha:** 2026-01-08
**Proyecto:** verbadocpro
**Documento:** Arquitectura completa de BD y Front de Revisión
