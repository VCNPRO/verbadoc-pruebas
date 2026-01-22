/**
 * API: Subir Excel de Datos de Referencia
 *
 * POST /api/reference-data/upload
 *
 * Permite a usuarios admin subir el Excel maestro del cliente
 * para usarlo como referencia en validación cruzada
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import formidable from 'formidable';
import { readFileSync } from 'fs';
import { parseExcelFromBuffer, validateExcelStructure } from '../../src/services/excelParserService.js';

// Helper: Verificar autenticación
function verifyAuth(req: VercelRequest): { userId: string; email: string; role: string } | null {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['auth-token'];
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return {
      userId: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

export const config = {
  api: {
    bodyParser: false // Deshabilitado para usar formidable
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticación
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  // Solo admins pueden subir datos de referencia
  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Solo administradores pueden subir datos de referencia'
    });
  }

  try {
    // Parsear FormData usando formidable
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req as any, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploadedFile) {
      return res.status(400).json({
        error: 'No se recibió ningún archivo'
      });
    }

    const filename = Array.isArray(fields.filename) ? fields.filename[0] : fields.filename || uploadedFile.originalFilename || 'unknown.xlsx';
    const sheetName = Array.isArray(fields.sheetName) ? fields.sheetName[0] : fields.sheetName;
    const startRow = Array.isArray(fields.startRow) ? fields.startRow[0] : fields.startRow;

    // Leer archivo desde el path temporal
    const buffer = readFileSync(uploadedFile.filepath);
    console.log('📁 Archivo leído:', filename, 'Tamaño:', buffer.length, 'bytes');

    // Validar estructura del Excel
    console.log('🔍 Validando estructura del Excel...');
    const structureValidation = validateExcelStructure(buffer);
    console.log('✅ Validación resultado:', structureValidation);

    if (!structureValidation.valid) {
      console.error('❌ Validación falló:', structureValidation.error);
      return res.status(400).json({
        error: 'Excel inválido',
        message: structureValidation.error,
        columnsFound: structureValidation.columnsFound
      });
    }

    // Parsear Excel
    console.log('📊 Parseando Excel...');
    const parseResult = parseExcelFromBuffer(buffer, filename, {
      sheetName,
      startRow: startRow ? parseInt(startRow) : 0
    });
    console.log('📊 Parse resultado:', parseResult.success ? `✅ ${parseResult.data?.length} filas` : `❌ ${parseResult.error}`);

    if (!parseResult.success) {
      console.error('❌ Parse falló:', parseResult.error);
      return res.status(400).json({
        error: 'Error al parsear Excel',
        message: parseResult.error,
        details: parseResult.error
      });
    }

    const { data, metadata } = parseResult;

    if (!data || data.length === 0) {
      return res.status(400).json({
        error: 'Excel sin datos válidos',
        message: 'No se encontraron filas con datos procesables'
      });
    }

    // Insertar datos en BD
    const inserted: string[] = [];
    const errors: any[] = [];

    for (const row of data) {
      try {
        const result = await sql`
          INSERT INTO reference_data (
            uploaded_by,
            form_identifier,
            data,
            source_file,
            metadata
          ) VALUES (
            ${user.userId},
            ${row.formIdentifier},
            ${JSON.stringify(row.fields)}::jsonb,
            ${filename},
            ${JSON.stringify({ sheetName: metadata?.sheetName || 'Sheet1', rowNumber: row.rowNumber })}::jsonb
          )
          RETURNING id
        `;

        inserted.push(result.rows[0].id);

      } catch (error: any) {
        // Si ya existe (unique constraint), ignorar
        if (error.message.includes('unique')) {
          console.log(`Registro duplicado: ${row.formIdentifier}, actualizando...`);

          try {
            await sql`
              UPDATE reference_data
              SET
                data = ${JSON.stringify(row.fields)}::jsonb,
                source_file = ${filename},
                metadata = ${JSON.stringify({ sheetName: metadata?.sheetName || 'Sheet1', rowNumber: row.rowNumber })}::jsonb,
                updated_at = CURRENT_TIMESTAMP
              WHERE form_identifier = ${row.formIdentifier}
              AND is_active = TRUE
            `;
          } catch (updateError) {
            console.error('Error al actualizar:', updateError);
          }

        } else {
          errors.push({
            formIdentifier: row.formIdentifier,
            rowNumber: row.rowNumber,
            error: error.message
          });
        }
      }
    }

    console.log(`✅ Excel procesado: ${inserted.length} registros insertados/actualizados`);

    return res.status(200).json({
      success: true,
      message: `Excel procesado correctamente`,
      stats: {
        totalRows: data.length,
        inserted: inserted.length,
        errors: errors.length
      },
      metadata,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ Error al procesar Excel:', error);

    return res.status(500).json({
      error: 'Error al procesar Excel',
      message: error.message
    });
  }
}
