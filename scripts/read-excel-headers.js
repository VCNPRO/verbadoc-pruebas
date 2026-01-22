/**
 * Script para leer headers de Excel
 */
import XLSX from 'xlsx';

const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ Falta ruta del archivo');
  console.log('Uso: node read-excel-headers.js <ruta-excel>');
  process.exit(1);
}

try {
  console.log('📂 Leyendo:', filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  console.log(`📊 Hoja: ${sheetName}`);

  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (data.length === 0) {
    console.log('❌ Excel vacío');
    process.exit(1);
  }

  const headers = data[0];
  console.log('\n📋 COLUMNAS ENCONTRADAS:');
  console.log('========================');
  headers.forEach((header, index) => {
    console.log(`${index + 1}. "${header}"`);
  });

  console.log('\n📊 Primera fila de datos (ejemplo):');
  console.log('====================================');
  if (data.length > 1) {
    const firstRow = data[1];
    headers.forEach((header, index) => {
      console.log(`${header}: ${firstRow[index]}`);
    });
  }

  console.log(`\n📈 Total de filas (incluyendo header): ${data.length}`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
