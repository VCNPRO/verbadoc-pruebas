/**
 * SERVICIO DE NOTIFICACIONES POR EMAIL
 * Usa Resend para enviar emails automáticos
 */

import { Resend } from 'resend';
import { EmailNotificationDB } from '../lib/extractionDB.js';
import type { ValidationErrorInput } from './validationService.js';
import { trackEmailSend } from '../lib/usageTracker.js';

// Inicializar Resend de forma segura (Lazy initialization)
let resend: Resend | null = null;

function getResendClient() {
  if (resend) return resend;
  
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.warn('⚠️ RESEND_API_KEY no configurada. Las notificaciones por email están desactivadas.');
    return null;
  }
  
  try {
    resend = new Resend(apiKey);
    return resend;
  } catch (e) {
    console.error('❌ Error al inicializar cliente Resend:', e);
    return null;
  }
}

// Configuración de emails
const FROM_EMAIL = process.env.NOTIFICATION_EMAIL || 'VerbadocPro <onboarding@resend.dev>';
const TO_EMAIL = process.env.CLIENT_REVIEW_EMAIL || 'admin@verbadocpro.eu';

export class EmailService {
  /**
   * Enviar email cuando un formulario necesita revisión
   */
  static async notifyNeedsReview(
    extraction: any,
    errors: ValidationErrorInput[]
  ): Promise<void> {
    const client = getResendClient();
    if (!client) return; // No bloquear si no hay cliente

    const reviewUrl = `https://www.verbadocpro.eu/review/${extraction.id}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Formulario requiere revisión</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">📋 Formulario FUNDAE</h1>
    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Requiere revisión manual</p>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">Detalles del Formulario</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; width: 40%;">Archivo:</td>
          <td style="padding: 8px 0;">${extraction.filename}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Fecha procesado:</td>
          <td style="padding: 8px 0;">${new Date(extraction.created_at).toLocaleString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Modelo IA:</td>
          <td style="padding: 8px 0;">${extraction.model_used}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Errores detectados:</td>
          <td style="padding: 8px 0; color: #dc3545; font-weight: bold;">${errors.length}</td>
        </tr>
      </table>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin-top: 0; color: #dc3545; font-size: 18px;">⚠️ Errores Encontrados:</h3>
      <ol style="padding-left: 20px; margin: 0;">
        ${errors.map(error => `
          <li style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
            <strong style="color: #495057;">${error.fieldName}</strong>
            <div style="color: #6c757d; font-size: 14px; margin-top: 5px;">
              ${error.errorMessage}
            </div>
            ${error.extractedValue ? `
              <div style="background: #fff3cd; border-left: 3px solid #ffc107; padding: 8px; margin-top: 8px; font-size: 13px;">
                <strong>Valor detectado:</strong> "${error.extractedValue}"
              </div>
            ` : ''}
            ${error.expectedFormat ? `
              <div style="background: #d1ecf1; border-left: 3px solid #17a2b8; padding: 8px; margin-top: 8px; font-size: 13px;">
                <strong>Formato esperado:</strong> ${error.expectedFormat}
              </div>
            ` : ''}
          </li>
        `).join('')}
      </ol>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${reviewUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        🔍 Revisar y Corregir Ahora
      </a>
    </div>

    <div style="background: #e7f3ff; border-left: 4px solid #0066cc; padding: 15px; border-radius: 4px; margin-top: 20px;">
      <p style="margin: 0; font-size: 14px; color: #004085;">
        <strong>💡 Próximos pasos:</strong><br>
        1. Haz clic en el botón de arriba para abrir el panel de revisión<br>
        2. Verás el PDF original a la izquierda<br>
        3. Corrige los errores en el panel derecho<br>
        4. Los cambios se guardarán automáticamente en la base de datos
      </p>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
    <p style="margin: 5px 0;">VerbadocPro - Sistema Profesional de Procesamiento FUNDAE</p>
    <p style="margin: 5px 0;">🤖 Procesado con IA Gemini 2.5 Flash | 🇪🇺 Datos en Europa (GDPR)</p>
    <p style="margin: 15px 0 5px 0;">
      <a href="https://www.verbadocpro.eu" style="color: #667eea; text-decoration: none;">www.verbadocpro.eu</a>
    </p>
  </div>
</body>
</html>
    `;

    try {
      // Crear log en BD antes de enviar
      const notification = await EmailNotificationDB.create({
        extractionId: extraction.id,
        recipientEmail: TO_EMAIL,
        subject: `📋 Formulario requiere revisión: ${extraction.filename}`,
        notificationType: 'needs_review',
        emailBody: emailHtml,
        provider: 'resend'
      });

      // Enviar email con Resend
      const result = await client.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject: `📋 Formulario requiere revisión: ${extraction.filename}`,
        html: emailHtml
      });

      // Marcar como enviado en BD
      await EmailNotificationDB.markAsSent(notification.id, result.data?.id);

      // Track email usage (non-blocking)
      trackEmailSend({
        resourceId: extraction.id,
        resourceName: extraction.filename,
        emailType: 'needs_review',
      });

      console.log('✅ Email enviado:', result.data?.id);
    } catch (error: any) {
      console.error('❌ Error al enviar email:', error);

      // Guardar error en BD si existe el log
      try {
        const notification = await EmailNotificationDB.create({
          extractionId: extraction.id,
          recipientEmail: TO_EMAIL,
          subject: `📋 Formulario requiere revisión: ${extraction.filename}`,
          notificationType: 'needs_review'
        });

        await EmailNotificationDB.markAsFailed(notification.id, error.message);
      } catch (dbError) {
        console.error('❌ Error al guardar log de email:', dbError);
      }

      // NO lanzamos el error para no bloquear la extracción principal
    }
  }

  /**
   * Enviar resumen diario de formularios pendientes
   */
  static async sendDailySummary(pendingCount: number, needsReviewCount: number): Promise<void> {
    const client = getResendClient();
    if (!client) return;

    if (pendingCount === 0 && needsReviewCount === 0) {
      console.log('📊 No hay formularios pendientes para el resumen diario');
      return;
    }

    const dashboardUrl = 'https://www.verbadocpro.eu/review';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen diario - VerbadocPro</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">📊 Resumen Diario</h1>
    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}</p>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">Estado de Formularios</h2>

      <div style="display: flex; gap: 15px; margin-top: 20px;">
        <div style="flex: 1; background: #fff3cd; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #ffc107;">
          <div style="font-size: 36px; font-weight: bold; color: #856404;">${pendingCount}</div>
          <div style="color: #856404; font-size: 14px; margin-top: 5px;">Pendientes de procesar</div>
        </div>

        <div style="flex: 1; background: #f8d7da; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #dc3545;">
          <div style="font-size: 36px; font-weight: bold; color: #721c24;">${needsReviewCount}</div>
          <div style="color: #721c24; font-size: 14px; margin-top: 5px;">Requieren revisión</div>
        </div>
      </div>
    </div>

    ${needsReviewCount > 0 ? `
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 14px; color: #856404;">
        <strong>⚠️ Acción requerida:</strong> Hay ${needsReviewCount} formulario${needsReviewCount > 1 ? 's' : ''} con errores que necesita${needsReviewCount > 1 ? 'n' : ''} revisión manual.
      </p>
    </div>
    ` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        🔍 Ver Panel de Revisión
      </a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
    <p style="margin: 5px 0;">VerbadocPro - Sistema Profesional de Procesamiento FUNDAE</p>
    <p style="margin: 5px 0;">Este es un email automático enviado diariamente</p>
  </div>
</body>
</html>
    `;

    try {
      const result = await client.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject: `📊 Resumen diario: ${needsReviewCount} formulario${needsReviewCount !== 1 ? 's' : ''} pendiente${needsReviewCount !== 1 ? 's' : ''}`,
        html: emailHtml
      });

      // Guardar log en BD
      await EmailNotificationDB.create({
        recipientEmail: TO_EMAIL,
        subject: 'Resumen diario',
        notificationType: 'daily_summary',
        provider: 'resend'
      });

      // Track email usage (non-blocking)
      trackEmailSend({ emailType: 'daily_summary' });

      console.log('✅ Resumen diario enviado:', result.data?.id);
    } catch (error: any) {
      console.error('❌ Error al enviar resumen diario:', error);
    }
  }

  /**
   * Notificar cuando un batch se completa
   */
  static async notifyBatchCompleted(
    totalProcessed: number,
    validCount: number,
    needsReviewCount: number,
    rejectedCount: number
  ): Promise<void> {
    const client = getResendClient();
    if (!client) return;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch completado</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">✅ Batch Completado</h1>
    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Procesamiento finalizado</p>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #10b981; font-size: 20px;">Resumen del Procesamiento</h2>

      <div style="text-align: center; margin: 30px 0;">
        <div style="font-size: 48px; font-weight: bold; color: #10b981;">${totalProcessed}</div>
        <div style="color: #6c757d; font-size: 16px;">Formularios procesados</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <tr style="border-bottom: 2px solid #e9ecef;">
          <td style="padding: 12px; font-weight: bold;">✅ Válidos</td>
          <td style="padding: 12px; text-align: right; color: #10b981; font-weight: bold;">${validCount} (${((validCount/totalProcessed)*100).toFixed(1)}%)</td>
        </tr>
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 12px; font-weight: bold;">⚠️ Requieren revisión</td>
          <td style="padding: 12px; text-align: right; color: #ffc107; font-weight: bold;">${needsReviewCount} (${((needsReviewCount/totalProcessed)*100).toFixed(1)}%)</td>
        </tr>
        <tr>
          <td style="padding: 12px; font-weight: bold;">❌ Rechazados</td>
          <td style="padding: 12px; text-align: right; color: #dc3545; font-weight: bold;">${rejectedCount} (${((rejectedCount/totalProcessed)*100).toFixed(1)}%)</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://www.verbadocpro.eu/results" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
        📥 Descargar Resultados
      </a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
    <p style="margin: 5px 0;">VerbadocPro - Sistema Profesional de Procesamiento FUNDAE</p>
  </div>
</body>
</html>
    `;

    try {
      const result = await client.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject: `✅ Batch completado: ${totalProcessed} formularios procesados`,
        html: emailHtml
      });

      // Track email usage (non-blocking)
      trackEmailSend({ emailType: 'batch_completed' });

      console.log('✅ Email de batch completado enviado:', result.data?.id);
    } catch (error: any) {
      console.error('❌ Error al enviar email de batch completado:', error);
    }
  }
}

export default EmailService;
