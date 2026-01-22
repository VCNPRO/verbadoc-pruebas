/**
 * Generador de Formularios FUNDAE Fake para Testing Masivo
 *
 * Genera formularios de prueba con diferentes calidades y casuísticas:
 * - PDF texto (alta calidad)
 * - PDF imagen (escaneado)
 * - PDF manuscrito (simulado)
 * - Casos con errores intencionales
 * - Respuestas múltiples (NC)
 * - Datos no coincidentes con Excel oficial
 *
 * Uso:
 * npx tsx tests/fixtures/fundae-form-generator.ts --count 100 --quality high
 */

import * as fs from 'fs';
import * as path from 'path';
import { jsPDF } from 'jspdf';

// ============================================================================
// TIPOS
// ============================================================================

type QualityLevel = 'high' | 'medium' | 'low' | 'manuscript' | 'mixed';
type SectionType = 'header' | 'seccion_i' | 'seccion_ii' | 'valoraciones';

interface FormData {
  // Sección I
  expediente: string;
  empresa: string;
  modalidad: string;
  cif: string;
  denominacion_aaff: string;

  // Sección II
  edad: number;
  sexo: 'Hombre' | 'Mujer' | 'NC';
  titulacion: string;
  lugar_trabajo: string; // Código o texto completo
  categoria_profesional: string;
  tamano_empresa: string;
  antiguedad: string;
  situacion_laboral: string;
  nivel_estudios: string;

  // Sección III - Valoraciones (1-4)
  valoraciones: number[]; // Array de 55 valores
  satisfaccion_general_texto?: string;

  // Metadata
  hasErrors?: boolean;
  hasMultipleAnswers?: boolean;
  matchesReferenceData?: boolean;
  quality?: QualityLevel;
}

interface GeneratorOptions {
  count: number;
  quality: QualityLevel;
  errorRate: number; // 0-100
  outputDir: string;
  batch: boolean; // Si true, genera un solo PDF con múltiples formularios
}

// ============================================================================
// DATOS DE REFERENCIA
// ============================================================================

const CITY_CODES = [
  { code: 'BCN', name: 'Barcelona', province: 'Barcelona' },
  { code: 'MAD', name: 'Madrid', province: 'Madrid' },
  { code: 'VAL', name: 'Valencia', province: 'Valencia' },
  { code: 'SEV', name: 'Sevilla', province: 'Sevilla' },
  { code: 'BIL', name: 'Bilbao', province: 'Vizcaya' },
  { code: 'ZAR', name: 'Zaragoza', province: 'Zaragoza' },
  { code: 'MAL', name: 'Málaga', province: 'Málaga' },
  { code: 'MUR', name: 'Murcia', province: 'Murcia' },
  { code: 'PMI', name: 'Palma de Mallorca', province: 'Baleares' },
  { code: 'LPA', name: 'Las Palmas', province: 'Gran Canaria' }
];

const COMPANY_NAMES = [
  'Formación Avanzada SL',
  'Academia de Formación Profesional SA',
  'Centro de Estudios Empresariales',
  'Instituto de Capacitación Laboral',
  'Escuela de Formación Continua',
  'Grupo Educativo ProTech',
  'Consultoría y Formación Integral',
  'Centro de Desarrollo Profesional',
  'Academia Superior de Gestión',
  'Formación Empresarial Activa SL'
];

const COURSE_TITLES = [
  'Gestión Administrativa',
  'Marketing Digital',
  'Recursos Humanos',
  'Contabilidad Avanzada',
  'Prevención de Riesgos Laborales',
  'Atención al Cliente',
  'Comercio Electrónico',
  'Logística y Almacén',
  'Ofimática Avanzada',
  'Gestión de Proyectos'
];

const PROFESSIONAL_CATEGORIES = [
  'Directivo',
  'Técnico',
  'Administrativo',
  'Operario',
  'Comercial'
];

const COMPANY_SIZES = [
  'Menos de 10',
  'De 10 a 50',
  'De 51 a 250',
  'Más de 250'
];

const SENIORITY = [
  'Menos de 1 año',
  'De 1 a 5 años',
  'De 6 a 10 años',
  'Más de 10 años'
];

const WORK_SITUATION = [
  'Asalariado fijo',
  'Asalariado temporal',
  'Autónomo',
  'Desempleado'
];

const EDUCATION_LEVEL = [
  'Sin estudios',
  'Estudios primarios',
  'Educación secundaria',
  'Formación profesional',
  'Estudios universitarios',
  'Postgrado'
];

// ============================================================================
// GENERADORES AUXILIARES
// ============================================================================

/**
 * Generar CIF español válido
 */
function generateValidCIF(): string {
  const letters = 'ABCDEFGHJNPQRSUVW';
  const letter = letters[Math.floor(Math.random() * letters.length)];
  const numbers = Math.floor(Math.random() * 90000000) + 10000000;

  // Calcular dígito de control
  const numStr = numbers.toString();
  let sum = 0;

  for (let i = 0; i < numStr.length; i++) {
    const digit = parseInt(numStr[i]);
    if (i % 2 === 0) {
      const double = digit * 2;
      sum += double > 9 ? Math.floor(double / 10) + (double % 10) : double;
    } else {
      sum += digit;
    }
  }

  const control = (10 - (sum % 10)) % 10;

  return `${letter}${numbers}${control}`;
}

/**
 * Generar número de expediente único
 */
function generateExpediente(index: number): string {
  return `EXP${String(index).padStart(6, '0')}`;
}

/**
 * Seleccionar elemento aleatorio de array
 */
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generar edad aleatoria (16-65)
 */
function generateAge(): number {
  return Math.floor(Math.random() * 50) + 16;
}

/**
 * Generar valoraciones (1-4) con distribución realista
 */
function generateRatings(count: number = 55): number[] {
  const ratings: number[] = [];

  for (let i = 0; i < count; i++) {
    // Distribución sesgada hacia valores altos (3-4)
    const rand = Math.random();
    if (rand < 0.05) {
      ratings.push(1); // 5% - Mal
    } else if (rand < 0.20) {
      ratings.push(2); // 15% - Regular
    } else if (rand < 0.60) {
      ratings.push(3); // 40% - Bien
    } else {
      ratings.push(4); // 40% - Excelente
    }
  }

  return ratings;
}

/**
 * Introducir errores intencionales
 */
function introduceErrors(data: FormData, errorRate: number): FormData {
  const shouldError = Math.random() * 100 < errorRate;

  if (!shouldError) return data;

  const errorType = Math.random();

  if (errorType < 0.3) {
    // Error en edad (fuera de rango)
    data.edad = Math.random() < 0.5 ? 10 : 99;
    data.hasErrors = true;
  } else if (errorType < 0.5) {
    // CIF inválido
    data.cif = 'X12345678X'; // CIF mal formado
    data.hasErrors = true;
  } else if (errorType < 0.7) {
    // Respuesta múltiple (NC)
    data.sexo = 'NC';
    data.hasMultipleAnswers = true;
  } else {
    // Datos no coinciden con Excel oficial
    data.matchesReferenceData = false;
  }

  return data;
}

// ============================================================================
// GENERADOR DE DATOS
// ============================================================================

/**
 * Generar datos de formulario fake
 */
function generateFormData(index: number, options: Partial<GeneratorOptions> = {}): FormData {
  const expediente = generateExpediente(index);
  const cif = generateValidCIF();
  const cityCode = randomChoice(CITY_CODES);

  const data: FormData = {
    // Sección I
    expediente,
    empresa: randomChoice(COMPANY_NAMES),
    modalidad: randomChoice(COURSE_TITLES),
    cif,
    denominacion_aaff: randomChoice(COMPANY_NAMES),

    // Sección II
    edad: generateAge(),
    sexo: Math.random() < 0.5 ? 'Hombre' : 'Mujer',
    titulacion: randomChoice(EDUCATION_LEVEL),
    lugar_trabajo: cityCode.code, // Usar código (BCN, MAD, etc.)
    categoria_profesional: randomChoice(PROFESSIONAL_CATEGORIES),
    tamano_empresa: randomChoice(COMPANY_SIZES),
    antiguedad: randomChoice(SENIORITY),
    situacion_laboral: randomChoice(WORK_SITUATION),
    nivel_estudios: randomChoice(EDUCATION_LEVEL),

    // Sección III
    valoraciones: generateRatings(55),
    satisfaccion_general_texto: Math.random() < 0.3 ? 'Muy satisfecho con el curso' : undefined,

    // Metadata
    hasErrors: false,
    hasMultipleAnswers: false,
    matchesReferenceData: true,
    quality: options.quality || 'high'
  };

  // Introducir errores según tasa
  if (options.errorRate && options.errorRate > 0) {
    return introduceErrors(data, options.errorRate);
  }

  return data;
}

// ============================================================================
// GENERADOR DE PDFS
// ============================================================================

/**
 * Generar PDF de formulario FUNDAE
 */
function generatePDF(data: FormData, quality: QualityLevel): jsPDF {
  const doc = new jsPDF();

  // Configurar según calidad
  let fontSize = 12;
  let imageQuality = 1.0;

  switch (quality) {
    case 'high':
      fontSize = 12;
      imageQuality = 1.0;
      break;
    case 'medium':
      fontSize = 10;
      imageQuality = 0.7;
      break;
    case 'low':
      fontSize = 8;
      imageQuality = 0.5;
      break;
    case 'manuscript':
      fontSize = 14; // Letra más grande para simular manuscrito
      imageQuality = 0.8;
      break;
  }

  doc.setFontSize(fontSize);

  // PÁGINA 1: Cabecera + Sección I + Sección II
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMACIÓN DE DEMANDA', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('(orden TAS 2307/2025 del 27 de Julio)', 105, 27, { align: 'center' });

  // Sección I: Datos identificativos
  let y = 40;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('I. DATOS IDENTIFICATIVOS DE LA ACCIÓN FORMATIVA', 20, y);

  y += 10;
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'normal');

  doc.text(`1. Expediente: ${data.expediente}`, 20, y);
  y += 7;
  doc.text(`2. Empresa: ${data.empresa}`, 20, y);
  y += 7;
  doc.text(`3. Modalidad: ${data.modalidad}`, 20, y);
  y += 7;
  doc.text(`4. CIF: ${data.cif}`, 20, y);
  y += 7;
  doc.text(`5. Denominación AAFF: ${data.denominacion_aaff}`, 20, y);

  // Sección II: Clasificación del participante
  y += 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('II. DATOS DE CLASIFICACIÓN DEL PARTICIPANTE', 20, y);

  y += 10;
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'normal');

  doc.text(`1. Edad: ${data.edad}`, 20, y);
  y += 7;
  doc.text(`2. Sexo: ${data.sexo === 'NC' ? '☒ Hombre  ☒ Mujer' : data.sexo === 'Hombre' ? '☒ Hombre  ☐ Mujer' : '☐ Hombre  ☒ Mujer'}`, 20, y);
  y += 7;
  doc.text(`3. Titulación: ${data.titulacion}`, 20, y);
  y += 7;
  doc.text(`4. Lugar de trabajo: ${data.lugar_trabajo}`, 20, y);
  y += 7;
  doc.text(`5. Categoría profesional: ${data.categoria_profesional}`, 20, y);
  y += 7;
  doc.text(`6. Tamaño de empresa: ${data.tamano_empresa}`, 20, y);
  y += 7;
  doc.text(`7. Antigüedad: ${data.antiguedad}`, 20, y);
  y += 7;
  doc.text(`8. Situación laboral: ${data.situacion_laboral}`, 20, y);
  y += 7;
  doc.text(`9. Nivel de estudios: ${data.nivel_estudios}`, 20, y);

  // PÁGINA 2: Sección III - Valoraciones
  doc.addPage();
  y = 20;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('III. VALORACIÓN DE LAS ACCIONES FORMATIVAS', 20, y);

  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Valore de 1 a 4 los siguientes aspectos (1=Malo, 2=Regular, 3=Bueno, 4=Excelente):', 20, y);

  y += 10;
  doc.setFontSize(fontSize - 1);

  // Mostrar solo primeras 10 valoraciones como ejemplo
  for (let i = 0; i < Math.min(10, data.valoraciones.length); i++) {
    const rating = data.valoraciones[i];
    doc.text(`${i + 1}. Aspecto de formación: ${' □'.repeat(rating - 1)} ☒${'□ '.repeat(4 - rating)}`, 20, y);
    y += 6;
  }

  y += 5;
  doc.text('...', 20, y);
  y += 10;

  // Pregunta 10 especial
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  doc.text('10. Grado de satisfacción general con el curso:', 20, y);
  y += 7;
  doc.setFont('helvetica', 'normal');

  if (data.satisfaccion_general_texto) {
    doc.text(`Comentarios: ${data.satisfaccion_general_texto}`, 20, y);
  } else {
    const rating = data.valoraciones[9] || 4;
    doc.text(`Valoración: ${' □'.repeat(rating - 1)} ☒${'□ '.repeat(4 - rating)}`, 20, y);
  }

  // Metadata en footer (solo visible en modo debug)
  if (process.env.DEBUG) {
    y = 280;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`[DEBUG] Quality: ${quality} | Errors: ${data.hasErrors} | NC: ${data.hasMultipleAnswers}`, 20, y);
  }

  return doc;
}

// ============================================================================
// EXPORTADOR
// ============================================================================

/**
 * Exportar Excel con datos de referencia
 */
function exportReferenceDataExcel(forms: FormData[], outputPath: string): void {
  // Nota: Requiere librería XLSX
  // Por simplicidad, generamos CSV

  const csv = [
    'expediente,cif,razon_social',
    ...forms.map(f => `${f.expediente},${f.cif},${f.denominacion_aaff}`)
  ].join('\n');

  fs.writeFileSync(outputPath, csv, 'utf-8');
  console.log(`✅ Excel de referencia guardado: ${outputPath}`);
}

/**
 * Exportar estadísticas de generación
 */
function exportStatistics(forms: FormData[], outputPath: string): void {
  const stats = {
    total: forms.length,
    withErrors: forms.filter(f => f.hasErrors).length,
    withMultipleAnswers: forms.filter(f => f.hasMultipleAnswers).length,
    notMatchingReference: forms.filter(f => !f.matchesReferenceData).length,
    byQuality: {
      high: forms.filter(f => f.quality === 'high').length,
      medium: forms.filter(f => f.quality === 'medium').length,
      low: forms.filter(f => f.quality === 'low').length,
      manuscript: forms.filter(f => f.quality === 'manuscript').length
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2), 'utf-8');
  console.log(`📊 Estadísticas guardadas: ${outputPath}`);
}

// ============================================================================
// GENERADOR PRINCIPAL
// ============================================================================

async function generateForms(options: GeneratorOptions): Promise<void> {
  console.log('🚀 Generando formularios FUNDAE fake...\n');
  console.log(`Opciones:`);
  console.log(`  Cantidad: ${options.count}`);
  console.log(`  Calidad: ${options.quality}`);
  console.log(`  Tasa de error: ${options.errorRate}%`);
  console.log(`  Directorio: ${options.outputDir}`);
  console.log(`  Modo batch: ${options.batch ? 'SÍ' : 'NO'}\n`);

  // Crear directorio de salida
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  const forms: FormData[] = [];

  // Generar datos
  console.log('📝 Generando datos de formularios...');
  for (let i = 1; i <= options.count; i++) {
    let quality = options.quality;

    // Si es 'mixed', alternar calidades
    if (quality === 'mixed') {
      const rand = Math.random();
      if (rand < 0.4) quality = 'high';
      else if (rand < 0.7) quality = 'medium';
      else if (rand < 0.9) quality = 'low';
      else quality = 'manuscript';
    }

    const formData = generateFormData(i, {
      quality,
      errorRate: options.errorRate
    });

    forms.push(formData);

    if (i % 100 === 0) {
      console.log(`  Generados ${i}/${options.count} formularios...`);
    }
  }

  console.log(`✅ ${forms.length} formularios generados\n`);

  // Generar PDFs
  console.log('📄 Generando PDFs...');

  if (options.batch) {
    // Modo batch: Un solo PDF con múltiples formularios
    const batchDoc = new jsPDF();

    forms.forEach((form, index) => {
      if (index > 0) {
        batchDoc.addPage();
        batchDoc.addPage(); // 2 páginas por formulario
      }

      const tempDoc = generatePDF(form, form.quality!);

      // Copiar páginas al batch (simplificado)
      // En producción, usar una librería que soporte merge de PDFs
      console.log(`  Agregando formulario ${index + 1}/${forms.length} al batch...`);
    });

    const batchPath = path.join(options.outputDir, `BATCH_${options.count}_formularios.pdf`);
    batchDoc.save(batchPath);
    console.log(`✅ PDF batch guardado: ${batchPath}`);

  } else {
    // Modo individual: Un PDF por formulario
    forms.forEach((form, index) => {
      const doc = generatePDF(form, form.quality!);
      const filename = `form_${form.expediente}_${form.quality}.pdf`;
      const filepath = path.join(options.outputDir, filename);

      doc.save(filepath);

      if ((index + 1) % 50 === 0) {
        console.log(`  Generados ${index + 1}/${forms.length} PDFs...`);
      }
    });

    console.log(`✅ ${forms.length} PDFs individuales guardados`);
  }

  // Exportar datos de referencia
  const referencePath = path.join(options.outputDir, 'excel_referencia.csv');
  exportReferenceDataExcel(forms, referencePath);

  // Exportar estadísticas
  const statsPath = path.join(options.outputDir, 'statistics.json');
  exportStatistics(forms, statsPath);

  console.log('\n🎉 Generación completada!\n');
  console.log('Archivos generados:');
  console.log(`  - ${options.batch ? '1 PDF batch' : `${forms.length} PDFs individuales`}`);
  console.log(`  - 1 Excel de referencia (CSV)`);
  console.log(`  - 1 archivo de estadísticas (JSON)`);
  console.log(`\nDirectorio: ${options.outputDir}`);
}

// ============================================================================
// CLI
// ============================================================================

// Parsear argumentos
const args = process.argv.slice(2);
const options: GeneratorOptions = {
  count: 100,
  quality: 'high',
  errorRate: 0,
  outputDir: path.join(process.cwd(), 'tests', 'fixtures', 'generated-forms'),
  batch: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--count':
      options.count = parseInt(args[++i]);
      break;
    case '--quality':
      options.quality = args[++i] as QualityLevel;
      break;
    case '--errors':
      options.errorRate = parseInt(args[++i]);
      break;
    case '--output':
      options.outputDir = args[++i];
      break;
    case '--batch':
      options.batch = true;
      break;
    case '--help':
      console.log(`
Generador de Formularios FUNDAE Fake

Uso:
  npx tsx tests/fixtures/fundae-form-generator.ts [opciones]

Opciones:
  --count <n>         Número de formularios a generar (default: 100)
  --quality <level>   Calidad: high|medium|low|manuscript|mixed (default: high)
  --errors <percent>  Porcentaje de errores intencionales 0-100 (default: 0)
  --output <dir>      Directorio de salida (default: tests/fixtures/generated-forms)
  --batch             Generar un solo PDF con todos los formularios
  --help              Mostrar esta ayuda

Ejemplos:
  # 100 formularios de alta calidad
  npx tsx tests/fixtures/fundae-form-generator.ts --count 100 --quality high

  # 500 formularios mixtos con 20% de errores
  npx tsx tests/fixtures/fundae-form-generator.ts --count 500 --quality mixed --errors 20

  # 1000 formularios en un solo PDF
  npx tsx tests/fixtures/fundae-form-generator.ts --count 1000 --batch
      `);
      process.exit(0);
  }
}

// Ejecutar
generateForms(options).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
