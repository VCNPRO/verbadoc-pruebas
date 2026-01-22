// AI Assistant Panel - Panel principal del Asistente IA
import React, { useState } from 'react';
import { classifyDocument, validateExtractedData } from '../services/aiAgentService.ts';
import { segmentPDFWithGemini, isPDFFile, getPDFInfo } from '../services/segmentationService.ts';
import type { SchemaField } from '../types.ts';
import { BrainIcon } from './Icons';

interface AIAssistantPanelProps {
  file: File | null;
  onSchemaGenerated: (schema: SchemaField[], prompt: string) => void;
  onValidationComplete: (validation: any) => void;
  onStartExtraction?: (schema: SchemaField[], prompt: string) => void; // 🔥 Callback con schema y prompt
  extractedData?: object;
  currentSchema?: SchemaField[];
}

export function AIAssistantPanel({
  file,
  onSchemaGenerated,
  onValidationComplete,
  onStartExtraction,
  extractedData,
  currentSchema
}: AIAssistantPanelProps) {

  const [isClassifying, setIsClassifying] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [classification, setClassification] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [segmentation, setSegmentation] = useState<any>(null);
  const [pdfInfo, setPdfInfo] = useState<any>(null);

  // Verificar info del PDF cuando se sube
  React.useEffect(() => {
    if (file && isPDFFile(file)) {
      getPDFInfo(file).then(info => {
        setPdfInfo(info);
      });
    } else {
      setPdfInfo(null);
    }
  }, [file]);

  // Auto-clasificar cuando se sube un archivo
  const handleAutoClassify = async () => {
    if (!file) return;

    setIsClassifying(true);
    try {
      const result = await classifyDocument(file);
      setClassification(result);

      // Aplicar schema sugerido automáticamente
      if (result.suggestedSchema && result.suggestedPrompt) {
        onSchemaGenerated(result.suggestedSchema, result.suggestedPrompt);

        // 🔥 NUEVO: Iniciar extracción automáticamente después de aplicar el schema
        if (onStartExtraction) {
          // Pasar schema directamente al callback para evitar race conditions
          setTimeout(() => {
            console.log('⏱️ Schema aplicado, iniciando extracción con', result.suggestedSchema.length, 'campos...');
            onStartExtraction(result.suggestedSchema, result.suggestedPrompt);
          }, 300);
        }
      }

      // Mostrar notificación
      showToast(
        `✅ Detectado: ${result.type} (${(result.confidence * 100).toFixed(0)}% confianza)`,
        'success'
      );

    } catch (error) {
      console.error('Error clasificando:', error);
      showToast('❌ Error al clasificar el documento', 'error');
    } finally {
      setIsClassifying(false);
    }
  };

  // Validar datos extraídos
  const handleValidate = async () => {
    if (!file || !extractedData || !currentSchema) return;

    setIsValidating(true);
    try {
      const result = await validateExtractedData(extractedData, currentSchema, file);
      setValidation(result);
      onValidationComplete(result);

      if (result.isValid) {
        showToast(`✅ Validación exitosa (Score: ${result.score}/100)`, 'success');
      } else {
        showToast(`⚠️ ${result.issues.length} problemas detectados`, 'warning');
      }

    } catch (error) {
      console.error('Error validando:', error);
      showToast('❌ Error al validar los datos', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // Segmentar PDF
  const handleSegment = async () => {
    if (!file || !isPDFFile(file)) return;

    setIsSegmenting(true);
    try {
      const result = await segmentPDFWithGemini(file);
      setSegmentation(result);

      showToast(
        `✅ ${result.segmentsFound} documentos detectados en el PDF`,
        'success'
      );

    } catch (error) {
      console.error('Error segmentando:', error);
      showToast('❌ Error al segmentar el PDF', 'error');
    } finally {
      setIsSegmenting(false);
    }
  };

  if (!file) {
    return (
      <div className="border rounded-lg p-6 text-center" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}>
        <div className="flex justify-center mb-4">
          <BrainIcon className="w-16 h-16" style={{ color: 'hsl(var(--primary))' }} />
        </div>
        <h3 className="text-lg font-semibold mb-2">Asistente IA</h3>
        <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Sube un documento para activar las funciones inteligentes
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}>
      {/* Header */}
      <div className="border-b p-4" style={{ backgroundColor: 'hsl(var(--primary) / 0.05)' }}>
        <div className="flex items-center gap-3">
          <BrainIcon className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
          <div>
            <h3 className="font-semibold text-lg">Asistente IA</h3>
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Análisis inteligente de documentos
            </p>
          </div>
        </div>
      </div>

      {/* PDF Info */}
      {pdfInfo && (
        <div className="p-4 border-b" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
          <div className="flex items-center gap-2 text-sm">
            <span>📄</span>
            <span className="font-medium">PDF detectado:</span>
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>
              {pdfInfo.numPages} páginas • {(pdfInfo.fileSize / 1024).toFixed(1)} KB
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 space-y-3">

        {/* Clasificación Automática */}
        <div className="border rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-semibold text-sm mb-1">🏷️ Clasificación Automática</h4>
              <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Detecta el tipo de documento y sugiere el esquema de extracción
              </p>
            </div>
          </div>

          {!classification ? (
            <button
              onClick={handleAutoClassify}
              disabled={isClassifying}
              className="btn-primary w-full text-sm"
            >
              {isClassifying ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Analizando...
                </span>
              ) : (
                '🔍 Clasificar Documento'
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="border rounded p-3" style={{
                backgroundColor: 'hsl(142 71% 45% / 0.1)',
                borderColor: 'hsl(142 71% 45% / 0.3)'
              }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm" style={{ color: 'hsl(var(--card-foreground))' }}>
                    {classification.type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                    {(classification.confidence * 100).toFixed(0)}% confianza
                  </span>
                </div>
                <p className="text-xs mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {classification.reasoning}
                </p>
                {classification.keyIndicators && classification.keyIndicators.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {classification.keyIndicators.map((indicator: string, idx: number) => (
                      <span key={idx} className="text-xs px-2 py-1 rounded" style={{
                        backgroundColor: 'hsl(var(--muted) / 0.4)',
                        color: 'hsl(var(--card-foreground))',
                        fontWeight: '500'
                      }}>
                        • {indicator}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setClassification(null)}
                className="btn-secondary w-full text-sm"
              >
                🔄 Reclasificar
              </button>
            </div>
          )}
        </div>

        {/* Segmentación de PDFs */}
        {pdfInfo && pdfInfo.numPages > 1 && (
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">📑 Segmentación de PDF</h4>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Detecta múltiples documentos dentro del PDF
                </p>
              </div>
            </div>

            {!segmentation ? (
              <button
                onClick={handleSegment}
                disabled={isSegmenting}
                className="btn-primary w-full text-sm"
              >
                {isSegmenting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Segmentando...
                  </span>
                ) : (
                  `🔍 Buscar Documentos (${pdfInfo.numPages} páginas)`
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="border rounded p-3" style={{
                  backgroundColor: 'hsl(199 89% 48% / 0.1)',
                  borderColor: 'hsl(199 89% 48% / 0.3)'
                }}>
                  <p className="font-semibold text-sm mb-2" style={{ color: 'hsl(var(--card-foreground))' }}>
                    {segmentation.segmentsFound} documento(s) detectado(s)
                  </p>
                  <div className="space-y-2">
                    {segmentation.segments.map((seg: any, idx: number) => (
                      <div key={seg.id} className="text-xs p-2 rounded" style={{ backgroundColor: 'hsl(var(--muted) / 0.3)' }}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Doc {idx + 1}: {seg.documentType || 'Desconocido'}
                          </span>
                          <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                            Pág. {seg.pageNumbers.join(', ')}
                          </span>
                        </div>
                        {seg.reasoning && (
                          <p className="mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{seg.reasoning}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setSegmentation(null)}
                  className="btn-secondary w-full text-sm"
                >
                  🔄 Re-segmentar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Validación de Datos */}
        {extractedData && currentSchema && (
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">✅ Validación Inteligente</h4>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Detecta errores e inconsistencias en los datos extraídos
                </p>
              </div>
            </div>

            {!validation ? (
              <button
                onClick={handleValidate}
                disabled={isValidating}
                className="btn-primary w-full text-sm"
              >
                {isValidating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Validando...
                  </span>
                ) : (
                  '🔍 Validar Datos'
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="border rounded p-3" style={{
                  backgroundColor: validation.isValid ? 'hsl(142 71% 45% / 0.1)' : 'hsl(43 96% 56% / 0.1)',
                  borderColor: validation.isValid ? 'hsl(142 71% 45% / 0.3)' : 'hsl(43 96% 56% / 0.3)'
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm" style={{ color: 'hsl(var(--card-foreground))' }}>
                      Score: {validation.score}/100
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      validation.isValid
                        ? 'bg-green-600 text-white'
                        : 'bg-yellow-600 text-white'
                    }`}>
                      {validation.isValid ? 'Válido' : `${validation.issues.length} issues`}
                    </span>
                  </div>

                  {validation.issues.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {validation.issues.slice(0, 3).map((issue: any, idx: number) => (
                        <div key={idx} className="text-xs p-2 rounded" style={{ backgroundColor: 'hsl(var(--muted) / 0.3)' }}>
                          <div className="flex items-start gap-2">
                            <span>
                              {issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium">{issue.field}</p>
                              <p style={{ color: 'hsl(var(--muted-foreground))' }}>{issue.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {validation.issues.length > 3 && (
                        <p className="text-xs text-center mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          + {validation.issues.length - 3} problemas más
                        </p>
                      )}
                    </div>
                  )}

                  {validation.suggestions && validation.suggestions.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs font-medium mb-1">💡 Sugerencias:</p>
                      {validation.suggestions.map((sug: string, idx: number) => (
                        <p key={idx} className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>• {sug}</p>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setValidation(null)}
                  className="btn-secondary w-full text-sm"
                >
                  🔄 Re-validar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer con información */}
      <div className="border-t p-3" style={{ backgroundColor: 'hsl(var(--muted) / 0.3)' }}>
        <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
          💡 El Asistente IA aprende de tus correcciones para mejorar con el tiempo
        </p>
      </div>
    </div>
  );
}

// Helper para mostrar notificaciones toast
function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
  // Implementación simple con alert (puedes usar una librería de toast como react-hot-toast)
  console.log(`[${type.toUpperCase()}] ${message}`);

  // Crear elemento toast temporal
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
    type === 'success' ? 'bg-green-600 text-white' :
    type === 'error' ? 'bg-red-600 text-white' :
    'bg-yellow-600 text-white'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
