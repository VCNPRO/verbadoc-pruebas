import XLSX from 'xlsx';

const filePath = 'C:\\Users\\solam\\Downloads\\SS339586_Final_v2 para validar.xlsx';

try {
  console.log('📊 Analizando Excel de Validación...\n');

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  console.log('Hoja activa:', sheetName);

  const worksheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(worksheet);

  console.log('Total registros:', data.length);
  console.log('');

  if (data.length > 0) {
    console.log('📋 Columnas detectadas:');
    Object.keys(data[0]).forEach(col => console.log('  -', col));
    console.log('');

    // Buscar varios expedientes
    console.log('🔍 Buscando expedientes de los PDFs...\n');

    const expedientesToFind = ['B241889AC', 'B241579AC', 'B241669AI', 'B211801AA'];

    expedientesToFind.forEach(expToFind => {
      const found = data.find(row => {
        const expediente = row['D_EXPEDIENTE'] || row['expediente'] || row['Expediente'] || row['EXPEDIENTE'];
        return expediente && String(expediente).trim() === expToFind;
      });

      if (found) {
        console.log(`✅ ${expToFind} - ENCONTRADO`);
        console.log(`   CIF: ${found.CIF || found.cif}`);
        console.log(`   Razón: ${found.D_RAZON_SOCIAL || found.razon_social}`);
        console.log('');
      } else {
        console.log(`❌ ${expToFind} - NO encontrado`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('Primeros 10 expedientes en el Excel:');
    data.slice(0, 10).forEach((row, i) => {
      const exp = row['D_EXPEDIENTE'];
      const cif = row['CIF'];
      console.log(`  ${i+1}. ${exp} - CIF: ${cif}`);
    });
  }

} catch (error: any) {
  console.error('❌ Error:', error.message);
}
