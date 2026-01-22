/**
 * Generar un PDF de prueba con el expediente B241889AC
 * Usando los datos reales del Excel cargado
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import { jsPDF } from 'jspdf';
import * as fs from 'fs';
import * as path from 'path';

// Cargar variables de entorno
config({ path: '.env.production', override: true });

async function generateTestPDF() {
  console.log('🎨 GENERANDO PDF DE PRUEBA\n');

  try {
    // 1. Obtener datos reales del Excel
    console.log('📊 Obteniendo datos del expediente B241889AC...');
    const result = await sql`
      SELECT
        form_identifier,
        data
      FROM reference_data
      WHERE form_identifier = 'B241889AC'
      AND is_active = true
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      console.error('❌ No se encontró el expediente B241889AC');
      return;
    }

    const data = result.rows[0].data;
    console.log('✅ Datos obtenidos');
    console.log(`   Expediente: ${data.numero_expediente}`);
    console.log(`   Empresa: ${data.razon_social}`);
    console.log(`   CIF: ${data.nif_empresa}`);
    console.log();

    // 2. Crear PDF con jsPDF
    console.log('📄 Creando PDF...');
    const doc = new jsPDF();
    let yPos = 20;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CUESTIONARIO DE SATISFACCIÓN', 105, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(12);
    doc.text('FUNDAE - Formación Bonificada', 105, yPos, { align: 'center' });
    yPos += 15;

    // Sección I: Datos identificativos
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SECCIÓN I: DATOS IDENTIFICATIVOS DE LA ACCIÓN FORMATIVA', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const section1 = [
      { label: 'Nº Expediente:', value: data.numero_expediente || 'N/A' },
      { label: 'Empresa:', value: data.d_entidad || data.razon_social || 'N/A' },
      { label: 'CIF:', value: data.nif_empresa || 'N/A' },
      { label: 'Modalidad:', value: data.modalidad || data.d_modalidad_af || 'N/A' },
      { label: 'Acción Formativa:', value: data.accion_formativa || 'N/A' },
      { label: 'Horas:', value: String(data.horas_formacion || 'N/A') },
      { label: 'Tipo de Acceso:', value: data.tipo_acceso || 'N/A' }
    ];

    section1.forEach(item => {
      doc.setFont('helvetica', 'bold');
      doc.text(item.label, 25, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(item.value, 70, yPos);
      yPos += 7;
    });

    yPos += 5;

    // Sección II: Datos del participante (simulados realistas)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SECCIÓN II: DATOS DEL PARTICIPANTE', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const section2 = [
      { label: 'Edad:', value: '35 años' },
      { label: 'Sexo:', value: 'Hombre' },
      { label: 'Titulación:', value: 'Grado Universitario' },
      { label: 'Lugar de trabajo:', value: 'Madrid' },
      { label: 'Categoría profesional:', value: 'Técnico especialista' },
      { label: 'Tamaño empresa:', value: 'Más de 250 trabajadores' },
      { label: 'Antigüedad:', value: '5-10 años' },
      { label: 'Situación laboral:', value: 'Contrato indefinido' },
      { label: 'Nivel de estudios:', value: 'Universitarios' }
    ];

    section2.forEach(item => {
      doc.setFont('helvetica', 'bold');
      doc.text(item.label, 25, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(item.value, 70, yPos);
      yPos += 7;
    });

    yPos += 5;

    // Sección III: Valoraciones (simuladas)
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SECCIÓN III: VALORACIÓN DE LA ACCIÓN FORMATIVA', 20, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Valore del 1 (muy insatisfecho) al 4 (muy satisfecho)', 25, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const valoraciones = [
      'Contenidos del curso',
      'Duración del curso',
      'Horarios',
      'Metodología utilizada',
      'Documentación entregada',
      'Instalaciones y medios técnicos',
      'Profesorado'
    ];

    valoraciones.forEach((item, idx) => {
      const valor = 3 + (idx % 2); // Alternar entre 3 y 4
      doc.text(`${idx + 1}. ${item}`, 25, yPos);
      doc.text(`[${valor}]`, 150, yPos);
      yPos += 7;
    });

    yPos += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Satisfacción general:', 25, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text('Muy satisfecho', 70, yPos);
    yPos += 10;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Documento generado automáticamente para testing - ' + new Date().toLocaleDateString(), 105, 285, { align: 'center' });

    // 3. Guardar PDF
    const outputDir = path.join(process.cwd(), 'tests', 'fixtures', 'generated-forms');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `form_${data.numero_expediente}_test.pdf`;
    const filepath = path.join(outputDir, filename);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(filepath, pdfBuffer);

    console.log('✅ PDF generado exitosamente');
    console.log(`   📁 Ruta: ${filepath}`);
    console.log();

    return filepath;

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Ejecutar
generateTestPDF()
  .then(filepath => {
    console.log('🎉 LISTO PARA PROBAR');
    console.log('Ahora sube este PDF a: https://www.verbadocpro.eu');
  })
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
