/**
 * cityCodes.ts
 *
 * Mapeo de códigos de ciudades españolas a nombre completo
 * Para campo "Lugar de trabajo" en formularios FUNDAE
 *
 * Los usuarios pueden introducir códigos abreviados (BCN, MAD, etc.)
 * y el sistema los expande automáticamente al nombre completo
 */

/**
 * Mapeo principal de códigos de ciudades
 */
export const CITY_CODES: Record<string, string> = {
  // Códigos → provincia oficial (MAYÚSCULAS para D_LUGAR_DE_TRABAJO)
  'MAD': 'MADRID', 'MSD': 'MADRID',
  'BCN': 'BARCELONA',
  'VLC': 'VALENCIA/VALENCIA',
  'SVQ': 'SEVILLA',
  'ZGZ': 'ZARAGOZA',
  'MLG': 'MALAGA',
  'BIO': 'BIZKAIA/VIZCAYA',
  'PMI': 'BALEARS, ILLES',
  'ALC': 'ALICANTE/ALACANT',
  'COR': 'CORDOBA',
  'VLL': 'VALLADOLID',
  'VGO': 'PONTEVEDRA',
  'GIJ': 'ASTURIAS',
  'OVI': 'ASTURIAS',
  'SAN': 'CANTABRIA',
  'GRX': 'GRANADA',
  'MUR': 'MURCIA',
  'SCQ': 'CORUÑA/A CORUÑA',
  'ELX': 'ALICANTE/ALACANT',
  'GET': 'MADRID',
  'LEG': 'MADRID',
  'FUE': 'MADRID',
  'MOS': 'MADRID',
  'BAD': 'BADAJOZ',
  'CAR': 'MURCIA',
  'JER': 'CADIZ',
  'TER': 'BARCELONA',
  'SAB': 'BARCELONA',
  'BDA': 'BARCELONA',
  'HOS': 'BARCELONA',
  'CRD': 'CORUÑA/A CORUÑA',
  'ALM': 'ALMERIA',
  'HUE': 'HUELVA',
  'CAD': 'CADIZ',
  'JAE': 'JAEN',
  'ORE': 'OURENSE',
  'CAS': 'CASTELLON/CASTELLO',
  'STA': 'CANTABRIA',
  'LOG': 'RIOJA, LA',
  'POM': 'PONTEVEDRA',
  'CUE': 'CUENCA',
  'TOL': 'TOLEDO',
  'LLE': 'LLEIDA/LERIDA',
  'GER': 'GIRONA/GERONA',
  'TAR': 'TARRAGONA',
  'BUR': 'BURGOS',
  'LEO': 'LEON',
  'SAL': 'SALAMANCA',
  'ZAM': 'ZAMORA',
  'PAL': 'PALENCIA',
  'SEG': 'SEGOVIA',
  'AVI': 'AVILA',
  'SOR': 'SORIA',
  'LUG': 'LUGO',
  'CAC': 'CACERES',
  'ALB': 'ALBACETE',
  'GUA': 'GUADALAJARA',
  'REA': 'CIUDAD REAL',
  'NAV': 'NAVARRA',
  'CEU': 'CEUTA',
  'MEL': 'MELILLA',
  'HUE': 'HUELVA',
  'TEN': 'SANTA CRUZ DE TENERIFE',
  'LPA': 'PALMAS, LAS',
};

/**
 * Resuelve código de ciudad a nombre completo
 * Si el código no existe, devuelve el valor original sin cambios
 *
 * @param code - Código de ciudad (ej: "BCN", "MAD")
 * @returns Nombre completo de la ciudad o el código original si no se encuentra
 *
 * @example
 * resolveCityCode("BCN") // "Barcelona"
 * resolveCityCode("MAD") // "Madrid"
 * resolveCityCode("DESCONOCIDO") // "DESCONOCIDO"
 */
export function resolveCityCode(code: string): string {
  if (!code) return code;

  const upperCode = code.trim().toUpperCase();
  return CITY_CODES[upperCode] || code;  // Si no está en catálogo, devolver original
}

/**
 * Carga catálogo de códigos desde Excel del cliente
 * Formato esperado del Excel:
 * - Columna 1: Codigo (BCN, MAD, etc.)
 * - Columna 2: Ciudad (Barcelona, Madrid, etc.)
 *
 * @param excelBuffer - Buffer del archivo Excel
 * @returns Objeto con mapeo código -> ciudad
 *
 * @example
 * const buffer = await readFile('codigos_ciudades.xlsx');
 * const codes = await loadCityCodesFromExcel(buffer);
 * // { "BCN": "Barcelona", "MAD": "Madrid", ... }
 */
export async function loadCityCodesFromExcel(excelBuffer: ArrayBuffer): Promise<Record<string, string>> {
  // Importar XLSX dinámicamente
  const XLSX = await import('xlsx');

  // Parsear Excel (ArrayBuffer para navegador)
  const workbook = XLSX.read(excelBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);

  const codes: Record<string, string> = {};

  for (const row of rows) {
    // Buscar columnas (case-insensitive)
    const codigo = row['Codigo'] || row['CODIGO'] || row['codigo'] || row['Code'] || row['CODE'];
    const ciudad = row['Ciudad'] || row['CIUDAD'] || row['ciudad'] || row['City'] || row['CITY'] || row['Nombre'];

    if (codigo && ciudad) {
      const codigoNormalizado = String(codigo).trim().toUpperCase();
      const ciudadNormalizada = String(ciudad).trim();

      codes[codigoNormalizado] = ciudadNormalizada;
    }
  }

  console.log(`📍 Catálogo de ciudades cargado: ${Object.keys(codes).length} códigos`);
  return codes;
}

/**
 * Guarda catálogo de códigos en localStorage para uso persistente
 *
 * @param codes - Objeto con mapeo código -> ciudad
 */
export function saveCityCodesCatalog(codes: Record<string, string>): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('city_codes_catalog', JSON.stringify(codes));
    localStorage.setItem('city_codes_catalog_timestamp', new Date().toISOString());
    console.log('✅ Catálogo de ciudades guardado en localStorage');
  }
}

/**
 * Carga catálogo de códigos desde localStorage
 *
 * @returns Objeto con mapeo código -> ciudad, o catálogo por defecto si no existe
 */
export function loadCityCodesCatalog(): Record<string, string> {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem('city_codes_catalog');
    if (stored) {
      try {
        const codes = JSON.parse(stored);
        console.log(`📍 Catálogo de ciudades cargado desde localStorage: ${Object.keys(codes).length} códigos`);
        return codes;
      } catch (error) {
        console.error('Error al parsear catálogo de localStorage:', error);
      }
    }
  }

  // Retornar catálogo por defecto
  console.log('📍 Usando catálogo de ciudades por defecto');
  return CITY_CODES;
}

/**
 * Valida que un código de ciudad existe en el catálogo
 *
 * @param code - Código a validar
 * @param customCatalog - Catálogo personalizado (opcional)
 * @returns true si el código existe, false en caso contrario
 */
export function isValidCityCode(code: string, customCatalog?: Record<string, string>): boolean {
  if (!code) return false;

  const catalog = customCatalog || loadCityCodesCatalog();
  const upperCode = code.trim().toUpperCase();

  return upperCode in catalog;
}

/**
 * Obtiene lista de todos los códigos disponibles
 *
 * @param customCatalog - Catálogo personalizado (opcional)
 * @returns Array de códigos de ciudades
 */
export function getAllCityCodes(customCatalog?: Record<string, string>): string[] {
  const catalog = customCatalog || loadCityCodesCatalog();
  return Object.keys(catalog).sort();
}

/**
 * Busca ciudades por nombre parcial (para autocompletado)
 *
 * @param searchTerm - Término de búsqueda
 * @param customCatalog - Catálogo personalizado (opcional)
 * @returns Array de objetos { code, city }
 *
 * @example
 * searchCities("bar") // [{ code: "BCN", city: "Barcelona" }]
 */
export function searchCities(
  searchTerm: string,
  customCatalog?: Record<string, string>
): Array<{ code: string; city: string }> {
  if (!searchTerm || searchTerm.trim().length < 2) return [];

  const catalog = customCatalog || loadCityCodesCatalog();
  const term = searchTerm.toLowerCase();

  const results: Array<{ code: string; city: string }> = [];

  for (const [code, city] of Object.entries(catalog)) {
    if (code.toLowerCase().includes(term) || city.toLowerCase().includes(term)) {
      results.push({ code, city });
    }
  }

  return results.slice(0, 10);  // Limitar a 10 resultados
}
