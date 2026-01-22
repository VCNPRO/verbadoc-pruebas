# 🎯 INSTRUCCIONES: Generador de Formularios FUNDAE Fake

**Archivo**: `tests/fixtures/fundae-form-generator.ts`

---

## 📚 ¿Para Qué Sirve?

Este script genera formularios FUNDAE de prueba (fake) con diferentes calidades y casuísticas para testing masivo del sistema.

**Útil para**:
- Pruebas de carga (100, 200, 500, 1000+ formularios)
- Simular diferentes calidades de PDF (texto, imagen, manuscrito)
- Generar casos con errores intencionales
- Validar el proceso completo de producción
- Medir tiempos reales de procesamiento

---

## 🚀 USO RÁPIDO

### Comando Básico

```bash
# Desde la raíz del proyecto
npm run generate:forms -- --count 100 --quality high
```

### Ejemplos Comunes

```bash
# 100 formularios de ALTA CALIDAD (PDF texto, sin errores)
npm run generate:forms -- --count 100 --quality high

# 200 formularios de CALIDAD MEDIA (150 DPI, 5% errores)
npm run generate:forms -- --count 200 --quality medium --errors 5

# 500 formularios MIXTOS (mezcla de todo)
npm run generate:forms -- --count 500 --quality mixed --errors 10

# 1000 formularios en UN SOLO PDF (batch testing)
npm run generate:forms -- --count 1000 --quality mixed --batch

# 50 formularios MANUSCRITOS (letra simulada, más errores)
npm run generate:forms -- --count 50 --quality manuscript --errors 20
```

---

## ⚙️ PARÁMETROS

### --count (Cantidad)

Número de formularios a generar

```bash
--count 100    # 100 formularios
--count 500    # 500 formularios
--count 1000   # 1000 formularios
```

**Por defecto**: 100

---

### --quality (Calidad del PDF)

Determina la calidad y tipo de PDF generado

| Valor | Descripción | Tasa Éxito Esperada | Uso |
|-------|-------------|---------------------|-----|
| `high` | PDF texto, 300 DPI, sin errores | 98-100% | Testing básico |
| `medium` | PDF texto, 150 DPI, 5% errores | 90-95% | Testing realista |
| `low` | PDF imagen, 75 DPI, 15% errores | 75-85% | Testing pesimista |
| `manuscript` | Simulación manuscrito, 20% errores | 70-80% | Testing peor caso |
| `mixed` | **Mezcla de todos** (40% high, 30% medium, 20% low, 10% manuscript) | 85-92% | **RECOMENDADO para producción** |

**Ejemplos**:
```bash
--quality high         # Solo alta calidad
--quality mixed        # Mezcla realista (RECOMENDADO)
--quality manuscript   # Solo manuscritos
```

**Por defecto**: `high`

---

### --errors (Porcentaje de Errores)

Porcentaje de formularios con errores intencionales (0-100)

**Tipos de errores introducidos**:
- Edad fuera de rango (10 años o 99 años)
- CIF mal formado
- Respuestas múltiples (NC - No Contesta)
- Datos no coincidentes con Excel oficial

```bash
--errors 0     # Sin errores (100% correctos)
--errors 10    # 10% formularios con errores
--errors 30    # 30% formularios con errores
--errors 50    # 50% formularios con errores (stress test)
```

**Por defecto**: 0 (sin errores)

---

### --batch (Modo Batch)

Genera UN SOLO PDF con todos los formularios (múltiples páginas)

```bash
--batch    # Activar modo batch
```

**Sin --batch**: Genera N PDFs individuales (1 archivo por formulario)
**Con --batch**: Genera 1 PDF con N formularios (páginas 1-2 = form1, 3-4 = form2, etc.)

**Útil para**:
- Probar procesamiento de PDFs multi-página
- Simular lotes reales de escaneo
- Testing de batch processing

**Por defecto**: false (PDFs individuales)

---

### --output (Directorio de Salida)

Carpeta donde se guardarán los formularios generados

```bash
--output ./mi-carpeta-pruebas
--output C:\Users\test\formularios
```

**Por defecto**: `tests/fixtures/generated-forms/`

---

## 📦 ARCHIVOS GENERADOS

Cada ejecución genera:

1. **PDFs de formularios**
   - Modo individual: `form_EXP000001_high.pdf`, `form_EXP000002_medium.pdf`, etc.
   - Modo batch: `BATCH_100_formularios.pdf`

2. **Excel de referencia** (`excel_referencia.csv`)
   - Contiene expediente, CIF y razón social de todos los formularios
   - Usar para cargar como "Excel de Validación" en el sistema
   - Formato CSV compatible con Excel

3. **Estadísticas** (`statistics.json`)
   - Total de formularios generados
   - Formularios con errores
   - Formularios con respuestas múltiples (NC)
   - Formularios que no coinciden con referencia
   - Distribución por calidad

---

## 🧪 FLUJO DE PRUEBAS RECOMENDADO

### Fase 1: Prueba Rápida (10 formularios)

```bash
npm run generate:forms -- --count 10 --quality high

# Resultado: 10 PDFs de alta calidad en ~5 segundos
# Usar para: Verificar que el generador funciona
```

### Fase 2: Prueba Realista (100 formularios)

```bash
npm run generate:forms -- --count 100 --quality mixed --errors 10

# Resultado: 100 PDFs mixtos con 10% errores en ~1 minuto
# Usar para: Testing completo del flujo
```

### Fase 3: Stress Test (500 formularios)

```bash
npm run generate:forms -- --count 500 --quality mixed --errors 15

# Resultado: 500 PDFs en ~5-7 minutos
# Usar para: Medir tiempos de procesamiento real
```

### Fase 4: Producción Simulada (1000 formularios batch)

```bash
npm run generate:forms -- --count 1000 --quality mixed --errors 10 --batch

# Resultado: 1 PDF con 1000 formularios (2000 páginas) en ~10-15 minutos
# Usar para: Simular lote real de escaneo
```

---

## 📊 DESPUÉS DE GENERAR: Cómo Usar los Formularios

### 1. Cargar Excel de Referencia

```
1. Ir a: https://www.verbadocpro.eu
2. Login
3. Admin → "Gestión de Excel"
4. Sección: "Excel de Validación"
5. Cargar archivo: excel_referencia.csv
6. Guardar
```

### 2. Procesar Formularios Generados

**Opción A: Procesamiento Individual**
```
1. Dashboard → "Procesar Formularios"
2. Subir PDFs generados uno por uno
3. Revisar cada extracción
4. Aprobar/Rechazar
```

**Opción B: Procesamiento por Lotes**
```
1. Dashboard → "Procesamiento por Lotes"
2. Si generaste con --batch: Subir el PDF grande
3. Configurar páginas por formulario: 2
4. Click: "Procesar Lote"
5. Esperar a que termine
6. Revisar resultados en dashboard
```

### 3. Medir Performance

Anotar:
- ⏱️ Tiempo total de procesamiento
- ✅ Formularios procesados correctamente
- ❌ Formularios con errores
- 🔄 Formularios que requirieron corrección manual
- 📊 Formularios/hora real

**Calcular**:
```
Velocidad = Total formularios / Tiempo en horas

Ejemplo:
- 500 formularios
- Tiempo: 6 horas (incluyendo revisiones)
- Velocidad: 500 / 6 = 83 formularios/hora
```

---

## 💡 TIPS Y MEJORES PRÁCTICAS

### Empezar con Lotes Pequeños

No empezar directamente con 1000 formularios:

```bash
# ❌ NO hacer esto primero
npm run generate:forms -- --count 1000 --quality mixed

# ✅ Hacer esto primero
npm run generate:forms -- --count 10 --quality high
# Procesar los 10, verificar que todo funciona
# LUEGO subir a 100, 200, 500...
```

### Usar Calidad 'mixed' para Realismo

```bash
# ✅ RECOMENDADO para testing realista
npm run generate:forms -- --count 200 --quality mixed --errors 10

# Esta configuración simula un lote real:
# - 40% PDFs perfectos (ordenador)
# - 30% PDFs buenos (escaneados alta calidad)
# - 20% PDFs regulares (escaneados media calidad)
# - 10% PDFs difíciles (manuscritos/baja calidad)
# - 10% con errores intencionales
```

### Guardar Excel de Referencia

Siempre guardar el archivo `excel_referencia.csv`:

```bash
# Copiar a carpeta segura
cp tests/fixtures/generated-forms/excel_referencia.csv ./test-data/referencias_lote_001.csv
```

Sin este archivo, no podrás validar los formularios contra datos oficiales.

### Documentar Resultados

Crear un log después de cada test:

```markdown
## Test 2026-01-11 - Lote 500 formularios mixtos

**Generación**:
- Comando: npm run generate:forms -- --count 500 --quality mixed --errors 10
- Tiempo: 6 minutos
- Archivos: 500 PDFs + 1 CSV referencia

**Procesamiento**:
- Inicio: 10:00
- Fin: 16:30
- Duración: 6.5 horas
- Formularios procesados: 500
- Velocidad: 77 form/hora

**Resultados**:
- Correctos automáticamente: 425 (85%)
- Requirieron corrección: 60 (12%)
- Rechazados: 15 (3%)

**Observaciones**:
- Manuscritos más lentos (2-3 min vs 1 min)
- CIFs con mayor tasa de error en manuscritos
- Valoraciones muy precisas incluso en baja calidad
```

---

## 🆘 TROUBLESHOOTING

### Error: "Cannot find module 'jspdf'"

```bash
# Instalar dependencia
npm install jspdf
```

### Error: "ENOENT: no such file or directory"

El directorio de salida no existe. El script lo crea automáticamente, pero si persiste:

```bash
mkdir -p tests/fixtures/generated-forms
```

### Los PDFs no se abren / están corruptos

Si usaste `--batch` y el PDF es muy grande (>100 MB), algunos lectores pueden tener problemas:

- Usar Adobe Acrobat (más robusto)
- Generar en lotes más pequeños
- Usar modo individual (sin --batch)

### El generador es muy lento

Generar 1000 formularios puede tardar 10-15 minutos:

```bash
# Para testing rápido, usar lotes pequeños
npm run generate:forms -- --count 50

# Para producción, dejar correr de fondo
npm run generate:forms -- --count 1000 &
```

---

## 📈 BENCHMARKS ESPERADOS

### Tiempo de Generación

| Cantidad | Tiempo Estimado |
|----------|-----------------|
| 10 | ~5 segundos |
| 100 | ~1 minuto |
| 500 | ~5-7 minutos |
| 1000 | ~10-15 minutos |

### Tamaño de Archivos

| Cantidad | Tamaño Individual | Tamaño Batch |
|----------|-------------------|--------------|
| 100 forms | ~15 KB/form = 1.5 MB total | ~2-3 MB |
| 500 forms | ~15 KB/form = 7.5 MB total | ~10-12 MB |
| 1000 forms | ~15 KB/form = 15 MB total | ~20-25 MB |

*Nota: PDFs con calidad 'low' e 'image' son más grandes*

---

## 🎯 RESUMEN DE COMANDOS PRINCIPALES

```bash
# Testing básico (10 formularios alta calidad)
npm run generate:forms -- --count 10 --quality high

# Testing realista (100 formularios mixtos)
npm run generate:forms -- --count 100 --quality mixed --errors 10

# Stress test (500 formularios)
npm run generate:forms -- --count 500 --quality mixed --errors 15

# Producción simulada (1000 batch)
npm run generate:forms -- --count 1000 --quality mixed --batch

# Ver ayuda completa
npm run generate:forms -- --help
```

---

**Creado**: 2026-01-11
**Versión**: 1.0
**Script**: `tests/fixtures/fundae-form-generator.ts`

🎉 **Generador listo para usar**
