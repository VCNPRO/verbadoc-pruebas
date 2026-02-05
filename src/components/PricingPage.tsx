/**
 * PricingPage.tsx
 *
 * Page showing available modules and pricing packages.
 * Route: /pricing
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

interface PricingPageProps {
  isDarkMode?: boolean;
}

const MODULES = [
  { name: 'extraction', label: 'Extraccion de Datos', price: 29, description: 'Extrae datos estructurados de PDFs, imagenes y documentos escaneados con IA.' },
  { name: 'rag', label: 'Busqueda Semantica (RAG)', price: 19, description: 'Busca informacion en tus documentos usando lenguaje natural.' },
  { name: 'review', label: 'Revision y Validacion', price: 15, description: 'Sistema de revision con deteccion de errores y validacion cruzada.' },
  { name: 'excel_master', label: 'Excel Master', price: 15, description: 'Consolida datos extraidos en un Excel master exportable.' },
  { name: 'batch', label: 'Procesamiento en Lote', price: 25, description: 'Procesa hasta 50 documentos de forma automatica y simultanea.' },
  { name: 'templates', label: 'Plantillas Personalizadas', price: 10, description: 'Crea y gestiona plantillas de extraccion para tus tipos de documentos.' },
];

const PACKAGES = [
  {
    name: 'Basico',
    price: 44,
    modules: ['extraction', 'excel_master'],
    highlight: false,
    description: 'Ideal para empezar a digitalizar documentos.'
  },
  {
    name: 'Profesional',
    price: 88,
    modules: ['extraction', 'review', 'excel_master', 'batch'],
    highlight: true,
    description: 'Para equipos que necesitan validacion y procesamiento masivo.'
  },
  {
    name: 'Completo',
    price: 113,
    modules: ['extraction', 'rag', 'review', 'excel_master', 'batch', 'templates'],
    highlight: false,
    description: 'Todas las funcionalidades para empresas con alto volumen.'
  }
];

export function PricingPage({ isDarkMode = false }: PricingPageProps) {
  const navigate = useNavigate();

  const bgPrimary = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4f8]';
  const bgCard = isDarkMode ? 'bg-[#1e293b]' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-white' : 'text-[#1e293b]';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-[#475569]';
  const border = isDarkMode ? 'border-slate-700' : 'border-[#cbd5e1]';

  return (
    <div className={`min-h-screen ${bgPrimary} py-12 px-6`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <button
            onClick={() => navigate('/')}
            className={`mb-6 px-4 py-2 ${textSecondary} border ${border} rounded-lg ${isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]'}`}
          >
            ← Volver al inicio
          </button>
          <h1 className={`text-3xl font-bold ${textPrimary} mb-4`}>
            Modulos y Precios
          </h1>
          <p className={`text-lg ${textSecondary} max-w-2xl mx-auto`}>
            Elige los modulos individuales que necesitas o selecciona un paquete con descuento.
          </p>
        </div>

        {/* Packages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PACKAGES.map(pkg => {
            const totalIndividual = pkg.modules.reduce((sum, m) => {
              const mod = MODULES.find(mod => mod.name === m);
              return sum + (mod?.price || 0);
            }, 0);
            const savings = totalIndividual - pkg.price;

            return (
              <div
                key={pkg.name}
                className={`${bgCard} rounded-xl border-2 ${pkg.highlight ? 'border-indigo-500' : border} p-8 flex flex-col relative`}
              >
                {pkg.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    Recomendado
                  </div>
                )}
                <h3 className={`text-xl font-bold ${textPrimary} mb-2`}>{pkg.name}</h3>
                <p className={`${textSecondary} text-sm mb-4`}>{pkg.description}</p>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${textPrimary}`}>{pkg.price}€</span>
                  <span className={`${textSecondary} text-sm`}>/mes</span>
                  {savings > 0 && (
                    <p className="text-green-500 text-sm font-medium mt-1">
                      Ahorras {savings}€/mes vs individual
                    </p>
                  )}
                </div>
                <ul className="flex-1 space-y-2 mb-6">
                  {pkg.modules.map(modName => {
                    const mod = MODULES.find(m => m.name === modName);
                    return (
                      <li key={modName} className={`flex items-center gap-2 text-sm ${textPrimary}`}>
                        <span className="text-green-500">✓</span>
                        {mod?.label || modName}
                      </li>
                    );
                  })}
                </ul>
                <a
                  href={`mailto:info@verbadocpro.eu?subject=Solicitud paquete ${pkg.name}`}
                  className={`w-full py-3 text-center rounded-lg font-medium transition-colors ${
                    pkg.highlight
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : isDarkMode
                        ? 'bg-slate-600 hover:bg-slate-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  Contactar
                </a>
              </div>
            );
          })}
        </div>

        {/* Individual modules table */}
        <div className="mb-12">
          <h2 className={`text-2xl font-bold ${textPrimary} mb-6 text-center`}>
            Modulos Individuales
          </h2>
          <div className={`${bgCard} rounded-xl border ${border} overflow-hidden`}>
            <table className="w-full">
              <thead className={isDarkMode ? 'bg-[#334155]' : 'bg-[#e8edf2]'}>
                <tr>
                  <th className={`px-6 py-4 text-left text-sm font-medium ${textSecondary}`}>Modulo</th>
                  <th className={`px-6 py-4 text-left text-sm font-medium ${textSecondary}`}>Descripcion</th>
                  <th className={`px-6 py-4 text-right text-sm font-medium ${textSecondary}`}>Precio/mes</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${border}`}>
                {MODULES.map(mod => (
                  <tr key={mod.name} className={isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]'}>
                    <td className={`px-6 py-4 font-medium ${textPrimary}`}>{mod.label}</td>
                    <td className={`px-6 py-4 text-sm ${textSecondary}`}>{mod.description}</td>
                    <td className={`px-6 py-4 text-right font-bold ${textPrimary}`}>{mod.price}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contact */}
        <div className="text-center">
          <p className={`${textSecondary} mb-4`}>
            ¿Necesitas un plan personalizado? Contacta con nuestro equipo.
          </p>
          <a
            href="mailto:info@verbadocpro.eu?subject=Consulta plan personalizado"
            className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Contactar equipo comercial
          </a>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
