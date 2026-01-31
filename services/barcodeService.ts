/**
 * SERVICIO DE LECTURA DE CÓDIGOS DE BARRAS Y QR
 * Usa Vertex AI para detectar y leer códigos en documentos
 */

// Tipos de códigos soportados
export enum BarcodeType {
  QR_CODE = 'QR_CODE',
  EAN_13 = 'EAN_13',
  EAN_8 = 'EAN_8',
  CODE_39 = 'CODE_39',
  CODE_128 = 'CODE_128',
  PDF417 = 'PDF417',
  DATA_MATRIX = 'DATA_MATRIX',
  UPC_A = 'UPC_A',
  UPC_E = 'UPC_E',
  UNKNOWN = 'UNKNOWN'
}

// Interfaz para un código detectado
export interface DetectedCode {
  type: BarcodeType;
  rawData: string;
  parsedData?: any;
  confidence: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Interfaz para el resultado completo
export interface BarcodeDetectionResult {
  codesDetected: number;
  codes: DetectedCode[];
  documentType?: string;
  structuredData?: any;
  validationStatus?: 'VALID' | 'INVALID' | 'UNVERIFIED';
  processingTime: number;
}

// Función auxiliar para llamar a la API de Vercel
const callVertexAIAPI = async (endpoint: string, body: any): Promise<any> => {
    const baseURL = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:5173';

    const url = `${baseURL}/api/${endpoint}`;
    console.log(`🇪🇺 Llamando a Vertex AI Europa: ${url}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API: ${response.status} - ${errorText}`);
    }

    return await response.json();
};

/**
 * Servicio principal de detección de códigos
 */
export class BarcodeService {
  constructor() {
    // No necesita API key - usa el backend con Service Account
  }

  /**
   * Detecta y lee códigos de barras/QR en una imagen o PDF
   */
  async detectAndReadCodes(base64Image: string, mimeType: string = 'image/jpeg'): Promise<BarcodeDetectionResult> {
    const startTime = Date.now();

    const prompt = `
TAREA CRÍTICA: Analiza esta imagen y detecta TODOS los códigos de barras y códigos QR presentes.

BUSCA EXHAUSTIVAMENTE:
- Códigos QR (cuadrados con puntos)
- Códigos de barras lineales (líneas verticales negras)
- Códigos Code 128, Code 39, EAN-13, UPC
- Códigos PDF417 (rectangulares con líneas)
- Data Matrix (cuadrados pequeños)
- Códigos en cualquier parte: arriba, centro, abajo, laterales
- Incluso si son pequeños o de baja calidad

Para cada código encontrado, proporciona:
1. Tipo de código (QR_CODE, CODE_128, EAN_13, PDF417, etc.)
2. Contenido exacto del código (texto/números que codifica)
3. Posición aproximada en la imagen (x, y, width, height en %)
4. Nivel de confianza (0-1)

DOCUMENTOS ESPECIALES:
- Formularios FUNDAE/SEPE: código de barras en parte inferior
- Facturas españolas con QR: extraer número, CIF, total, fecha
- DNI español con PDF417: nombre, apellidos, DNI, fecha nacimiento
- Multas con QR: expediente, matrícula, importe
- Recetas electrónicas: código receta, medicamento

Responde SOLO con JSON válido en este formato exacto:
{
  "codesDetected": número,
  "codes": [
    {
      "type": "QR_CODE" | "EAN_13" | "CODE_128" | "PDF417" | etc,
      "rawData": "contenido exacto del código",
      "parsedData": { objeto con datos estructurados si aplica },
      "confidence": 0.0 a 1.0,
      "position": { "x": 0, "y": 0, "width": 0, "height": 0 }
    }
  ],
  "documentType": "FACTURA" | "DNI" | "MULTA" | "RECETA_MEDICA" | etc,
  "structuredData": { datos extraídos y parseados }
}

Si NO hay códigos, devuelve:
{
  "codesDetected": 0,
  "codes": []
}
`;

    try {
      const result = await callVertexAIAPI('extract', {
        model: 'gemini-3-pro-preview',
        contents: {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            }
          ]
        }
      });

      // Limpiar respuesta (quitar markdown si existe)
      const jsonText = result.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsedResult = JSON.parse(jsonText);
      const processingTime = Date.now() - startTime;

      return {
        codesDetected: parsedResult.codesDetected || 0,
        codes: parsedResult.codes || [],
        documentType: parsedResult.documentType,
        structuredData: parsedResult.structuredData,
        validationStatus: this.validateCodeData(parsedResult),
        processingTime: processingTime
      };

    } catch (error) {
      console.error('Error en detección de códigos:', error);
      return {
        codesDetected: 0,
        codes: [],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Valida datos del código (checksums, formato)
   */
  private validateCodeData(data: any): 'VALID' | 'INVALID' | 'UNVERIFIED' {
    // Validación básica de DNI español
    if (data.documentType === 'DNI' && data.structuredData?.dni) {
      return this.validateDNI(data.structuredData.dni) ? 'VALID' : 'INVALID';
    }

    // Validación de CIF español
    if (data.structuredData?.cif) {
      return this.validateCIF(data.structuredData.cif) ? 'VALID' : 'INVALID';
    }

    // Validación de EAN-13 (checksum)
    const ean13Code = data.codes?.find((c: any) => c.type === 'EAN_13');
    if (ean13Code) {
      return this.validateEAN13(ean13Code.rawData) ? 'VALID' : 'INVALID';
    }

    return 'UNVERIFIED';
  }

  /**
   * Valida DNI español (letra de control)
   */
  private validateDNI(dni: string): boolean {
    const dniRegex = /^(\d{8})([A-Z])$/;
    const match = dni.match(dniRegex);

    if (!match) return false;

    const numero = parseInt(match[1]);
    const letra = match[2];
    const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';

    return letras[numero % 23] === letra;
  }

  /**
   * Valida CIF español
   */
  private validateCIF(cif: string): boolean {
    const cifRegex = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/;
    return cifRegex.test(cif);
  }

  /**
   * Valida EAN-13 (checksum)
   */
  private validateEAN13(ean: string): boolean {
    if (ean.length !== 13) return false;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(ean[i]);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }

    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(ean[12]);
  }
}

/**
 * Función helper para uso rápido
 */
export async function detectBarcodes(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<BarcodeDetectionResult> {
  const service = new BarcodeService();
  return await service.detectAndReadCodes(base64Image, mimeType);
}

export default BarcodeService;
