# 📧 CONFIGURAR RESEND - GUÍA PASO A PASO

## 🎯 Objetivo

Configurar Resend para enviar emails automáticos cuando hay errores de validación en formularios FUNDAE.

---

## 📋 PASO 1: Crear Cuenta en Resend

### 1.1. Registrarse

1. Ve a: https://resend.com
2. Click en **"Sign Up"** (o "Get Started")
3. Usa tu email de trabajo
4. Verifica tu email

### 1.2. Plan Gratuito

- ✅ **100 emails/día** GRATIS
- ✅ **3,000 emails/mes** GRATIS
- ✅ Sin tarjeta de crédito requerida
- ✅ Suficiente para empezar

---

## 📋 PASO 2: Obtener API Key

### 2.1. Crear API Key

1. Ve al dashboard: https://resend.com/api-keys
2. Click en **"Create API Key"**
3. Nombre: `VerbadocPro Production`
4. Permisos: **"Full Access"**
5. Click en **"Add"**
6. **COPIA LA API KEY** (solo se muestra una vez)

**Ejemplo de API Key:**
```
re_123abc456def789ghi012jkl345mno678
```

⚠️ **IMPORTANTE:** Guarda la API key en un lugar seguro. No la compartas.

---

## 📋 PASO 3: Configurar Dominio (Opcional)

### Opción A: Usar dominio propio (verbadocpro.eu)

1. Ve a: https://resend.com/domains
2. Click en **"Add Domain"**
3. Ingresa: `verbadocpro.eu`
4. Sigue las instrucciones para agregar registros DNS:
   - SPF
   - DKIM
   - DMARC

**Beneficio:** Emails desde `noreply@verbadocpro.eu`

### Opción B: Usar dominio de Resend (Más rápido)

- Usar `onboarding@resend.dev` (ya funciona sin configuración)
- **Recomendado para empezar**

---

## 📋 PASO 4: Configurar Variables en Vercel

### 4.1. Via Vercel Dashboard (Recomendado)

1. Ve a: https://vercel.com/solammedia-9886s-projects/verbadocpro
2. Click en **"Settings"**
3. Click en **"Environment Variables"**
4. Agregar las siguientes variables:

**Variable 1:**
```
Name: RESEND_API_KEY
Value: re_tu-api-key-aqui
Environment: Production, Preview, Development
```

**Variable 2:**
```
Name: NOTIFICATION_EMAIL
Value: VerbadocPro <noreply@verbadocpro.eu>
Environment: Production, Preview, Development
```

(O si usas Resend default: `VerbadocPro <onboarding@resend.dev>`)

**Variable 3:**
```
Name: CLIENT_REVIEW_EMAIL
Value: tu-email@empresa.com
Environment: Production, Preview, Development
```

5. Click en **"Save"**

### 4.2. Via Vercel CLI (Alternativa)

```bash
cd verbadocpro

# Agregar RESEND_API_KEY
vercel env add RESEND_API_KEY
# Pegar: re_tu-api-key-aqui
# Seleccionar: Production, Preview, Development

# Agregar NOTIFICATION_EMAIL
vercel env add NOTIFICATION_EMAIL
# Pegar: VerbadocPro <onboarding@resend.dev>
# Seleccionar: Production, Preview, Development

# Agregar CLIENT_REVIEW_EMAIL
vercel env add CLIENT_REVIEW_EMAIL
# Pegar: tu-email@empresa.com
# Seleccionar: Production, Preview, Development
```

---

## 📋 PASO 5: Redeploy

Después de agregar las variables, **redeploy** para que surtan efecto:

### Opción A: Desde Dashboard
1. Ve a: https://vercel.com/solammedia-9886s-projects/verbadocpro
2. Click en **"Deployments"**
3. Click en el último deployment
4. Click en **"Redeploy"**

### Opción B: Desde CLI
```bash
cd verbadocpro
vercel --prod
```

### Opción C: Git Push
```bash
git commit --allow-empty -m "Trigger redeploy for env vars"
git push
```

---

## 🧪 PASO 6: Probar el Sistema

### 6.1. Probar envío manual

```bash
# Desde tu terminal local o Vercel
curl -X POST https://www.verbadocpro.eu/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=TU_TOKEN" \
  -d '{
    "extractionId": "uuid-de-una-extraccion",
    "type": "needs_review"
  }'
```

### 6.2. Verificar en Resend Dashboard

1. Ve a: https://resend.com/emails
2. Deberías ver el email en la lista
3. Status: **"Delivered"**

### 6.3. Verificar en tu email

1. Revisa tu bandeja de entrada
2. Busca email de **VerbadocPro**
3. Asunto: "📋 Formulario requiere revisión: ..."

---

## 📊 Variables de Entorno - Resumen

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| **RESEND_API_KEY** | API key de Resend | `re_123abc...` |
| **NOTIFICATION_EMAIL** | Email remitente (FROM) | `VerbadocPro <noreply@verbadocpro.eu>` |
| **CLIENT_REVIEW_EMAIL** | Email destinatario (TO) | `admin@empresa.com` |

---

## ⚙️ Configuración Avanzada

### Cambiar email remitente

En `src/services/emailService.ts`:

```typescript
const FROM_EMAIL = process.env.NOTIFICATION_EMAIL || 'VerbadocPro <onboarding@resend.dev>';
```

### Cambiar email destinatario

En `src/services/emailService.ts`:

```typescript
const TO_EMAIL = process.env.CLIENT_REVIEW_EMAIL || 'admin@verbadocpro.eu';
```

### Múltiples destinatarios

```typescript
const result = await resend.emails.send({
  from: FROM_EMAIL,
  to: ['admin@verbadocpro.eu', 'manager@verbadocpro.eu'],
  subject: '...',
  html: emailHtml
});
```

---

## 🔍 Troubleshooting

### Error: "Missing API key"

```
Error: You must provide a Resend API Key
```

**Solución:**
1. Verifica que la variable `RESEND_API_KEY` esté configurada en Vercel
2. Haz redeploy después de agregarla
3. Verifica que el valor sea correcto (empieza con `re_`)

### Error: "Invalid FROM address"

```
Error: The "from" field must be a valid email address
```

**Solución:**
1. Usa formato: `Nombre <email@dominio.com>`
2. Si usas dominio propio, verifica que esté verificado en Resend
3. Usa `onboarding@resend.dev` mientras tanto

### Email no llega

**Posibles causas:**
1. **Spam:** Revisa carpeta de spam
2. **Dominio no verificado:** Usa `onboarding@resend.dev`
3. **Límite alcanzado:** Vercel Resend (100/día gratis)
4. **Email inválido:** Verifica `CLIENT_REVIEW_EMAIL`

**Verificar logs:**
```bash
vercel logs --prod
```

---

## 📈 Monitoreo

### Ver emails enviados

1. Dashboard de Resend: https://resend.com/emails
2. Base de datos: Tabla `email_notifications`

```sql
SELECT * FROM email_notifications
ORDER BY created_at DESC
LIMIT 10;
```

### Estadísticas

```javascript
const { stats } = await EmailNotificationDB.getStats();
console.log(`
Emails enviados: ${stats.sent}
Emails fallidos: ${stats.failed}
Emails pendientes: ${stats.pending}
`);
```

---

## 💰 Planes de Resend

| Plan | Precio | Emails/mes | Recomendado para |
|------|--------|------------|------------------|
| **Free** | $0 | 3,000 | Desarrollo, pruebas |
| **Pro** | $20/mes | 50,000 | Producción pequeña |
| **Business** | $100/mes | 1M | Producción grande |

**Para 6,000 formularios/mes:**
- Si cada formulario genera 1 email → **Free plan es suficiente** ✅
- Si hay más notificaciones → Upgrade a Pro

---

## ✅ Checklist de Configuración

- [ ] Cuenta creada en Resend.com
- [ ] API Key obtenida
- [ ] RESEND_API_KEY configurada en Vercel
- [ ] NOTIFICATION_EMAIL configurada
- [ ] CLIENT_REVIEW_EMAIL configurada
- [ ] Redeploy realizado
- [ ] Email de prueba enviado
- [ ] Email recibido correctamente

---

## 🚀 Próximos Pasos

Una vez configurado Resend:

1. **Los emails se enviarán automáticamente** cuando:
   - Se detecten errores de validación
   - Se procese un batch completo
   - (Opcional) Resumen diario a las 18:00

2. **Verificar en producción:**
   - Procesar un formulario con errores
   - Verificar que llegue el email
   - Verificar el log en `email_notifications`

3. **Personalizar templates:**
   - Editar `src/services/emailService.ts`
   - Cambiar colores, logos, textos
   - Agregar más tipos de notificaciones

---

**Fecha:** 2026-01-08
**Proyecto:** verbadocpro
**Documentación:** Sistema de Emails con Resend
