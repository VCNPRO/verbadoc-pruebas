# VerbadocPro Europa - Planes, Precios y Modulos

> **Documento de referencia interna** - Contenido extraido del sistema actual para trabajar sobre nuevas condiciones economicas.
> Fecha: 2026-02-10

---

## 1. Modulos Individuales

| Modulo | Nombre Interno | Precio/mes | Descripcion |
|--------|---------------|------------|-------------|
| Extraccion de Datos | `extraction` | 29€ | Extrae datos estructurados de PDFs, imagenes y documentos escaneados con IA |
| Busqueda Semantica (RAG) | `rag` | 19€ | Busca informacion en tus documentos usando lenguaje natural |
| Revision y Validacion | `review` | 15€ | Sistema de revision con deteccion de errores y validacion cruzada |
| Excel Master | `excel_master` | 15€ | Consolida datos extraidos en un Excel master exportable |
| Procesamiento en Lote | `batch` | 25€ | Procesa hasta 50 documentos de forma automatica y simultanea |
| Plantillas Personalizadas | `templates` | 10€ | Crea y gestiona plantillas de extraccion para tus tipos de documentos |

**Total modulos individuales:** 113€/mes

---

## 2. Paquetes

| Paquete | Precio/mes | Modulos incluidos | Ahorro vs individual |
|---------|------------|-------------------|---------------------|
| **Basico** | 44€ | Extraccion + Excel Master | 0€ (44€ vs 44€) |
| **Profesional** (Recomendado) | 88€ | Extraccion + Revision + Excel Master + Lote | -4€ descuento (84€ vs 88€) |
| **Completo** | 113€ | Todos los 6 modulos | 0€ (113€ = 113€) |

**Nota:** El paquete Basico no tiene ahorro real. El Profesional tiene un ligero descuento. El Completo es la suma exacta.

---

## 3. Planes de Suscripcion (Quotas)

| Plan | Nombre Interno | Extracciones/mes | Precio asociado |
|------|---------------|-------------------|-----------------|
| Gratuito | `free` | 10 | 0€ (trial) |
| Pro | `pro` | 100 | No definido en codigo |
| Enterprise | `enterprise` | 1000 | No definido en codigo |

**Reset de cuota:** Automatico al inicio de cada mes (`quota_reset_date`)

---

## 4. Sistema de Modulos (Base de Datos)

### Tabla `service_modules`
```sql
CREATE TABLE service_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  monthly_price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla `user_modules`
```sql
CREATE TABLE user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES service_modules(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, module_id)
);
```

### Campos de cuota en `users`
```sql
ALTER TABLE users ADD COLUMN monthly_quota_extractions INTEGER DEFAULT 10;
ALTER TABLE users ADD COLUMN monthly_usage_extractions INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN subscription_plan VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN quota_reset_date TIMESTAMP;
```

---

## 5. Endpoints API Relacionados

| Endpoint | Metodo | Funcion |
|----------|--------|---------|
| `/api/modules` | GET | Lista modulos (admin: todos + conteo; user: solo asignados) |
| `/api/modules/assign` | POST/DELETE | Admin asigna/revoca modulo a usuario |
| `/api/user/check-quota` | GET | Consulta cuota de extracciones del usuario |
| `/api/admin/user-quotas` | GET/PATCH/POST | Gestion de cuotas (admin only) |
| `/pricing` | - | Pagina publica de precios (frontend) |

---

## 6. Chatbot Laia - Respuesta sobre Precios

Cuando un usuario pregunta por precios, Laia responde:

```
MODULOS DISPONIBLES:

Extraccion de Datos: 29€/mes
Busqueda Semantica (RAG): 19€/mes
Revision y Validacion: 15€/mes
Excel Master: 15€/mes
Procesamiento en Lote: 25€/mes
Plantillas Personalizadas: 10€/mes

PAQUETES:
- Basico (Extraccion + Excel Master): 44€/mes
- Profesional (Extraccion + Revision + Excel Master + Lote): 88€/mes
- Completo (todos los modulos): 113€/mes

Contacta al equipo comercial para mas informacion.
```

---

## 7. Contacto Comercial

- Email: info@verbadocpro.eu
- Asunto patron paquete: `Solicitud paquete {nombre}`
- Asunto plan personalizado: `Consulta plan personalizado`

---

## 8. Archivos que Contienen Precios/Planes

| Archivo | Que contiene |
|---------|-------------|
| `src/components/PricingPage.tsx` | Pagina completa de precios (MODULES, PACKAGES) |
| `components/ChatbotLaia.tsx` | Respuestas de Laia sobre precios (LAIA_KNOWLEDGE.pricing, .modules) |
| `api/admin/run-migration-modules.ts` | Migracion BD con precios por modulo |
| `api/admin/user-quotas.ts` | Gestion planes free/pro/enterprise con cuotas |
| `api/user/check-quota.ts` | Verificacion cuota usuario |
| `api/modules/index.ts` | API lista modulos con precios |
| `api/modules/assign.ts` | Asignacion modulos a usuarios |
| `src/hooks/useModules.ts` | Hook frontend para verificar acceso a modulos |
| `App.tsx` | Boton navegacion a /pricing (linea 2080) |

---

## 9. Notas para Rediseño

- El modelo actual es **modular** (compras modulos individuales o paquetes)
- Los planes (free/pro/enterprise) solo controlan **cuotas de extracciones**, no acceso a modulos
- No hay pasarela de pago integrada (Stripe, etc.) - todo es por contacto email
- Los admins asignan modulos manualmente via API
- No hay self-service de compra para el usuario final
