'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type TargetType = 'all' | 'individual' | 'empresa' | 'institucional';

interface Plan {
  id: string;
  name: string;
  price: number | null;
  priceLabel: string;
  extractions: number | null;
  extractionsLabel: string;
  features: string[];
  target: TargetType;
  popular?: boolean;
  recommended?: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: 'Gratis',
    extractions: 10,
    extractionsLabel: '10 extracciones/mes',
    features: [
      'Hasta 10 documentos/mes',
      'Plantillas básicas',
      'Exportación Excel',
      'Soporte por email',
    ],
    target: 'individual',
    cta: 'Empezar Gratis',
  },
  {
    id: 'basico',
    name: 'Básico',
    price: 29,
    priceLabel: '29€/mes',
    extractions: 50,
    extractionsLabel: '50 extracciones/mes',
    features: [
      'Hasta 50 documentos/mes',
      'Todas las plantillas',
      'Plantillas personalizadas',
      'Exportación Excel + JSON',
      'Soporte prioritario',
    ],
    target: 'individual',
    cta: 'Elegir Básico',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    priceLabel: '79€/mes',
    extractions: 200,
    extractionsLabel: '200 extracciones/mes',
    features: [
      'Hasta 200 documentos/mes',
      'Todas las plantillas',
      'Plantillas ilimitadas',
      'API de integración',
      'Exportación múltiple',
      'Soporte 24h',
    ],
    target: 'empresa',
    popular: true,
    recommended: true,
    cta: 'Elegir Pro',
  },
  {
    id: 'business',
    name: 'Business',
    price: 199,
    priceLabel: '199€/mes',
    extractions: 500,
    extractionsLabel: '500 extracciones/mes',
    features: [
      'Hasta 500 documentos/mes',
      'Todo lo de Pro',
      'Usuarios ilimitados',
      'Dashboard analítico',
      'Integraciones avanzadas',
      'Account manager dedicado',
      'SLA 99.9%',
    ],
    target: 'empresa',
    cta: 'Elegir Business',
  },
  {
    id: 'universidad',
    name: 'Universidad',
    price: 499,
    priceLabel: '499€/mes',
    extractions: 2000,
    extractionsLabel: '2000 extracciones/mes',
    features: [
      'Hasta 2000 documentos/mes',
      'Todo lo de Business',
      'Licencias para estudiantes',
      'Panel de administración',
      'Formación incluida',
      'Integración LMS',
      'Facturación institucional',
    ],
    target: 'institucional',
    cta: 'Contactar',
  },
  {
    id: 'personalizado',
    name: 'Personalizado',
    price: null,
    priceLabel: 'A medida',
    extractions: null,
    extractionsLabel: 'Sin límites',
    features: [
      'Volumen ilimitado',
      'Desarrollo a medida',
      'Integración completa',
      'Servidores dedicados',
      'Soporte 24/7/365',
      'SLA personalizado',
      'Consultoría incluida',
    ],
    target: 'empresa',
    cta: 'Contactar',
  },
];

export function PricingPage() {
  const navigate = useNavigate();
  const [selectedTarget, setSelectedTarget] = useState<TargetType>('all');

  const filteredPlans = PLANS.filter(plan => {
    if (selectedTarget === 'all') return true;
    return plan.target === selectedTarget;
  });

  const handleSelectPlan = (planId: string) => {
    if (planId === 'free') {
      navigate('/');
      return;
    }
    if (planId === 'personalizado' || planId === 'universidad') {
      window.location.href = 'mailto:info@verbadocpro.eu?subject=Consulta Plan ' + planId.charAt(0).toUpperCase() + planId.slice(1);
      return;
    }
    // Para otros planes, redirigir a contacto o checkout (futuro)
    window.location.href = 'mailto:info@verbadocpro.eu?subject=Contratar Plan ' + planId.charAt(0).toUpperCase() + planId.slice(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">V</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  VerbadocPro
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Planes y Precios
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
        <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
          Extrae datos de documentos con IA
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-4">
          Automatiza la extracción de información de tus documentos PDF y Excel.
        </p>
        <p className="text-lg text-blue-600 dark:text-blue-400 font-medium mb-8">
          Sin compromisos. Cancela cuando quieras.
        </p>

        {/* Target Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <button
            onClick={() => setSelectedTarget('all')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              selectedTarget === 'all'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setSelectedTarget('individual')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              selectedTarget === 'individual'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Individual
          </button>
          <button
            onClick={() => setSelectedTarget('empresa')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              selectedTarget === 'empresa'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Empresa
          </button>
          <button
            onClick={() => setSelectedTarget('institucional')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              selectedTarget === 'institucional'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
            Institucional
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPlans.map((plan) => {
            const isPopular = plan.popular;
            const isRecommended = plan.recommended;
            const isEnterprise = plan.id === 'personalizado';

            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-gray-800 rounded-2xl border-2 transition-all hover:shadow-2xl ${
                  isPopular
                    ? 'border-blue-500 shadow-xl scale-105'
                    : isEnterprise
                    ? 'border-purple-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                {/* Badges */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                      POPULAR
                    </span>
                  </div>
                )}
                {isRecommended && !isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-green-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                      RECOMENDADO
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan Header */}
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline justify-center gap-1">
                      {plan.price !== null ? (
                        <>
                          <span className="text-4xl font-bold text-gray-900 dark:text-white">
                            {plan.price}€
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">/mes</span>
                        </>
                      ) : (
                        <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                          {plan.priceLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-2">
                      {plan.extractionsLabel}
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <svg
                          className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                      isPopular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                        : isEnterprise
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h3 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Preguntas Frecuentes
          </h3>
          <div className="space-y-8">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                ¿Puedo cambiar de plan en cualquier momento?
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Sí, puedes actualizar o reducir tu plan en cualquier momento. Los cambios se aplican en el siguiente ciclo de facturación.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                ¿Qué métodos de pago aceptan?
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Aceptamos tarjetas de crédito/débito (Visa, Mastercard, American Express) y transferencia bancaria para planes Business y superiores.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                ¿Las extracciones no usadas se acumulan?
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                No, las extracciones se reinician cada mes. Te recomendamos elegir el plan que mejor se adapte a tu volumen mensual.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                ¿Ofrecen descuentos por pago anual?
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Sí, ofrecemos un 20% de descuento en todos los planes con facturación anual. Contacta con nosotros para más información.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 dark:text-gray-400">
              ¿Tienes dudas? Escríbenos a{' '}
              <a
                href="mailto:info@verbadocpro.eu"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                info@verbadocpro.eu
              </a>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              © 2024 VerbadocPro. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
