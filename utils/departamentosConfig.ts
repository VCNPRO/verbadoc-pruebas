
import type { DepartamentoInfo, Departamento } from '../types';

export const DEPARTAMENTOS: DepartamentoInfo[] = [
    {
        id: 'general',
        name: 'General',
        description: 'Plantillas para uso general',
        icon: '🏢',
        recommendedModel: 'gemini-2.5-flash',
    },
    {
        id: 'contabilidad',
        name: 'Contabilidad',
        description: 'Plantillas para facturas, recibos y otros documentos contables',
        icon: '🧾',
        recommendedModel: 'gemini-2.5-flash',
    },
    {
        id: 'finanzas',
        name: 'Finanzas',
        description: 'Plantillas para informes financieros, análisis de mercado y otros documentos financieros',
        icon: '💰',
        recommendedModel: 'gemini-2.5-pro',
    },
    {
        id: 'marketing',
        name: 'Marketing',
        description: 'Plantillas para informes de campañas, análisis de redes sociales y otros documentos de marketing',
        icon: '📈',
        recommendedModel: 'gemini-2.5-flash',
    },
    {
        id: 'legal',
        name: 'Legal',
        description: 'Plantillas para contratos, acuerdos de confidencialidad y otros documentos legales',
        icon: '⚖️',
        recommendedModel: 'gemini-2.5-pro',
    },
    {
        id: 'rrhh',
        name: 'Recursos Humanos',
        description: 'Plantillas para currículums, cartas de oferta y otros documentos de recursos humanos',
        icon: '👥',
        recommendedModel: 'gemini-2.5-flash',
    },
];

export const getDepartamentoById = (id: Departamento): DepartamentoInfo | undefined => {
    return DEPARTAMENTOS.find(d => d.id === id);
}

export const getDefaultTheme = () => {
    return {
        primary: '#3b82f6',
        secondary: '#64748b',
        accent: '#10b981',
        background: '#f1f5f9',
        cardBg: '#ffffff',
        border: '#e5e7eb',
        text: '#1f2937',
        textSecondary: '#6b7280',
    };
}
