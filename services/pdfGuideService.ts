import jsPDF from 'jspdf';

// Professional Color Palette (RGB)
const COLORS = {
  primary: [14, 165, 233],
  primaryDark: [3, 105, 161],
  secondary: [100, 116, 139],
  accent: [168, 85, 247],
  success: [34, 197, 94],
  warning: [245, 158, 11],
  danger: [239, 68, 68],
  text: [15, 23, 42],
  textLight: [100, 116, 139],
  bgLight: [248, 250, 252],
  white: [255, 255, 255],
};

// Add header
function addHeader(doc: jsPDF, subtitle: string, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('verbadoc enterprises', 20, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 20, 24);
  doc.text(`Pag. ${pageNum}/${totalPages}`, pageWidth - 30, 15);
}

// Add footer
function addFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(20, pageHeight - 18, pageWidth - 20, pageHeight - 18);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('100% GDPR - Procesado en Europa', 20, pageHeight - 10);
  doc.text('verbadoc-enterprises.vercel.app', pageWidth - 70, pageHeight - 10);
}

// Add section title
function addSection(doc: jsPDF, y: number, title: string, color: number[]) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(20, y, pageWidth - 40, 10, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(title, 25, y + 7);

  return y + 15;
}

// Add info box
function addBox(doc: jsPDF, y: number, lines: string[], bgColor: number[], textColor: number[]) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const height = 8 + (lines.length * 5);

  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.roundedRect(20, y, pageWidth - 40, height, 2, 2, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);

  let currentY = y + 6;
  lines.forEach(line => {
    doc.text(line, 25, currentY);
    currentY += 5;
  });

  return y + height + 3;
}

// Add bullet list
function addBullets(doc: jsPDF, y: number, items: string[]) {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  let currentY = y;
  items.forEach(item => {
    doc.setFillColor(14, 165, 233);
    doc.circle(22, currentY - 2, 0.8, 'F');
    doc.text(item, 27, currentY);
    currentY += 5;
  });

  return currentY;
}

// QUICK GUIDE
export function generateQuickGuidePDF() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // PAGE 1
  addHeader(doc, 'Guia Rapida', 1, 2);
  addFooter(doc);

  let y = 50;

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 165, 233);
  doc.text('Guia Rapida', 20, y);
  y += 8;

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Comienza en 3 minutos', 20, y);
  y += 15;

  // AI Box
  y = addBox(doc, y, [
    'ASISTENTE IA - Tu mejor aliado',
    'Clasifica, valida y segmenta documentos con IA europea'
  ], [243, 232, 255], [15, 23, 42]);

  // Features
  y = addSection(doc, y, 'CLASIFICACION AUTOMATICA', COLORS.accent);
  y = addBullets(doc, y, [
    'Detecta el tipo de documento',
    'Sugiere esquema de extraccion perfecto',
    'Muestra nivel de confianza'
  ]);
  y += 5;

  y = addSection(doc, y, 'VALIDACION INTELIGENTE', COLORS.success);
  y = addBullets(doc, y, [
    'Revisa datos extraidos',
    'Detecta errores e inconsistencias',
    'Asigna puntuacion de calidad'
  ]);
  y += 5;

  y = addSection(doc, y, 'SEGMENTACION DE PDFs', COLORS.warning);
  y = addBullets(doc, y, [
    'Detecta multiples documentos',
    'Los separa automaticamente',
    'Procesa cada uno individualmente'
  ]);
  y += 10;

  // Steps
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 165, 233);
  doc.text('Empieza en 3 Pasos', 20, y);
  y += 8;

  // Step 1
  doc.setFillColor(219, 234, 254);
  doc.roundedRect(20, y, pageWidth - 40, 18, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(3, 105, 161);
  doc.text('1. SUBE TU DOCUMENTO', 25, y + 6);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Arrastra tu PDF/imagen o haz clic en "Haga clic para subir"', 25, y + 12);
  y += 22;

  // Step 2
  doc.setFillColor(243, 232, 255);
  doc.roundedRect(20, y, pageWidth - 40, 18, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(124, 58, 237);
  doc.text('2. USA EL ASISTENTE IA', 25, y + 6);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Click en "Clasificar Documento" - El esquema se llena solo', 25, y + 12);
  y += 22;

  // Step 3
  doc.setFillColor(209, 250, 229);
  doc.roundedRect(20, y, pageWidth - 40, 18, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text('3. EXTRAE Y DESCARGA', 25, y + 6);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Click "Ejecutar Extraccion" y luego "Excel" para descargar', 25, y + 12);

  // PAGE 2
  doc.addPage();
  addHeader(doc, 'Guia Rapida', 2, 2);
  addFooter(doc);

  y = 50;

  y = addSection(doc, y, 'TIPOS DE DOCUMENTOS', COLORS.secondary);
  y = addBullets(doc, y, [
    'Facturas: Facturas comerciales, recibos, tickets',
    'Formularios: Solicitudes, contratos, actas',
    'Reportes: Informes, documentos corporativos',
    'Medicos: Recetas, informes medicos',
    'Legales: Contratos, poderes, escrituras'
  ]);
  y += 10;

  y = addSection(doc, y, 'MEJORES PRACTICAS', COLORS.success);
  y = addBox(doc, y, [
    'HAZ ESTO:',
    '  Usa el Asistente IA siempre primero',
    '  Valida datos antes de exportar',
    '  Prueba con 1 antes de procesar 100',
    '  Exporta a Excel para analisis facil'
  ], [209, 250, 229], [5, 150, 105]);

  y = addBox(doc, y, [
    'EVITA ESTO:',
    '  No ignores el Asistente IA',
    '  No mezcles tipos de documentos',
    '  No proceses sin validar primero'
  ], [254, 226, 226], [220, 38, 38]);

  y += 5;
  y = addBox(doc, y, [
    'CUMPLIMIENTO GDPR - 100% EUROPEO',
    'Datos procesados en Europa (Europa)',
    'No se almacenan datos permanentemente'
  ], [209, 250, 229], [5, 150, 105]);

  doc.save('verbadoc_enterprises_Guia_Rapida.pdf');
}

// FULL GUIDE
export function generateFullGuidePDF() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // PAGE 1 - Cover
  addHeader(doc, 'Guia Completa', 1, 3);
  addFooter(doc);

  let y = 55;

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 165, 233);
  doc.text('Guia Completa', 20, y);
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('verbadoc enterprises', 20, y);
  y += 5;

  doc.setFontSize(11);
  doc.text('Extraccion profesional de datos con IA', 20, y);
  y += 15;

  y = addBox(doc, y, [
    'NUEVO: ASISTENTE IA INTEGRADO',
    'Clasifica, valida y segmenta documentos automaticamente',
    'IA avanzada 100% procesada en Europa'
  ], [243, 232, 255], [168, 85, 247]);

  y += 10;

  // TOC
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, y, pageWidth - 40, 80, 2, 2, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 165, 233);
  doc.text('INDICE DE CONTENIDOS', 25, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  const toc = [
    '1. El Asistente IA',
    '2. Guia Paso a Paso',
    '3. Procesamiento en Lote',
    '4. Solucion de Problemas',
    '5. Mejores Practicas',
    '6. Cumplimiento GDPR'
  ];

  let tocY = y + 18;
  toc.forEach(item => {
    doc.text(item, 30, tocY);
    tocY += 7;
  });

  // PAGE 2 - AI Assistant
  doc.addPage();
  addHeader(doc, 'Guia Completa', 2, 3);
  addFooter(doc);

  y = 50;

  y = addSection(doc, y, '1. EL ASISTENTE IA', COLORS.accent);

  y = addBox(doc, y, [
    'Panel inteligente que aparece al subir un documento.',
    'IA avanzada procesada 100% en Europa',
    'para garantizar cumplimiento GDPR.'
  ], [248, 250, 252], [15, 23, 42]);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 165, 233);
  doc.text('CLASIFICACION AUTOMATICA', 20, y);
  y += 5;

  y = addBullets(doc, y, [
    'Detecta automaticamente el tipo de documento',
    'Genera esquema de extraccion personalizado',
    'Muestra nivel de confianza e indicadores clave'
  ]);
  y += 8;

  doc.text('VALIDACION INTELIGENTE', 20, y);
  y += 5;

  y = addBullets(doc, y, [
    'Revisa datos extraidos vs documento original',
    'Detecta errores e inconsistencias',
    'Asigna score de calidad (0-100)'
  ]);
  y += 8;

  doc.text('SEGMENTACION DE PDFs', 20, y);
  y += 5;

  y = addBullets(doc, y, [
    'Detecta multiples documentos en un PDF',
    'Identifica inicio y fin de cada documento',
    'Permite procesarlos por separado'
  ]);
  y += 10;

  y = addSection(doc, y, '2. GUIA PASO A PASO', COLORS.primary);

  const steps = [
    'PASO 1: Abrir Aplicacion - verbadoc-enterprises.vercel.app',
    'PASO 2: Subir Documentos - Arrastra archivo o click',
    'PASO 3: Usar Asistente IA - Click "Clasificar Documento"',
    'PASO 4: Ejecutar Extraccion - Click "Ejecutar Extraccion"',
    'PASO 5: Validar - Click "Validar Datos" (opcional)',
    'PASO 6: Exportar - Click en "Excel" para descargar'
  ];

  y = addBullets(doc, y, steps);

  // PAGE 3
  doc.addPage();
  addHeader(doc, 'Guia Completa', 3, 3);
  addFooter(doc);

  y = 50;

  y = addSection(doc, y, '3. PROCESAMIENTO EN LOTE', COLORS.secondary);

  y = addBullets(doc, y, [
    'Sube todos los archivos (10, 20, 50...)',
    'Selecciona el primer archivo',
    'Usa Asistente IA para clasificarlo',
    'Ejecuta extraccion en el primero',
    'Verifica que resultados sean correctos',
    'Click en "Procesar Todos"'
  ]);
  y += 5;

  y = addBox(doc, y, [
    'IMPORTANTE:',
    'Todos los archivos deben ser del mismo tipo'
  ], [254, 243, 199], [146, 64, 14]);

  y += 5;

  y = addSection(doc, y, '4. SOLUCION DE PROBLEMAS', COLORS.danger);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  const problems = [
    ['El esquema esta vacio', 'Usa "Clasificar Documento"'],
    ['Datos incorrectos', 'Click "Validar Datos"'],
    ['Error 500', 'Recarga pagina (F5)'],
    ['No clasifica bien', 'Mejora calidad del escaneo']
  ];

  problems.forEach(([problem, solution]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`- ${problem}:`, 25, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${solution}`, 27, y);
    y += 6;
  });

  y += 5;

  y = addSection(doc, y, '5. MEJORES PRACTICAS', COLORS.success);

  y = addBox(doc, y, [
    'HAZ ESTO:',
    '  Usa el Asistente IA siempre primero',
    '  Valida datos antes de exportar',
    '  Prueba con 1 antes de procesar 100',
    '  Usa PDFs nativos (mejor que escaneados)'
  ], [209, 250, 229], [5, 150, 105]);

  y = addBox(doc, y, [
    'EVITA ESTO:',
    '  No ignores el Asistente IA',
    '  No mezcles tipos de documentos',
    '  No proceses sin validar primero'
  ], [254, 226, 226], [220, 38, 38]);

  y += 5;

  y = addSection(doc, y, '6. CUMPLIMIENTO GDPR', COLORS.success);

  y = addBox(doc, y, [
    '100% EUROPEO',
    'Datos procesados en Europa (Europa)',
    'No se almacenan datos permanentemente',
    'Cumplimiento total con regulaciones europeas'
  ], [209, 250, 229], [5, 150, 105]);

  doc.save('verbadoc_enterprises_Guia_Completa.pdf');
}
