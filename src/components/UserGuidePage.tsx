/**
 * UserGuidePage.tsx
 *
 * User guide with Quick Guide and Complete Guide tabs.
 * Route: /guia
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface UserGuidePageProps {
  isDarkMode?: boolean;
}

export default function UserGuidePage({ isDarkMode = false }: UserGuidePageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'quick' | 'complete'>('quick');

  const bgPrimary = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4f8]';
  const bgCard = isDarkMode ? 'bg-[#1e293b]' : 'bg-white';
  const bgSecondary = isDarkMode ? 'bg-[#1e293b]' : 'bg-[#e8edf2]';
  const textPrimary = isDarkMode ? 'text-white' : 'text-[#1e293b]';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-[#475569]';
  const border = isDarkMode ? 'border-slate-700' : 'border-[#cbd5e1]';
  const hoverBg = isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]';

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-3 pb-2 border-b ${border}`}>{title}</h3>
      <div className={`${textSecondary} space-y-2 leading-relaxed`}>{children}</div>
    </div>
  );

  const Step = ({ number, title, description }: { number: number; title: string; description: string }) => (
    <div className="flex gap-4 mb-4">
      <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <div>
        <h4 className={`font-semibold ${textPrimary}`}>{title}</h4>
        <p className={`text-sm ${textSecondary}`}>{description}</p>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${bgPrimary}`}>
      {/* Header */}
      <div className={`${bgCard} border-b ${border}`}>
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>Guia de Usuario</h1>
              <p className={`${textSecondary} mt-1`}>Aprende a usar verbadoc pro europa</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className={`px-4 py-2 ${textSecondary} border ${border} rounded-lg ${hoverBg}`}
            >
              ← Volver
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('quick')}
              className={`px-6 py-2.5 rounded-t-lg font-medium transition-colors ${
                activeTab === 'quick'
                  ? 'bg-indigo-600 text-white'
                  : `${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'} ${hoverBg}`
              }`}
            >
              Guia Rapida
            </button>
            <button
              onClick={() => setActiveTab('complete')}
              className={`px-6 py-2.5 rounded-t-lg font-medium transition-colors ${
                activeTab === 'complete'
                  ? 'bg-indigo-600 text-white'
                  : `${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'} ${hoverBg}`
              }`}
            >
              Guia Completa
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className={`${bgCard} rounded-xl border ${border} p-8`}>
          {activeTab === 'quick' ? (
            <>
              <h2 className={`text-xl font-bold ${textPrimary} mb-6`}>Inicio Rapido en 5 Pasos</h2>

              <Step
                number={1}
                title="Sube tu documento"
                description="Arrastra o selecciona un archivo PDF, JPG o PNG desde tu ordenador. El sistema acepta documentos de hasta 10 MB."
              />
              <Step
                number={2}
                title="Clasifica el documento"
                description="Haz clic en 'Clasificar Documento' para que la IA identifique automaticamente el tipo de documento (factura, contrato, DNI, etc.) y configure la extraccion."
              />
              <Step
                number={3}
                title="Ejecuta la extraccion"
                description="Pulsa 'Ejecutar Extraccion' y espera unos segundos. La IA extraera todos los datos relevantes del documento."
              />
              <Step
                number={4}
                title="Valida los datos"
                description="Revisa los datos extraidos. Usa 'Validar Datos' para detectar errores automaticamente. Corrige manualmente si es necesario."
              />
              <Step
                number={5}
                title="Exporta los resultados"
                description="Descarga tus datos en formato Excel, CSV o JSON. Si usas el Excel Master, los datos se consolidan automaticamente."
              />

              <div className={`mt-8 ${bgSecondary} rounded-lg p-6`}>
                <h4 className={`font-semibold ${textPrimary} mb-2`}>Consejos rapidos</h4>
                <ul className={`list-disc list-inside space-y-1 text-sm ${textSecondary}`}>
                  <li>Usa siempre el Asistente IA para clasificar documentos</li>
                  <li>Prueba con un documento antes de procesar en lote</li>
                  <li>Las correcciones manuales mejoran las futuras extracciones</li>
                  <li>Guarda plantillas para reutilizar con documentos similares</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <h2 className={`text-xl font-bold ${textPrimary} mb-6`}>Guia Completa</h2>

              <Section title="1. Subida de Documentos">
                <p>verbadoc pro europa acepta los siguientes formatos: PDF, JPG, PNG. El tamano maximo es 10 MB por archivo.</p>
                <p>Para subir un documento, arrastralo al area de carga o haz clic para seleccionarlo. Puedes subir multiples archivos para procesamiento en lote.</p>
              </Section>

              <Section title="2. Clasificacion Automatica">
                <p>El Asistente de IA analiza visualmente el documento e identifica su tipo. Detecta mas de 15 tipos de documentos: facturas, contratos, DNI/NIE, pasaportes, nominas, certificados, recetas medicas, etc.</p>
                <p>Una vez clasificado, el sistema configura automaticamente el prompt y el schema de extraccion para obtener los mejores resultados.</p>
              </Section>

              <Section title="3. Modelos de IA">
                <p><strong>Generico:</strong> Rapido (3-5 seg). Para documentos simples y alto volumen.</p>
                <p><strong>Recomendado:</strong> Equilibrado (5-8 seg). Para facturas, contratos e informes. Seleccionado por defecto.</p>
                <p><strong>Avanzado:</strong> Maxima precision (10-15 seg). Para documentos complejos con tablas.</p>
                <p>Todos los modelos procesan datos exclusivamente en servidores europeos.</p>
              </Section>

              <Section title="4. Extraccion de Datos">
                <p>La extraccion convierte documentos no estructurados en datos JSON estructurados. Los campos se definen mediante un schema que puede ser automatico (por clasificacion) o personalizado (plantillas).</p>
                <p>Tipos de campos soportados: texto (string), numero (number), booleano (boolean), listas (array), objetos (object) y listas de objetos.</p>
              </Section>

              <Section title="5. Validacion y Revision">
                <p>El sistema de validacion detecta automaticamente errores en los datos extraidos: campos vacios, formatos incorrectos (fechas, CIF/NIF), valores fuera de rango, y incoherencias matematicas.</p>
                <p>Los documentos con errores aparecen en la pagina de Revision, donde puedes corregirlos manualmente con la ayuda del visor PDF integrado.</p>
              </Section>

              <Section title="6. Excel Master">
                <p>El Excel Master consolida todos los datos aprobados en un unico archivo Excel descargable. Cada formulario aprobado se anade automaticamente.</p>
                <p>Puedes editar campos directamente desde la vista del Excel Master, con el PDF original visible al lado.</p>
              </Section>

              <Section title="7. Procesamiento en Lote">
                <p>Para documentos repetitivos, sube todos los archivos y usa 'Procesar Todos'. El sistema procesa hasta 50 documentos de forma automatica.</p>
                <p>Se mantiene un control de concurrencia para evitar saturar el servicio.</p>
              </Section>

              <Section title="8. Plantillas Personalizadas">
                <p>Crea plantillas para tipos de documentos especificos. Define el prompt de extraccion y los campos del schema.</p>
                <p>Las plantillas se pueden compartir entre usuarios del mismo equipo.</p>
              </Section>

              <Section title="9. Busqueda Semantica (RAG)">
                <p>El modulo RAG permite buscar informacion dentro de tus documentos usando preguntas en lenguaje natural.</p>
                <p>Los resultados incluyen el fragmento relevante del documento junto con un enlace para ver o descargar el PDF original.</p>
              </Section>

              <Section title="10. Modulos y Permisos">
                <p>El sistema funciona con modulos independientes. El administrador puede asignar o revocar modulos a cada usuario.</p>
                <p>Modulos disponibles: Extraccion, RAG, Revision, Excel Master, Procesamiento en Lote, Plantillas.</p>
              </Section>

              <Section title="11. Seguridad">
                <p>Procesamiento 100% en servidores europeos. Cumplimiento RGPD/GDPR. Cifrado TLS 1.3 en todas las comunicaciones.</p>
                <p>Headers de seguridad: CSP, HSTS, X-Frame-Options, X-Content-Type-Options. Rate limiting en endpoints criticos.</p>
                <p>Los documentos no se almacenan de forma persistente: se procesan en memoria y se borran automaticamente tras la extraccion.</p>
              </Section>

              <Section title="12. Preguntas Frecuentes">
                <p><strong>¿Cuanto tarda una extraccion?</strong> Entre 3 y 15 segundos dependiendo del modelo y la complejidad del documento.</p>
                <p><strong>¿Puedo procesar documentos en otros idiomas?</strong> Si, la IA soporta multiples idiomas europeos.</p>
                <p><strong>¿Que pasa si la extraccion falla?</strong> El documento se marca como "No Procesable" con el motivo del fallo. Puedes reintentarlo o procesarlo manualmente.</p>
                <p><strong>¿Los datos se guardan en la nube?</strong> Los datos extraidos se almacenan en una base de datos segura en Europa. Los documentos originales se borran automaticamente tras la extraccion.</p>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
