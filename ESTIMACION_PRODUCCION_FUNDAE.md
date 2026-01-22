# 📊 ESTIMACIÓN DE PRODUCCIÓN - FORMULARIOS FUNDAE

## Características de los Formularios

**Datos técnicos:**
- **Páginas:** 2 por formulario
- **Campos totales:** ~100 campos/respuestas
  - Sección I: Datos identificativos (10 campos)
  - Sección II: Clasificación participante (~35 campos con opciones múltiples)
  - Sección III: Valoración (55 preguntas escala 1-4)
- **Formatos soportados:** PDF activo, PDF imagen, JPEG
- **Tamaños:** 300KB-13MB (algunos escaneados de baja calidad)

---

## ⏱️ Tiempo de Procesamiento por Formulario

**Con Gemini 2.5 Flash (configuración actual):**

| Actividad | Tiempo |
|-----------|--------|
| Carga + preparación | 5 seg |
| Procesamiento IA (2 páginas, 100 campos) | 25-35 seg |
| Post-procesamiento + validación | 10 seg |
| **TOTAL POR FORMULARIO** | **40-50 seg** |

---

## 📈 Cálculos de Producción Conservadores

### ESCENARIO 1: Conservador (con revisión humana al 20%)
```
- Velocidad: 75 formularios/hora
- Jornada 10h: 750 formularios/día
- 6,000 formularios: 8 días laborables
```

### ESCENARIO 2: Moderado (con spot-checks al 5%) ✅ RECOMENDADO
```
- Velocidad: 110 formularios/hora
- Jornada 10h: 1,100 formularios/día
- 6,000 formularios: 5-6 días laborables
```

### ESCENARIO 3: Optimista (automatización 95%)
```
- Velocidad: 150 formularios/hora
- Jornada 10h: 1,500 formularios/día
- 6,000 formularios: 4 días laborables
```

---

## 🎯 Recomendación Conservadora

### **Producción Diaria Conservadora: 800-1,000 formularios/día**

**Proyecto de 6,000 formularios:**
- **Tiempo estimado: 6-8 días laborables** (10h/día)
- Con margen de error del 20%: **7-10 días**

---

## ⚠️ Factores que Pueden Reducir Velocidad

1. **PDFs imagen de mala calidad** (como el de 13MB): -30% velocidad
2. **Formularios manuscritos**: -40% velocidad vs impresos
3. **Errores de OCR que requieren corrección**: -10-15%
4. **Límites de API de Google Cloud**: Vertex AI tiene límites de RPM (requests per minute)
5. **Validación de campos críticos** (CIF, expedientes): requiere tiempo extra

---

## 💰 Coste Estimado (Conservador)

Con **Gemini 2.5 Flash** (~$0.002 por formulario de 2 páginas):

```
6,000 formularios × $0.002 = ~$12-15 USD
```

Con **Gemini 2.5 Flash Lite** (-50% coste):
```
6,000 formularios × $0.001 = ~$6-8 USD
```

---

## 🚀 Recomendaciones para Maximizar Producción

1. **Usar Gemini 2.5 Flash Lite** para formularios simples
   - Ahorro: -50% coste
   - Velocidad: +20%

2. **Batch processing**: Procesar 50-100 formularios a la vez
   - Reduce overhead de conexión
   - Mejor gestión de errores

3. **Priorizar PDF activos** sobre escaneados
   - Mayor precisión OCR
   - Procesamiento más rápido

4. **Validación automática** con reglas
   - CIF válidos (formato y dígito de control)
   - Fechas coherentes
   - Rangos numéricos (edad, valoraciones 1-4)
   - Campos obligatorios completos

5. **Sistema de colas** para reintento automático
   - Reintentar errores temporales
   - Procesamiento en background
   - Priorización de lotes

---

## 📊 Resumen Ejecutivo

| Métrica | Valor Conservador |
|---------|------------------|
| **Formularios/hora** | 100-120 |
| **Formularios/día (10h)** | **1,000-1,200** |
| **Días para 6,000** | **5-6 días laborables** |
| **Coste total** | $12-18 USD |
| **Precisión esperada** | 95-98% |

---

## 📋 Plan de Trabajo Sugerido

### Día 1: Preparación
- Organizar los 6,000 PDFs
- Clasificar por tipo (activo/imagen)
- Configurar batch processor

### Días 2-7: Procesamiento
- Procesar ~1,000 formularios/día
- Validación automática en tiempo real
- Spot-checks manuales (5% muestra)

### Día 8: Revisión y corrección
- Revisar casos con errores
- Validar campos críticos (CIF, expedientes)
- Exportar a Excel/CSV

---

## 🎯 KPIs a Monitorizar

1. **Velocidad real**: formularios/hora
2. **Tasa de error**: % de formularios con errores
3. **Campos con mayor error**: para mejorar prompts
4. **Coste por formulario**: para optimizar modelo
5. **Tiempo de validación**: para automatizar más

---

## 💡 Notas Importantes

- Estas estimaciones son **conservadoras** y asumen un 20% de margen de error
- La velocidad puede ser mayor con lotes homogéneos (mismo formato)
- Los costes de API son estimados y pueden variar según uso real
- Se recomienda hacer prueba piloto con 100 formularios primero

---

**Fecha del análisis:** 2026-01-08
**Proyecto:** verbadocpro - Procesamiento FUNDAE
**Modelo IA:** Gemini 2.5 Flash (europe-west1)
