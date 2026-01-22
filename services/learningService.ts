// Learning Service - Sistema de Aprendizaje Continuo
// Almacena correcciones del usuario y detecta patrones para mejorar el sistema

// ============================================
// TIPOS Y INTERFACES
// ============================================

export interface Correction {
  id: string;
  documentType: string;
  documentHash: string;
  fieldName: string;
  originalValue: any;
  correctedValue: any;
  errorType: string;
  timestamp: string;
  userId?: string;
}

export interface LearningPattern {
  id: string;
  documentType: string;
  fieldName: string;
  errorPattern: string;
  frequency: number;
  suggestedFix: string;
  examples: string[];
  lastOccurrence: string;
  confidence: number;
  status: 'pending' | 'applied' | 'rejected';
}

export interface ImprovementSuggestion {
  pattern: LearningPattern;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: string;
  actionRequired: string;
}

// ============================================
// ALMACENAMIENTO (localStorage con fallback)
// ============================================

const STORAGE_KEYS = {
  CORRECTIONS: 'verbadoc_corrections',
  PATTERNS: 'verbadoc_learning_patterns',
  STATS: 'verbadoc_learning_stats'
};

/**
 * Guarda una corrección del usuario
 * IMPORTANTE: Aquí usamos localStorage. Si tienes Vercel KV, puedes migrar fácilmente.
 */
export async function saveCorrection(correction: Omit<Correction, 'id' | 'timestamp'>): Promise<Correction> {

  const fullCorrection: Correction = {
    ...correction,
    id: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString()
  };

  try {
    // Obtener correcciones existentes
    const corrections = getAllCorrections();

    // Añadir nueva corrección
    corrections.push(fullCorrection);

    // Guardar en localStorage
    localStorage.setItem(STORAGE_KEYS.CORRECTIONS, JSON.stringify(corrections));

    console.log(`✅ Corrección guardada: ${fullCorrection.fieldName} en ${fullCorrection.documentType}`);

    // Analizar y actualizar patrones
    await analyzeAndUpdatePatterns(fullCorrection);

    // Actualizar estadísticas
    updateLearningStats(fullCorrection);

    return fullCorrection;

  } catch (error) {
    console.error('❌ Error guardando corrección:', error);
    throw new Error('No se pudo guardar la corrección');
  }
}

/**
 * Guarda múltiples correcciones de una sola vez
 */
export async function saveBulkCorrections(corrections: Omit<Correction, 'id' | 'timestamp'>[]): Promise<Correction[]> {
  const savedCorrections: Correction[] = [];

  for (const correction of corrections) {
    try {
      const saved = await saveCorrection(correction);
      savedCorrections.push(saved);
    } catch (error) {
      console.error('Error guardando corrección individual:', error);
    }
  }

  console.log(`💾 Guardadas ${savedCorrections.length}/${corrections.length} correcciones`);

  return savedCorrections;
}

/**
 * Obtiene todas las correcciones guardadas
 */
export function getAllCorrections(): Correction[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CORRECTIONS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error leyendo correcciones:', error);
    return [];
  }
}

/**
 * Obtiene correcciones por tipo de documento
 */
export function getCorrectionsByDocumentType(documentType: string): Correction[] {
  const all = getAllCorrections();
  return all.filter(c => c.documentType === documentType);
}

/**
 * Obtiene correcciones por campo específico
 */
export function getCorrectionsByField(documentType: string, fieldName: string): Correction[] {
  const byType = getCorrectionsByDocumentType(documentType);
  return byType.filter(c => c.fieldName === fieldName);
}

// ============================================
// ANÁLISIS DE PATRONES
// ============================================

/**
 * Analiza una corrección y actualiza patrones de error
 */
async function analyzeAndUpdatePatterns(correction: Correction): Promise<void> {

  const patternKey = `${correction.documentType}:${correction.fieldName}`;
  const errorPattern = detectErrorPattern(correction.originalValue, correction.correctedValue);

  // Obtener patrones existentes
  const patterns = getAllPatterns();
  const existingPattern = patterns.find(p =>
    p.documentType === correction.documentType &&
    p.fieldName === correction.fieldName &&
    p.errorPattern === errorPattern
  );

  if (existingPattern) {
    // Actualizar patrón existente
    existingPattern.frequency += 1;
    existingPattern.lastOccurrence = correction.timestamp;
    existingPattern.confidence = Math.min(0.99, existingPattern.frequency / 10); // Max 99%

    // Añadir ejemplo si no existe
    const example = `${correction.originalValue} → ${correction.correctedValue}`;
    if (!existingPattern.examples.includes(example) && existingPattern.examples.length < 5) {
      existingPattern.examples.push(example);
    }

  } else {
    // Crear nuevo patrón
    const newPattern: LearningPattern = {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentType: correction.documentType,
      fieldName: correction.fieldName,
      errorPattern,
      frequency: 1,
      suggestedFix: String(correction.correctedValue),
      examples: [`${correction.originalValue} → ${correction.correctedValue}`],
      lastOccurrence: correction.timestamp,
      confidence: 0.1,
      status: 'pending'
    };

    patterns.push(newPattern);
  }

  // Guardar patrones actualizados
  localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(patterns));

  console.log(`🧠 Patrón actualizado: ${errorPattern} (frecuencia: ${existingPattern?.frequency || 1})`);
}

/**
 * Detecta el tipo de error comparando valor original y corregido
 */
function detectErrorPattern(original: any, corrected: any): string {

  if (original === null || original === undefined || original === '') {
    return 'Campo faltante o vacío';
  }

  if (typeof original === 'string' && typeof corrected === 'string') {
    const orig = original.toLowerCase().trim();
    const corr = corrected.toLowerCase().trim();

    // OCR confunde caracteres similares
    if (orig.replace(/8/g, 'b') === corr || orig.replace(/b/g, '8') === corr) {
      return 'OCR confunde 8 con B';
    }
    if (orig.replace(/0/g, 'o') === corr || orig.replace(/o/g, '0') === corr) {
      return 'OCR confunde 0 con O';
    }
    if (orig.replace(/1/g, 'i') === corr || orig.replace(/i/g, '1') === corr) {
      return 'OCR confunde 1 con I';
    }
    if (orig.replace(/5/g, 's') === corr || orig.replace(/s/g, '5') === corr) {
      return 'OCR confunde 5 con S';
    }

    // Formato incorrecto
    if (orig.length !== corr.length) {
      if (corr.length > orig.length) {
        return 'Falta parte del texto';
      } else {
        return 'Texto con caracteres extra';
      }
    }

    // Espacios mal interpretados
    if (orig.replace(/\s/g, '') === corr.replace(/\s/g, '')) {
      return 'Espaciado incorrecto';
    }

    // Mayúsculas/minúsculas
    if (orig === corr) {
      return 'Capitalización incorrecta';
    }

    return 'Texto incorrecto';
  }

  if (typeof original === 'number' && typeof corrected === 'number') {
    const diff = Math.abs(original - corrected);
    if (diff < 1) {
      return 'Error decimal o redondeo';
    }
    if (String(original).length !== String(corrected).length) {
      return 'Dígito faltante o extra';
    }
    return 'Número incorrecto';
  }

  return 'Valor incorrecto';
}

/**
 * Obtiene todos los patrones detectados
 */
export function getAllPatterns(): LearningPattern[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PATTERNS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error leyendo patrones:', error);
    return [];
  }
}

/**
 * Obtiene patrones que superan el umbral de frecuencia (candidatos para mejoras)
 */
export function getSignificantPatterns(minFrequency: number = 3): LearningPattern[] {
  const all = getAllPatterns();
  return all
    .filter(p => p.frequency >= minFrequency)
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Obtiene sugerencias de mejora priorizadas
 */
export function getSuggestedImprovements(): ImprovementSuggestion[] {
  const patterns = getSignificantPatterns(3);

  return patterns.map(pattern => {
    let priority: 'high' | 'medium' | 'low' = 'low';
    let estimatedImpact = '';
    let actionRequired = '';

    if (pattern.frequency >= 10) {
      priority = 'high';
      estimatedImpact = `Afecta ~${pattern.frequency}+ documentos. Mejora potencial: ${(pattern.frequency * 2)}% menos errores en "${pattern.fieldName}"`;
      actionRequired = 'Actualizar prompt o añadir regla de validación específica';
    } else if (pattern.frequency >= 5) {
      priority = 'medium';
      estimatedImpact = `Afecta ${pattern.frequency} documentos. Mejora moderada esperada`;
      actionRequired = 'Considerar añadir ejemplo específico en prompt';
    } else {
      priority = 'low';
      estimatedImpact = `Afecta ${pattern.frequency} documentos. Mejora menor`;
      actionRequired = 'Monitorear si la frecuencia aumenta';
    }

    return {
      pattern,
      priority,
      estimatedImpact,
      actionRequired
    };
  }).sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

// ============================================
// ESTADÍSTICAS
// ============================================

interface LearningStats {
  totalCorrections: number;
  totalPatterns: number;
  documentTypesProcessed: string[];
  lastUpdate: string;
  improvementsApplied: number;
}

function updateLearningStats(correction: Correction): void {
  const stats = getLearningStats();

  stats.totalCorrections += 1;
  stats.lastUpdate = correction.timestamp;

  if (!stats.documentTypesProcessed.includes(correction.documentType)) {
    stats.documentTypesProcessed.push(correction.documentType);
  }

  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

export function getLearningStats(): LearningStats {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.STATS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error leyendo stats:', error);
  }

  return {
    totalCorrections: 0,
    totalPatterns: 0,
    documentTypesProcessed: [],
    lastUpdate: new Date().toISOString(),
    improvementsApplied: 0
  };
}

/**
 * Marca un patrón como aplicado (mejora implementada)
 */
export function markPatternAsApplied(patternId: string): void {
  const patterns = getAllPatterns();
  const pattern = patterns.find(p => p.id === patternId);

  if (pattern) {
    pattern.status = 'applied';
    localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(patterns));

    const stats = getLearningStats();
    stats.improvementsApplied += 1;
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));

    console.log(`✅ Patrón marcado como aplicado: ${pattern.errorPattern}`);
  }
}

/**
 * Genera hash único para un documento (para detectar duplicados)
 */
export function generateDocumentHash(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Limpia todos los datos de aprendizaje (usar con precaución)
 */
export function clearAllLearningData(): void {
  if (confirm('¿Estás seguro de eliminar TODOS los datos de aprendizaje? Esta acción no se puede deshacer.')) {
    localStorage.removeItem(STORAGE_KEYS.CORRECTIONS);
    localStorage.removeItem(STORAGE_KEYS.PATTERNS);
    localStorage.removeItem(STORAGE_KEYS.STATS);
    console.log('🗑️ Datos de aprendizaje eliminados');
  }
}

/**
 * Exporta todos los datos de aprendizaje a JSON
 */
export function exportLearningData(): {
  corrections: Correction[];
  patterns: LearningPattern[];
  stats: LearningStats;
  exportDate: string;
} {
  return {
    corrections: getAllCorrections(),
    patterns: getAllPatterns(),
    stats: getLearningStats(),
    exportDate: new Date().toISOString()
  };
}

/**
 * Importa datos de aprendizaje desde JSON
 */
export function importLearningData(data: any): void {
  try {
    if (data.corrections && Array.isArray(data.corrections)) {
      localStorage.setItem(STORAGE_KEYS.CORRECTIONS, JSON.stringify(data.corrections));
    }
    if (data.patterns && Array.isArray(data.patterns)) {
      localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(data.patterns));
    }
    if (data.stats) {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(data.stats));
    }
    console.log('✅ Datos de aprendizaje importados correctamente');
  } catch (error) {
    console.error('❌ Error importando datos:', error);
    throw new Error('No se pudieron importar los datos');
  }
}
