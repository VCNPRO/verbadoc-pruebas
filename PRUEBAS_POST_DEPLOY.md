# 🧪 GUÍA DE PRUEBAS POST-DEPLOY

## ✅ Lista de Verificación Rápida

Sigue esta lista después de desplegar para verificar que todo funciona correctamente.

---

## 🔍 PRUEBA #1: Filtrado de Formularios (5 min)

### Pasos:
1. **Ir a** `https://www.verbadocpro.eu/review`
2. **Verificar** que se muestra la tabla de formularios
3. **Probar filtros** uno por uno:

| Filtro | Esperado |
|--------|----------|
| **Todos** | Muestra todos los formularios |
| **Pendientes** | Solo `status='pending'` |
| **Con Errores** | Solo `status='needs_review'` |
| **Válidos** | Solo `status='valid'` |
| **Rechazados** | Solo `status='rejected'` |

4. **Buscar** un formulario por nombre
5. **Verificar** que el contador de "Mostrando X de Y" es correcto

### ❌ Si falla:
- Abrir DevTools (F12) → Console
- Buscar errores en rojo
- Verificar el Network tab para el request a `/api/extractions`
- Capturar screenshot y reportar

---

## 📊 PRUEBA #2: Excel Master con Formularios Corregidos (10 min)

### Preparación:
1. **Procesar** un nuevo formulario PDF con errores intencionados
2. **Ir a** `/review` y encontrar el formulario
3. **Clic en** "Revisar →"

### Pasos:
1. **Verificar** que el visor PDF funciona (izquierda)
2. **Revisar** los errores listados (derecha)
3. **Corregir** al menos un error:
   - Clic en "Corregir Error"
   - Ingresar valor correcto
   - Guardar

4. **Clic en** "Corregir y Procesar" (botón azul superior)
5. **Verificar mensaje**:
   - ✅ Debe decir: "Formulario corregido y añadido al Excel Master correctamente"
   - ❌ NO debe decir: "ya existía" o "error"

6. **Ir a** `/master-excel`
7. **Buscar** el formulario en la tabla
8. **Verificar** que aparece con todos los datos

### ❌ Si falla:
- Si dice "ya existía": NORMAL si es un re-test
- Si dice "error": Abrir DevTools → Console
- Buscar el request POST a `/api/master-excel`
- Verificar la respuesta (debería ser 200 o 201)

---

## 📄 PRUEBA #3: Visor PDF en Revisión (5 min)

### Pasos:
1. **Procesar** un nuevo formulario PDF
2. **Observar** si aparece alguna alerta durante el procesamiento:
   - ⚠️ Si aparece: "PDF no se pudo subir" → **PROBLEMA DE VERCEL BLOB**
   - ✅ Si NO aparece: Todo bien, continuar

3. **Ir a** `/review/:id` (clic en "Revisar →")
4. **Verificar** que el PDF se muestra en el lado izquierdo
5. **Probar** los controles:
   - Zoom In/Out
   - Navegación de páginas
   - Ajustar

### ❌ Si el PDF NO se muestra:
1. **Abrir DevTools** (F12) → Console
2. **Buscar logs**:
   ```
   🔍 Intentando cargar PDF desde Base de Datos...
   🔍 Intentando recuperar PDF de sessionStorage...
   ❌ No se pudo recuperar el PDF de ninguna fuente
   ```
3. **Verificar Network tab**:
   - Buscar request a URL de Blob (empieza con `https://`)
   - Si falla con 403/404: **PROBLEMA DE VERCEL BLOB**

4. **SOLUCIÓN TEMPORAL**:
   - El formulario SÍ se procesó correctamente
   - Puedes corregir errores sin el visor
   - Usa el panel derecho con los datos extraídos

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### Problema: "PDF no se pudo subir"
**Causa**: Configuración de Vercel Blob
**Solución**:
1. Ir a Vercel Dashboard → verbadocpro → Storage
2. Verificar que existe un Blob Store
3. Copiar el token `BLOB_READ_WRITE_TOKEN`
4. Actualizar variable de entorno en Vercel
5. Redeployar

### Problema: Filtros no funcionan
**Causa**: Caché del navegador
**Solución**:
1. Refrescar con Ctrl+F5 (hard refresh)
2. Limpiar caché del navegador
3. Verificar que el deploy se completó correctamente

### Problema: Excel Master vacío
**Causa**: Ningún formulario ha sido aprobado
**Solución**:
1. Ir a `/review`
2. Seleccionar un formulario válido
3. Clic en "Revisar →"
4. Clic en "Aprobar" (botón verde)
5. Volver a `/master-excel`

---

## 📱 CHECKLIST COMPLETO

Marca cada item después de probarlo:

- [ ] Login funciona
- [ ] Subir PDF nuevo
- [ ] Ver extracción en Home
- [ ] Filtro "Todos" en /review
- [ ] Filtro "Con Errores" en /review
- [ ] Filtro "Válidos" en /review
- [ ] Búsqueda por nombre de archivo
- [ ] Visor PDF en /review/:id funciona
- [ ] Corregir un error funciona
- [ ] Botón "Corregir y Procesar" funciona
- [ ] Formulario aparece en /master-excel
- [ ] Descargar Excel Master funciona
- [ ] Excel descargado tiene los datos correctos

---

## 🎯 MÉTRICAS DE ÉXITO

| Métrica | Objetivo |
|---------|----------|
| **Filtros funcionan** | 100% |
| **PDFs visibles en revisión** | >90% |
| **Formularios en Excel Master** | 100% de aprobados |
| **Tiempo de procesamiento** | <10 seg por documento |
| **Errores en consola** | 0 críticos |

---

## 📞 SOPORTE DE EMERGENCIA

Si encuentras un problema crítico que impide el uso:

1. **Capturar**:
   - Screenshot del error
   - Logs de consola (F12 → Console → clic derecho → "Save as...")
   - Request/Response del Network tab

2. **Verificar**:
   - ¿Afecta a todos los usuarios?
   - ¿Es reproducible?
   - ¿Bloquea funcionalidad crítica?

3. **Rollback de emergencia** (si es crítico):
   ```bash
   # En Vercel Dashboard:
   # Deployments → Clic en el deployment anterior → "Redeploy"
   ```

---

**Última actualización**: 13 de enero de 2026
