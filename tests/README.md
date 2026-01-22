# VerbadocPro - Suite de Pruebas Completa

Suite exhaustiva de pruebas para validar todas las nuevas funcionalidades de VerbadocPro.

## 📋 Contenido

### Archivos de Prueba

1. **`cross-validation.test.ts`** - Validación cruzada con Excel
   - Upload de datos de referencia
   - Comparación campo por campo
   - Tolerancia numérica
   - Normalización de fechas
   - Detección de discrepancias
   - Carga masiva (500+ registros)

2. **`pdf-storage.test.ts`** - Almacenamiento de PDFs
   - Upload a Vercel Blob
   - Validación de firma PDF
   - Checksums SHA-256
   - Límites de tamaño (50MB)
   - Upload concurrente
   - Diferentes tamaños de archivo

3. **`batch-processing.test.ts`** - Procesamiento Batch
   - Creación de batches (10-100 archivos)
   - Consulta de estado y progreso
   - Límites de archivos
   - **Pruebas de alta carga (1000 archivos)**
   - Procesamiento concurrente
   - Diferentes modelos de IA

4. **`export.test.ts`** - Exportación Consolidada
   - Exportación a Excel (con múltiples hojas)
   - Exportación a CSV
   - Exportación a PDF
   - **Alta carga (1000 registros)**
   - Comparación de formatos
   - Validación de límites

5. **`fixtures/mock-data-generator.ts`** - Generador de Datos Mock
   - Extracciones ficticias
   - Archivos Excel mock
   - PDFs mock
   - Batch jobs mock
   - Datasets predefinidos (pequeño, medio, grande)

6. **`run-all-tests.ts`** - Script Principal
   - Ejecuta todas las suites
   - Genera reporte completo
   - Guarda resultados en JSON y Markdown

## 🚀 Uso

### Configuración Inicial

1. **Configurar variables de entorno** en `.env.local`:

```bash
# REQUERIDO: Token de autenticación para tests
TEST_AUTH_TOKEN=your_jwt_token_here

# REQUERIDO: Base de datos
POSTGRES_URL=your_postgres_connection_string

# REQUERIDO: JWT para autenticación
JWT_SECRET=your_jwt_secret

# OPCIONAL: Vercel Blob (para tests de PDF storage)
BLOB_READ_WRITE_TOKEN=your_blob_token

# OPCIONAL: Google Vertex AI
GOOGLE_VERTEX_PROJECT_ID=your_project_id
```

2. **Instalar dependencias**:

```bash
npm install
```

### Ejecutar Pruebas

#### Ejecutar Suite Completa

```bash
npm run test:all
```

Esto ejecutará todas las suites de pruebas y generará un reporte completo.

#### Ejecutar Suites Individuales

```bash
# Solo validación cruzada
npm run test:cross-validation

# Solo almacenamiento de PDFs
npm run test:pdf-storage

# Solo batch processing
npm run test:batch

# Solo exportación
npm run test:export
```

### Generar Token de Prueba

Para generar un `TEST_AUTH_TOKEN`, puedes usar este snippet de Node.js:

```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'admin'
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

console.log('TEST_AUTH_TOKEN=' + token);
```

## 📊 Reportes

Los reportes se guardan automáticamente en `tests/reports/`:

- `test-report-TIMESTAMP.json` - Reporte completo en JSON
- `test-report-TIMESTAMP.md` - Reporte legible en Markdown

### Ejemplo de Reporte

```
═══════════════════════════════════════════════════════════════
                         📊 REPORTE FINAL DE PRUEBAS
═══════════════════════════════════════════════════════════════

Resultados por Suite:
────────────────────────────────────────────────────────────────
Suite                                   Pasadas  Falladas  Saltadas  Tiempo
────────────────────────────────────────────────────────────────
Excel Cross-Validation Tests                  7         0         0    2341ms
PDF Storage Tests                             7         0         0    1823ms
Batch Processing Tests                        9         0         0    5432ms
Export Tests                                 10         0         0    8761ms
────────────────────────────────────────────────────────────────
TOTALES                                      33         0         0   18357ms
────────────────────────────────────────────────────────────────

Estadísticas Generales:
  🎯 Total de pruebas: 33
  ✅ Pasadas: 33
  ❌ Falladas: 0
  ⏭️  Saltadas: 0
  📈 Tasa de éxito: 100.00%
  ⏱️  Tiempo total: 18.36s
  ⚡ Promedio por prueba: 556.27ms

🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!
```

## 🧪 Datasets de Prueba

El generador de datos incluye varios datasets predefinidos:

### `SMALL_DATASET`
- 10 extracciones
- Para pruebas rápidas
- Tiempo: ~100ms

### `MEDIUM_DATASET`
- 100 extracciones
- Para pruebas de carga media
- Tiempo: ~500ms

### `LARGE_DATASET`
- 1000 extracciones (límite del sistema)
- Para pruebas de alta carga
- Tiempo: ~5s

### `ERROR_DATASET`
- 100 extracciones con estados mixtos
- 50% completed, 25% failed, 15% processing, 10% pending
- Para testing de manejo de errores

### `LOW_CONFIDENCE_DATASET`
- 50 extracciones con confianza < 60%
- Para testing de validación

## 🔥 Pruebas de Alta Carga

Las pruebas incluyen escenarios de alta carga:

### Batch Processing
- **10 batches x 100 archivos = 1000 archivos**
- Creación concurrente
- Validación de throughput
- Cálculo de tiempo estimado

### Export
- **1000 registros en un solo export**
- Formatos: Excel, CSV, PDF
- Con validación incluida
- Con validación cruzada

### Cross-Validation
- **500 registros de referencia en Excel**
- Parsing y comparación
- Tolerancia numérica
- Normalización de fechas

## ⚙️ Configuración de Scripts

Añade estos scripts a tu `package.json`:

```json
{
  "scripts": {
    "test:all": "tsx tests/run-all-tests.ts",
    "test:cross-validation": "tsx tests/cross-validation.test.ts",
    "test:pdf-storage": "tsx tests/pdf-storage.test.ts",
    "test:batch": "tsx tests/batch-processing.test.ts",
    "test:export": "tsx tests/export.test.ts"
  }
}
```

## 📝 Notas Importantes

1. **Autenticación**: Las pruebas requieren un token JWT válido en `TEST_AUTH_TOKEN`

2. **Base de datos**: Algunas pruebas asumen que las migraciones están aplicadas:
   ```bash
   npm run migrate:reference-data
   npm run migrate:pdf-storage
   npm run migrate:batch-processing
   ```

3. **Vercel Blob**: Las pruebas de PDF storage pueden ser saltadas si no hay `BLOB_READ_WRITE_TOKEN`

4. **IDs Mock**: Muchas pruebas usan IDs ficticios que no existen en la base de datos. Algunas se saltarán con status 404 (esperado).

5. **Alta Carga**: Las pruebas de alta carga pueden tardar varios minutos en completarse.

## 🐛 Debugging

Si una prueba falla:

1. Revisa los detalles en el reporte JSON
2. Verifica las variables de entorno
3. Confirma que las migraciones están aplicadas
4. Revisa los logs del servidor
5. Ejecuta la suite individual para debugging

## 📈 Métricas Evaluadas

Las pruebas evalúan:

- ✅ **Funcionalidad**: ¿Funciona como se espera?
- ⚡ **Performance**: ¿Es suficientemente rápido?
- 🔒 **Seguridad**: ¿Valida correctamente?
- 📊 **Escalabilidad**: ¿Soporta alta carga?
- 🛡️ **Robustez**: ¿Maneja errores correctamente?

## 🎯 Cobertura de Pruebas

| Funcionalidad | Cobertura |
|---------------|-----------|
| Excel Cross-Validation | 7 pruebas |
| PDF Storage | 7 pruebas |
| Batch Processing | 9 pruebas |
| Export | 10 pruebas |
| **TOTAL** | **33 pruebas** |

## 🚦 CI/CD

Estas pruebas pueden integrarse en tu pipeline de CI/CD:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run test:all
        env:
          TEST_AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}
          POSTGRES_URL: ${{ secrets.POSTGRES_URL }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

## 📞 Soporte

Si encuentras problemas con las pruebas, verifica:

1. Variables de entorno configuradas correctamente
2. Migraciones aplicadas
3. Servidor corriendo (si pruebas localmente)
4. Versiones de dependencias compatibles

---

**Última actualización**: 2025-01-09

**Versión de VerbadocPro**: 2.0.0
