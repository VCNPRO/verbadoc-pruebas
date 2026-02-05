
import React, { useState, useEffect } from 'react';
import { FileTextIcon, ReceiptIcon, FileIcon, SparklesIcon } from './Icons.tsx';
import type { SchemaField, Departamento, TemplateType } from '../types.ts';
import { DEPARTAMENTOS, getDepartamentoById } from '../utils/departamentosConfig.ts';
import { SchemaBuilder } from './SchemaBuilder.tsx';
import { generateSchemaFromPrompt } from '../services/geminiService.ts';

export interface Template {
    id: string;
    name: string;
    description: string;
    type: TemplateType;
    icon: 'receipt' | 'file' | 'document';
    schema: SchemaField[];
    prompt: string;
    archived?: boolean;
    paused?: boolean;
    custom?: boolean;
    departamento?: Departamento;
    category?: string;
    clienteEmpresa?: string; // Empresa que puede ver esta plantilla
}

interface TemplatesPanelProps {
    onSelectTemplate: (template: any) => void;
    onSaveTemplate?: (name: string, description: string) => void;
    currentSchema?: SchemaField[];
    currentPrompt?: string;
    onDepartamentoChange?: (departamento: Departamento) => void;
    currentDepartamento?: Departamento;
    theme?: any;
    isLightMode?: boolean;
    user?: any; // Usuario autenticado para control de acceso
}

const defaultTemplates: Template[] = [
    {
        id: 'template_001',
        name: 'Factura Estándar',
        description: 'Extrae los campos comunes de una factura.',
        type: 'factura',
        icon: 'receipt',
        departamento: 'contabilidad',
        schema: [
            { id: 'f1', name: 'numero_factura', type: 'STRING' },
            { id: 'f2', name: 'fecha_emision', type: 'STRING' },
            { id: 'f3', name: 'total', type: 'NUMBER' },
            { id: 'f4', name: 'impuestos', type: 'NUMBER' },
        ],
        prompt: 'Extrae el número de factura, la fecha de emisión, el total y los impuestos de la factura.',
    },
    {
        id: 'template_002',
        name: 'Informe de Gastos',
        description: 'Extrae los gastos de un informe.',
        type: 'informe',
        icon: 'file',
        departamento: 'finanzas',
        schema: [
            { id: 'i1', name: 'concepto', type: 'STRING' },
            { id: 'i2', name: 'cantidad', type: 'NUMBER' },
            { id: 'i3', name: 'fecha', type: 'STRING' },
        ],
        prompt: 'Extrae el concepto, la cantidad y la fecha de cada gasto en el informe.',
    },
    {
        id: 'template_003',
        name: 'Contrato de Servicio',
        description: 'Extrae las cláusulas principales de un contrato.',
        type: 'contrato',
        icon: 'document',
        departamento: 'legal',
        schema: [
            { id: 'c1', name: 'nombre_cliente', type: 'STRING' },
            { id: 'c2', name: 'fecha_inicio', type: 'STRING' },
            { id: 'c3', name: 'duracion_meses', type: 'NUMBER' },
        ],
        prompt: 'Extrae el nombre del cliente, la fecha de inicio y la duración en meses del contrato.',
    },
    {
        id: 'template_004',
        name: 'Presupuesto de Marketing',
        description: 'Extrae datos de presupuestos de campañas.',
        type: 'informe',
        icon: 'file',
        departamento: 'marketing',
        schema: [
            { id: 'm1', name: 'nombre_campana', type: 'STRING' },
            { id: 'm2', name: 'presupuesto_total', type: 'NUMBER' },
            { id: 'm3', name: 'fecha_inicio', type: 'STRING' },
            { id: 'm4', name: 'fecha_fin', type: 'STRING' },
        ],
        prompt: 'Extrae el nombre de la campaña, presupuesto total y fechas de inicio y fin.',
    },
];

export function TemplatesPanel({ onSelectTemplate, onSaveTemplate, currentSchema, currentPrompt, onDepartamentoChange, currentDepartamento, theme, isLightMode, user }: TemplatesPanelProps) {
    const [customTemplates, setCustomTemplates] = useState<any[]>([]);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDescription, setNewTemplateDescription] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showArchivedCustom, setShowArchivedCustom] = useState(false);
    const [selectedDepartamento, setSelectedDepartamento] = useState<Departamento>(currentDepartamento || 'general');

    // Estados para controlar secciones colapsables
    const [showMyModelsSection, setShowMyModelsSection] = useState(false);
    const [showTemplatesSection, setShowTemplatesSection] = useState(true);
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const [newSchema, setNewSchema] = useState<SchemaField[]>([{ id: `field-${Date.now()}`, name: '', type: 'STRING' }]);
    const [newPrompt, setNewPrompt] = useState('Extrae la información clave del siguiente documento según el esquema JSON proporcionado.');
    const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

    // Función recursiva para comprobar si hay errores en el esquema
    const schemaHasErrors = (schema: SchemaField[]): boolean => {
        for (const field of schema) {
            if (field.error) return true;
            if (field.children && schemaHasErrors(field.children)) return true;
        }
        return false;
    };

    const isSaveDisabled = !newTemplateName.trim() || newSchema.length === 0 || schemaHasErrors(newSchema);

    let disabledReason = '';
    if (!newTemplateName.trim()) {
        disabledReason = 'El nombre de la plantilla no puede estar vacío.';
    } else if (newSchema.length === 0) {
        disabledReason = 'La plantilla debe tener al menos un campo.';
    } else if (schemaHasErrors(newSchema)) {
        disabledReason = 'Hay errores en los nombres de los campos. Corrígelos para poder guardar.';
    }

    useEffect(() => {
        setSelectedDepartamento(currentDepartamento || 'general');
    }, [currentDepartamento]);

    // Load custom templates from API (filtradas por client_id del usuario)
    useEffect(() => {
        const loadTemplatesFromAPI = async () => {
            try {
                setIsLoadingTemplates(true);
                const response = await fetch('/api/templates', { credentials: 'include' });
                if (response.ok) {
                    const templates = await response.json();
                    // Mapear campos de BD a formato del componente
                    const mappedTemplates = templates.map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        description: t.description || '',
                        type: 'modelo',
                        icon: 'file',
                        schema: t.regions || [],
                        prompt: t.prompt || '',
                        custom: true,
                        archived: !t.is_active,
                    }));
                    setCustomTemplates(mappedTemplates);
                    console.log('✅ Plantillas cargadas de API:', mappedTemplates.length);
                }
            } catch (e) {
                console.error('Error loading templates from API:', e);
            } finally {
                setIsLoadingTemplates(false);
            }
        };
        loadTemplatesFromAPI();
    }, []);

    // Función legacy (ahora usamos API)
    const saveToLocalStorage = (templates: Template[]) => {
        // Ya no usamos localStorage, las plantillas se guardan en BD via API
        console.log('📦 Plantillas actualizadas localmente:', templates.length);
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) {
            alert('Por favor, ingresa un nombre para la plantilla');
            return;
        }

        // Usar newSchema/newPrompt si estamos creando, sino usar current
        const schemaToSave = isCreatingTemplate ? newSchema : (currentSchema || []);
        const promptToSave = isCreatingTemplate ? newPrompt : (currentPrompt || '');

        if (schemaToSave.length === 0) {
            alert('El esquema debe tener al menos un campo');
            return;
        }

        // Validar que los campos del schema tengan nombre
        const invalidFields = schemaToSave.filter(f => !f.name || f.name.trim() === '');
        if (invalidFields.length > 0) {
            alert('Todos los campos del esquema deben tener un nombre válido');
            return;
        }

        console.log('💾 Guardando nueva plantilla en BD...');

        try {
            // Guardar en BD via API
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: newTemplateName.trim(),
                    description: newTemplateDescription.trim() || 'Plantilla personalizada',
                    regions: JSON.parse(JSON.stringify(schemaToSave)),
                    prompt: promptToSave,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error al guardar');
            }

            const savedTemplate = await response.json();
            
            // Añadir a la lista local
            const newTemplate: any = {
                id: savedTemplate.id,
                name: savedTemplate.name,
                description: savedTemplate.description || '',
                type: 'modelo',
                icon: 'file',
                schema: savedTemplate.regions || schemaToSave,
                prompt: promptToSave,
                custom: true,
                archived: false
            };

            setCustomTemplates(prev => [...prev, newTemplate]);
            console.log('✅ Plantilla guardada en BD:', newTemplate.name);

            setNewTemplateName('');
            setNewTemplateDescription('');
            setShowSaveDialog(false);
            setIsCreatingTemplate(false);
            setNewSchema([{ id: `field-${Date.now()}`, name: '', type: 'STRING' }]);
            setNewPrompt('Extrae la información clave del siguiente documento según el esquema JSON proporcionado.');

            alert(`✅ Plantilla "${newTemplate.name}" guardada correctamente`);
        } catch (error: any) {
            console.error('❌ Error al guardar plantilla:', error);
            alert(`Error al guardar: ${error.message}`);
        }
    };

    const handleGenerateSchemaFromPrompt = async () => {
        if (!newPrompt.trim()) {
            alert('Por favor, escribe primero un prompt describiendo qué datos quieres extraer.');
            return;
        }

        setIsGeneratingSchema(true);
        try {
            const generatedFields = await generateSchemaFromPrompt(newPrompt);
            setNewSchema(generatedFields);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            alert(`Error al generar campos: ${errorMessage}`);
        } finally {
            setIsGeneratingSchema(false);
        }
    };

    const handleArchiveTemplate = async (templateId: string) => {
        const template = customTemplates.find(t => t.id === templateId);
        if (!template) return;
        
        try {
            const response = await fetch(`/api/templates?id=${templateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ is_active: template.archived }), // toggle
            });
            
            if (!response.ok) throw new Error('Error al actualizar');
            
            const updatedTemplates = customTemplates.map(t =>
                t.id === templateId ? { ...t, archived: !t.archived } : t
            );
            setCustomTemplates(updatedTemplates);
            console.log(`📋 Plantilla ${template.archived ? 'activada' : 'archivada'}`);
        } catch (error) {
            console.error('Error al archivar:', error);
            alert('Error al archivar la plantilla');
        }
    };

    const handlePauseTemplate = (templateId: string) => {
        const updatedTemplates = customTemplates.map(t =>
            t.id === templateId ? { ...t, paused: !t.paused } : t
        );
        setCustomTemplates(updatedTemplates);
        saveToLocalStorage(updatedTemplates);
    };

    const handleDeleteTemplate = async (templateId: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) return;
        
        try {
            const response = await fetch(`/api/templates?id=${templateId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            
            if (!response.ok && response.status !== 204) {
                throw new Error('Error al eliminar');
            }
            
            const updatedTemplates = customTemplates.filter(t => t.id !== templateId);
            setCustomTemplates(updatedTemplates);
            console.log('🗑️ Plantilla eliminada');
        } catch (error) {
            console.error('Error al eliminar:', error);
            alert('Error al eliminar la plantilla');
        }
    };

    const handleDepartamentoChange = (departamento: Departamento) => {
        setSelectedDepartamento(departamento);
        if (onDepartamentoChange) {
            onDepartamentoChange(departamento);
        }
    };

    // Helper para verificar visibilidad por empresa y rol
    const canViewTemplate = (t: Template) => {
        if (t.archived) return false;
        
        // Admin siempre ve todo
        if (user?.role === 'admin') return true;
        
        // Plantillas con clienteEmpresa solo visibles para usuarios de esa empresa
        if (t.clienteEmpresa) {
            const userCompany = user?.company_name?.toLowerCase()?.trim();
            const templateCompany = t.clienteEmpresa.toLowerCase().trim();
            return userCompany === templateCompany;
        }
        
        // Plantillas de modelos_propios sin clienteEmpresa (legacy)
        if (t.category === 'modelos_propios' && !t.clienteEmpresa) {
            return false; // Ocultar plantillas legacy sin empresa asignada
        }
        
        return true;
    };

    // Filtrar plantillas por departamento seleccionado y permisos
    // Excluir plantillas con clienteEmpresa (se muestran en Mis Modelos)
    const filteredTemplates = selectedDepartamento === 'general'
        ? defaultTemplates.filter(t => canViewTemplate(t) && !t.clienteEmpresa)
        : defaultTemplates.filter(t => t.departamento === selectedDepartamento && canViewTemplate(t) && !t.clienteEmpresa);

    const filteredArchivedTemplates = selectedDepartamento === 'general'
        ? defaultTemplates.filter(t => t.archived)
        : defaultTemplates.filter(t => t.departamento === selectedDepartamento && t.archived);

    const activeCustomTemplates = customTemplates.filter(t => !t.archived);
    const archivedCustomTemplates = customTemplates.filter(t => t.archived);
    
    // Plantillas predefinidas del cliente (ej: FUNDAE para Normadat)
    const clientPredefinedTemplates = defaultTemplates.filter(t => 
        t.clienteEmpresa && canViewTemplate(t)
    );
    const currentDepartamentoInfo = getDepartamentoById(selectedDepartamento);

    const renderIcon = (iconType: Template['icon']) => {
        switch (iconType) {
            case 'receipt':
                return <ReceiptIcon className="w-5 h-5" />;
            case 'document':
                return <FileTextIcon className="w-5 h-5" />;
            default:
                return <FileIcon className="w-5 h-5" />;
        }
    };

    const TemplateCard = ({ template, showActions = false }: { template: any, showActions?: boolean }) => {
        const isPaused = template.paused;

        return (
            <div className="relative group/card">
                <button
                    onClick={() => {
                        console.log('👆 Click en plantilla:', template.name, '- Schema fields:', template.schema?.length || 0);
                        onSelectTemplate(template);
                    }}
                    className="w-full text-left p-3 border rounded-lg transition-all group hover:shadow-md"
                    style={{
                        backgroundColor: isPaused
                            ? (isLightMode ? '#f3f4f6' : 'rgba(15, 23, 42, 0.5)')
                            : (isLightMode ? '#ffffff' : 'rgba(30, 41, 59, 0.5)'),
                        borderColor: isPaused
                            ? (isLightMode ? '#fbbf24' : '#f59e0b')
                            : (isLightMode ? '#d1d5db' : '#475569'),
                        opacity: isPaused ? 0.7 : 1
                    }}
                >
                    <div className="flex items-start gap-3">
                        <div
                            className="mt-0.5 transition-colors"
                            style={{ color: isLightMode ? accentColor : '#60a5fa' }}
                        >
                            {renderIcon(template.icon)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4
                                className="text-sm font-semibold transition-colors"
                                style={{ color: textColor }}
                            >
                                {template.name}
                                {template.paused && <span className="text-xs ml-1" style={{ color: '#f59e0b' }}>⏸️ Pausada</span>}
                                {template.archived && <span className="text-xs opacity-50"> (Archivada)</span>}
                            </h4>
                            <p
                                className="text-xs mt-0.5 line-clamp-2 transition-colors"
                                style={{ color: textSecondary }}
                            >
                                {template.description}
                            </p>
                        </div>
                    </div>
                </button>
                {showActions && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity flex gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePauseTemplate(template.id);
                            }}
                            className="p-1 rounded text-white transition-colors"
                            style={{
                                backgroundColor: template.paused ? '#10b981' : '#f59e0b'
                            }}
                            title={template.paused ? "Reanudar plantilla" : "Pausar plantilla"}
                        >
                            {template.paused ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveTemplate(template.id);
                            }}
                            className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 hover:text-white transition-colors"
                            title={template.archived ? "Desarchivar" : "Archivar"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(template.id);
                            }}
                            className="p-1 bg-red-700 hover:bg-red-600 rounded text-white transition-colors"
                            title="Eliminar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const cardBg = isLightMode ? '#ffffff' : 'rgba(30, 41, 59, 0.3)';
    const borderColor = isLightMode ? '#dbeafe' : 'rgba(51, 65, 85, 0.5)';
    const headerBg = isLightMode ? '#ffffff' : 'rgba(2, 6, 23, 0.5)';
    const textColor = isLightMode ? '#1e3a8a' : '#f1f5f9';
    const textSecondary = isLightMode ? '#475569' : '#94a3b8';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';

    return (
        <div
            className="h-full flex flex-col rounded-lg border overflow-hidden transition-colors duration-500"
            style={{
                backgroundColor: cardBg,
                borderColor: borderColor
            }}
        >
            <div
                className="p-4 border-b transition-colors duration-500"
                style={{
                    backgroundColor: headerBg,
                    borderBottomColor: borderColor
                }}
            >
                <h2 className="text-lg font-semibold transition-colors duration-500" style={{ color: textColor }}>Plantillas</h2>
                <p className="text-xs mt-1 transition-colors duration-500" style={{ color: textSecondary }}>Gestión de plantillas de extracción</p>
            </div>

            <div
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{
                    backgroundColor: isLightMode ? '#f0f9ff' : 'transparent'
                }}
            >
                {!isCreatingTemplate ? (
                    <>
                        {/* SECCIÓN 1: MIS MODELOS */}
                        <div className="border-2 rounded-lg overflow-hidden" style={{ borderColor: borderColor }}>
                            <button
                                onClick={() => setShowMyModelsSection(!showMyModelsSection)}
                                className="w-full flex items-center justify-between p-3 transition-colors hover:opacity-80"
                                style={{
                                    backgroundColor: isLightMode ? '#eff6ff' : 'rgba(2, 6, 23, 0.5)',
                                    color: textColor
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <FileIcon className="w-4 h-4" style={{ color: isLightMode ? '#a855f7' : '#c084fc' }} />
                                    <span className="text-sm font-semibold">Mis Modelos</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{
                                        backgroundColor: isLightMode ? '#dbeafe' : 'rgba(6, 182, 212, 0.2)',
                                        color: isLightMode ? '#1e3a8a' : '#22d3ee'
                                    }}>
                                        {activeCustomTemplates.length}
                                    </span>
                                </div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-5 w-5 transition-transform ${showMyModelsSection ? 'rotate-180' : ''}`}
                                    style={{ color: textSecondary }}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {showMyModelsSection && (
                                <div className="p-3 space-y-3">
                                    {/* Botón crear plantilla */}
                                    <button
                                        onClick={() => setIsCreatingTemplate(true)}
                                        className="w-full p-2 border border-dashed rounded transition-all flex items-center justify-center gap-2 font-medium text-sm hover:opacity-90"
                                        style={{
                                            backgroundColor: isLightMode ? '#dbeafe' : 'rgba(6, 182, 212, 0.2)',
                                            borderColor: isLightMode ? '#93c5fd' : 'rgba(34, 211, 238, 0.5)',
                                            color: isLightMode ? '#1e3a8a' : '#22d3ee'
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span>Crear Nueva Plantilla</span>
                                    </button>

                                    {/* Plantillas predefinidas del cliente (ej: FUNDAE para Normadat) */}
                                    {clientPredefinedTemplates.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium" style={{ color: textSecondary }}>📋 Plantillas de tu empresa:</p>
                                            {clientPredefinedTemplates.map(template => (
                                                <TemplateCard key={template.id} template={template} showActions={false} />
                                            ))}
                                        </div>
                                    )}

                                    {/* Plantillas personalizadas */}
                                    {activeCustomTemplates.length > 0 && (
                                        <div className="space-y-2 mt-3">
                                            <p className="text-xs font-medium" style={{ color: textSecondary }}>🔧 Tus plantillas:</p>
                                            {activeCustomTemplates.map(template => (
                                                <TemplateCard key={template.id} template={template} showActions={true} />
                                            ))}
                                        </div>
                                    )}
                                    
                                    {clientPredefinedTemplates.length === 0 && activeCustomTemplates.length === 0 && (
                                        <div className="text-center py-4 text-xs" style={{ color: textSecondary }}>
                                            <p>No tienes plantillas</p>
                                            <p className="mt-1">Crea una para empezar</p>
                                        </div>
                                    )}

                                    {/* Plantillas archivadas */}
                                    {archivedCustomTemplates.length > 0 && (
                                        <div className="mt-3 pt-3 border-t" style={{ borderTopColor: borderColor }}>
                                            <button
                                                onClick={() => setShowArchivedCustom(!showArchivedCustom)}
                                                className="w-full flex items-center justify-between p-2 rounded transition-colors hover:opacity-80"
                                                style={{ color: textSecondary }}
                                            >
                                                <span className="text-xs font-medium">Plantillas Archivadas ({archivedCustomTemplates.length})</span>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className={`h-4 w-4 transition-transform ${showArchivedCustom ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            {showArchivedCustom && (
                                                <div className="mt-2 space-y-2">
                                                    {archivedCustomTemplates.map(template => (
                                                        <TemplateCard key={template.id} template={template} showActions={true} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* SECCIÓN 2: PLANTILLAS PREDEFINIDAS */}
                        <div className="border-2 rounded-lg overflow-hidden" style={{ borderColor: borderColor }}>
                            <button
                                onClick={() => setShowTemplatesSection(!showTemplatesSection)}
                                className="w-full flex items-center justify-between p-3 transition-colors hover:opacity-80"
                                style={{
                                    backgroundColor: isLightMode ? '#eff6ff' : 'rgba(2, 6, 23, 0.5)',
                                    color: textColor
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <FileTextIcon className="w-4 h-4" style={{ color: accentColor }} />
                                    <span className="text-sm font-semibold">Plantillas Predefinidas</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{
                                        backgroundColor: isLightMode ? '#dbeafe' : 'rgba(6, 182, 212, 0.2)',
                                        color: isLightMode ? '#1e3a8a' : '#22d3ee'
                                    }}>
                                        {filteredTemplates.length}
                                    </span>
                                </div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-5 w-5 transition-transform ${showTemplatesSection ? 'rotate-180' : ''}`}
                                    style={{ color: textSecondary }}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {showTemplatesSection && (
                                <div className="p-3 space-y-3">
                                    {/* Selector de departamento */}
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: textColor }}>
                                            Departamento:
                                        </label>
                                        <select
                                            value={selectedDepartamento}
                                            onChange={(e) => handleDepartamentoChange(e.target.value as Departamento)}
                                            className="w-full rounded-md p-2 text-sm transition-colors"
                                            style={{
                                                backgroundColor: isLightMode ? '#ffffff' : '#1e293b',
                                                borderColor: borderColor,
                                                color: textColor,
                                                border: `1px solid ${borderColor}`
                                            }}
                                        >
                                            {DEPARTAMENTOS.map(dept => (
                                                <option key={dept.id} value={dept.id}>
                                                    {dept.icon} {dept.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Plantillas filtradas */}
                                    {filteredTemplates.length > 0 ? (
                                        <div className="space-y-2">
                                            {filteredTemplates.map(template => (
                                                <TemplateCard key={template.id} template={template} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-xs" style={{ color: textSecondary }}>
                                            <p>No hay plantillas para este departamento</p>
                                        </div>
                                    )}

                                    {/* Plantillas archivadas */}
                                    {filteredArchivedTemplates.length > 0 && (
                                        <div className="mt-3 pt-3 border-t" style={{ borderTopColor: borderColor }}>
                                            <button
                                                onClick={() => setShowArchived(!showArchived)}
                                                className="w-full flex items-center justify-between p-2 rounded transition-colors hover:opacity-80"
                                                style={{ color: textSecondary }}
                                            >
                                                <span className="text-xs font-medium">Plantillas Archivadas ({filteredArchivedTemplates.length})</span>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className={`h-4 w-4 transition-transform ${showArchived ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            {showArchived && (
                                                <div className="mt-2 space-y-2">
                                                    {filteredArchivedTemplates.map(template => (
                                                        <TemplateCard key={template.id} template={template} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-3">
                        {/* Header con título y botón cancelar */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold transition-colors" style={{ color: textColor }}>
                                Nueva Plantilla
                            </h3>
                            <button
                                onClick={() => {
                                    setIsCreatingTemplate(false);
                                    setNewSchema([{ id: `field-${Date.now()}`, name: '', type: 'STRING' }]);
                                    setNewPrompt('Extrae la información clave del siguiente documento según el esquema JSON proporcionado.');
                                }}
                                className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                                style={{
                                    backgroundColor: isLightMode ? '#fee2e2' : 'rgba(239, 68, 68, 0.2)',
                                    color: isLightMode ? '#dc2626' : '#f87171'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>

                        {/* Formulario de nombre y descripción */}
                        <div className="space-y-2">
                            <div>
                                <label className="block text-xs font-medium mb-1 transition-colors" style={{ color: textColor }}>
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Factura Médica"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    className="w-full rounded px-2 py-1.5 text-sm transition-colors"
                                    style={{
                                        backgroundColor: isLightMode ? '#ffffff' : '#1e293b',
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: borderColor,
                                        color: textColor
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1 transition-colors" style={{ color: textColor }}>
                                    Descripción (opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Breve descripción"
                                    value={newTemplateDescription}
                                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                                    className="w-full rounded px-2 py-1.5 text-sm transition-colors"
                                    style={{
                                        backgroundColor: isLightMode ? '#ffffff' : '#1e293b',
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: borderColor,
                                        color: textColor
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1 transition-colors" style={{ color: textColor }}>
                                    Prompt
                                </label>
                                <textarea
                                    value={newPrompt}
                                    onChange={(e) => setNewPrompt(e.target.value)}
                                    rows={2}
                                    className="w-full rounded px-2 py-1.5 text-sm transition-colors"
                                    style={{
                                        backgroundColor: isLightMode ? '#ffffff' : '#1e293b',
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: borderColor,
                                        color: textColor
                                    }}
                                />
                            </div>
                        </div>

                        {/* Schema Builder */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-medium transition-colors" style={{ color: textColor }}>
                                    Campos del Esquema
                                </label>
                                <button
                                    onClick={handleGenerateSchemaFromPrompt}
                                    disabled={isGeneratingSchema || !newPrompt.trim()}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                                    style={{
                                        backgroundColor: isLightMode ? '#2563eb' : '#06b6d4',
                                        color: '#ffffff'
                                    }}
                                >
                                    {isGeneratingSchema ? (
                                        <>
                                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            ...
                                        </>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-3 h-3" />
                                            Generar desde Prompt
                                        </>
                                    )}
                                </button>
                            </div>
                            <SchemaBuilder
                                schema={newSchema}
                                setSchema={setNewSchema}
                                theme={theme}
                                isLightMode={isLightMode}
                            />
                        </div>

                        {/* Botón guardar */}
                        <button
                            onClick={handleSaveTemplate}
                            disabled={isSaveDisabled}
                            className="w-full p-2 rounded font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                            style={{
                                backgroundColor: isLightMode ? '#2563eb' : '#06b6d4',
                                color: '#ffffff'
                            }}
                        >
                            Guardar Plantilla
                        </button>
                        {isSaveDisabled && disabledReason && (
                            <p className="text-xs text-center mt-1.5" style={{ color: isLightMode ? '#ef4444' : '#f87171' }}>
                                {disabledReason}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
