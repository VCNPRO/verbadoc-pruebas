/**
 * fundaeValidationRules.ts
 *
 * STUB - Funcionalidad FUNDAE eliminada
 * Este archivo se mantiene para compatibilidad con imports existentes
 */

export interface FundaeValidationResult {
  status: 'passed' | 'warning' | 'failed';
  errors: any[];
  warnings: any[];
}

/**
 * Stub de validación FUNDAE - siempre devuelve passed
 * La funcionalidad específica de FUNDAE ha sido eliminada
 */
export async function validateFundaeFormulario(
  _extractedData: any,
  _referenceData?: any,
  _cityCodesMap?: Map<string, string>
): Promise<FundaeValidationResult> {
  return {
    status: 'passed',
    errors: [],
    warnings: []
  };
}

export default {
  validateFundaeFormulario
};
