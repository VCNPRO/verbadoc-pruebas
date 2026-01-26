// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Loader2, FileText,
  X, CheckSquare, Gauge, Search,
  ChevronLeft, ChevronRight, Trash2,
  Save, FileType, Fingerprint, Cpu, Plus,
  AlertTriangle, BookOpen, RefreshCw,
  ZoomIn, ZoomOut, Layers, Monitor, ArrowLeft,
  Upload, Download, FolderOpen
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

// Tipos
interface Region {
  id: string;
  label: string;
  type: 'text' | 'box' | 'field';
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  isAnchor?: boolean;
  extractedValue?: string;
  isProcessing?: boolean;
}

interface FormTemplate {
  id: string;
  name: string;
  regions: Region[];
  pagePreviews: string[];
  totalWidth?: number;
  totalHeight?: number;
}

interface BatchItem {
  id: string;
  file: File;
  previews: string[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  results?: Region[];
  progress: number;
  errorMessage?: string;
  offset?: { x: number; y: number };
}

// Configurar PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';

// Utilidad para recortar imagen
const cropImage = (imageUrl: string, region: Region): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Canvas context error");

      const realX = (region.x / 100) * img.width;
      const realY = (region.y / 100) * img.height;
      const realW = (region.width / 100) * img.width;
      const realH = (region.height / 100) * img.height;

      canvas.width = realW;
      canvas.height = realH;

      ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
};

export default function TemplateEditorPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'editor' | 'library' | 'batch'>('editor');
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [lastMessage, setLastMessage] = useState<{ text: string, type: 'info' | 'error' | 'success' } | null>(null);

  const [zoom, setZoom] = useState(1.0);
  const BASE_WIDTH = 800;

  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  const [editorDoc, setEditorDoc] = useState<{previews: string[], regions: Region[], name?: string} | null>(null);

  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedResult, setSelectedResult] = useState<BatchItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Coordenadas del cursor en tiempo real
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);

  // Panel de precisión visible
  const [showPrecisionPanel, setShowPrecisionPanel] = useState(true);

  // Indicador de auto-guardado
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | null>(null);

  // Cargar plantillas desde la API y trabajo guardado localmente
  useEffect(() => {
    const init = async () => {
      await fetchTemplates();

      // Recuperar trabajo guardado en localStorage
      const savedWork = localStorage.getItem('verbadoc_draft');
      if (savedWork) {
        try {
          const parsed = JSON.parse(savedWork);
          if (parsed.regions && parsed.regions.length > 0) {
            setEditorDoc(parsed);
            setAutoSaveStatus('saved');
          }
        } catch (e) {
          console.error('Error loading saved work:', e);
        }
      }

      setIsInitializing(false);
    };
    init();
  }, []);

  // Auto-guardar en localStorage cuando cambian las regiones
  useEffect(() => {
    if (editorDoc && editorDoc.regions.length > 0) {
      setAutoSaveStatus('saving');
      const timeout = setTimeout(() => {
        localStorage.setItem('verbadoc_draft', JSON.stringify(editorDoc));
        setAutoSaveStatus('saved');
      }, 500); // Debounce de 500ms
      return () => clearTimeout(timeout);
    }
  }, [editorDoc]);

  const fetchTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const res = await fetch('/api/templates', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Convertir formato de BD a formato local
        const formatted = data.map((t: any) => ({
          id: t.id,
          name: t.name,
          regions: t.regions || [],
          pagePreviews: t.page_previews || []
        }));
        setTemplates(formatted);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const showStatus = (text: string, type: 'info' | 'error' | 'success', duration = 3000) => {
    setLastMessage({ text, type });
    if (duration > 0) {
      setTimeout(() => {
        setLastMessage(current => (current?.text === text ? null : current));
      }, duration);
    }
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isMaster: boolean) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    showStatus("Procesando PDF...", 'info', 0);
    try {
      const allPreviews: string[] = [];
      for (const file of files) {
        const data = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data }).promise;

        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport }).promise;
          allPreviews.push(canvas.toDataURL('image/jpeg', 0.8));
        }

        if (isMaster) {
          setEditorDoc({ previews: allPreviews, regions: [] });
          setActiveTab('editor');
          setCurrentPage(0);
          showStatus("Documento Maestro cargado", 'success');
          break;
        } else {
          setBatch(prev => [...prev, {
            id: crypto.randomUUID(),
            file,
            previews: [...allPreviews],
            status: 'pending',
            progress: 0
          }]);
          showStatus("Añadido al lote de procesamiento", 'success');
        }
      }
    } catch (err) {
      console.error(err);
      showStatus("Error crítico al procesar PDF", 'error');
    }
  };

  const handleAutoDetect = async () => {
    if (!editorDoc) return;
    setIsAnalyzing(true);
    showStatus("La IA está analizando el formulario...", 'info', 0);
    try {
      const base64 = editorDoc.previews[currentPage].split(',')[1];
      const res = await fetch('/api/analyze-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ base64Image: base64 })
      });

      if (!res.ok) throw new Error('Error en análisis');

      const data = await res.json();
      const regions = (data.regions || []).map((r: any) => ({
        ...r,
        id: crypto.randomUUID(),
        pageIndex: currentPage,
        x: Math.max(0, Math.min(100, r.x)),
        y: Math.max(0, Math.min(100, r.y)),
        width: Math.max(1, Math.min(100, r.width)),
        height: Math.max(1, Math.min(100, r.height))
      }));

      setEditorDoc(p => p ? { ...p, regions: [...p.regions, ...regions] } : null);
      showStatus(`Se han detectado ${regions.length} regiones`, 'success');
    } catch (e: any) {
      console.error(e);
      showStatus("Fallo en el motor de IA", 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editorDoc) return;
    // Usar el nombre del editor si existe, si no pedir uno
    let name = editorDoc.name?.trim();
    if (!name) {
      name = prompt("Asigna un nombre descriptivo a esta configuración:");
    }
    if (!name || editorDoc.regions.length === 0) {
      showStatus("Se necesita un nombre y al menos una región", 'error');
      return;
    }
    // Guardar el nombre en el estado
    setEditorDoc(prev => prev ? {...prev, name} : null);

    showStatus("Guardando plantilla...", 'info', 0);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          regions: editorDoc.regions,
          page_previews: editorDoc.previews
        })
      });

      if (!res.ok) throw new Error('Error al guardar');

      await fetchTemplates();
      showStatus("Plantilla guardada con éxito", 'success');
    } catch (error) {
      console.error(error);
      showStatus("Error al guardar la plantilla", 'error');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar esta plantilla?")) return;
    try {
      const res = await fetch(`/api/templates?id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await fetchTemplates();
        showStatus("Plantilla eliminada", 'success');
      }
    } catch (error) {
      console.error(error);
      showStatus("Error al eliminar", 'error');
    }
  };

  const handleBatchRun = async () => {
    if (templates.length === 0) {
      showStatus("Primero debes crear y guardar una plantilla", 'error');
      return;
    }
    const template = templates[0];
    setIsProcessing(true);
    showStatus("Extrayendo datos masivamente...", 'info', 0);

    try {
      for (const item of batch) {
        if (item.status === 'completed') continue;
        setBatch(p => p.map(i => i.id === item.id ? { ...i, status: 'processing', progress: 0 } : i));

        const results: Region[] = [];
        for (let i = 0; i < template.regions.length; i++) {
          const reg = template.regions[i];
          const pagePreview = item.previews[reg.pageIndex] || item.previews[0];
          const b64 = await cropImage(pagePreview, reg);

          // Extraer campo via API
          const extractRes = await fetch('/api/extract-field', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ base64Image: b64, region: reg })
          });

          let val = '';
          if (extractRes.ok) {
            const extractData = await extractRes.json();
            val = extractData.value || '';
          }

          results.push({ ...reg, extractedValue: val });

          setBatch(p => p.map(it => it.id === item.id ? {
            ...it,
            progress: Math.round(((i + 1) / template.regions.length) * 100)
          } : it));
        }
        setBatch(p => p.map(i => i.id === item.id ? { ...i, status: 'completed', results } : i));
      }
      showStatus("Lote completado con éxito", 'success');
    } catch (e: any) {
      console.error(e);
      showStatus("Interrupción en el proceso por lotes", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Importar plantilla desde archivo JSON
  const handleImportTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validar que tenga regiones
      const regions = data.regions || data;
      if (!Array.isArray(regions)) {
        showStatus("El archivo no contiene regiones válidas", 'error');
        return;
      }

      // Asegurar que cada región tenga un ID único y pageIndex
      // Si no tiene pageIndex, usar la página actual del editor
      const importedRegions: Region[] = regions.map((r: any) => ({
        id: r.id || crypto.randomUUID(),
        label: r.label || 'CAMPO',
        type: r.type === 'box' ? 'box' : 'field',
        x: Number(r.x) || 0,
        y: Number(r.y) || 0,
        width: Number(r.width) || 5,
        height: Number(r.height) || 2,
        pageIndex: r.pageIndex !== undefined ? Number(r.pageIndex) : currentPage,
        isAnchor: r.isAnchor || false,
      }));

      // Añadir las regiones importadas al documento actual
      setEditorDoc(prev => {
        if (!prev) return null;
        // Filtrar regiones existentes de las páginas que se van a importar
        const pagesToImport = [...new Set(importedRegions.map(r => r.pageIndex))];
        const existingRegions = prev.regions.filter(r => !pagesToImport.includes(r.pageIndex));
        return {
          ...prev,
          regions: [...existingRegions, ...importedRegions]
        };
      });

      showStatus(`Importadas ${importedRegions.length} regiones correctamente`, 'success');

      // Limpiar el input para permitir reimportar el mismo archivo
      e.target.value = '';
    } catch (error) {
      console.error('Error importando plantilla:', error);
      showStatus("Error al leer el archivo JSON", 'error');
    }
  };

  // Exportar plantilla actual como JSON
  const handleExportTemplate = () => {
    if (!editorDoc || editorDoc.regions.length === 0) {
      showStatus("No hay regiones para exportar", 'error');
      return;
    }

    const exportData = {
      regions: editorDoc.regions.map(r => ({
        label: r.label,
        type: r.type,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        id: r.id,
        pageIndex: r.pageIndex,
        ...(r.isAnchor ? { isAnchor: true } : {})
      })),
      exportedAt: new Date().toISOString(),
      totalRegions: editorDoc.regions.length,
      pages: [...new Set(editorDoc.regions.map(r => r.pageIndex))].length
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_verbadoc_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showStatus(`Exportadas ${editorDoc.regions.length} regiones`, 'success');
  };

  // Función auxiliar para calcular coordenadas del mouse relativas al documento
  const getMouseCoordsInDocument = useCallback((e: MouseEvent | React.MouseEvent) => {
    // Usar la imagen como referencia ya que tiene las dimensiones reales
    const element = imageRef.current || containerRef.current;
    if (!element) return { x: 0, y: 0 };

    const rect = element.getBoundingClientRect();

    // Calcular posición relativa al elemento
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;

    // Convertir a porcentaje
    const x = (relativeX / rect.width) * 100;
    const y = (relativeY / rect.height) * 100;

    return { x, y };
  }, []);

  // Drag & Drop de regiones
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault(); // Prevenir selección de texto mientras se arrastra
    const region = editorDoc?.regions.find(r => r.id === id);
    if (!region || !containerRef.current) return;
    setSelectedRegionIds([id]);
    setDraggingId(id);

    const coords = getMouseCoordsInDocument(e);
    dragOffset.current = { x: coords.x - region.x, y: coords.y - region.y };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    if (!draggingId && !resizingId) return;

    const coords = getMouseCoordsInDocument(e);

    if (draggingId) {
      const newX = Math.max(0, Math.min(100, coords.x - dragOffset.current.x));
      const newY = Math.max(0, Math.min(100, coords.y - dragOffset.current.y));
      setEditorDoc(prev => prev ? {
        ...prev,
        regions: prev.regions.map(r => r.id === draggingId ? { ...r, x: newX, y: newY } : r)
      } : null);
    }

    if (resizingId) {
      const region = editorDoc?.regions.find(r => r.id === resizingId);
      if (region) {
        const newWidth = Math.max(2, Math.min(100 - region.x, coords.x - region.x));
        const newHeight = Math.max(2, Math.min(100 - region.y, coords.y - region.y));
        setEditorDoc(prev => prev ? {
          ...prev,
          regions: prev.regions.map(r => r.id === resizingId ? { ...r, width: newWidth, height: newHeight } : r)
        } : null);
      }
    }
  }, [draggingId, resizingId, editorDoc, getMouseCoordsInDocument]);

  useEffect(() => {
    const handleMouseUp = () => {
      setDraggingId(null);
      setResizingId(null);
    };
    if (draggingId || resizingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, resizingId, handleMouseMove]);

  const handleResizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setResizingId(id);
    setSelectedRegionIds([id]);
  };

  // Trackear coordenadas del cursor sobre el documento
  const handleDocumentMouseMove = (e: React.MouseEvent) => {
    const coords = getMouseCoordsInDocument(e);
    setCursorCoords({ x: Math.max(0, Math.min(100, coords.x)), y: Math.max(0, Math.min(100, coords.y)) });
  };

  const handleDocumentMouseLeave = () => {
    setCursorCoords(null);
  };

  // Actualizar propiedades de región con precisión
  const updateRegionProperty = (regionId: string, property: keyof Region, value: number) => {
    setEditorDoc(prev => prev ? {
      ...prev,
      regions: prev.regions.map(r => r.id === regionId ? { ...r, [property]: Math.max(0, Math.min(100, value)) } : r)
    } : null);
  };

  // Seleccionar todas las regiones detectadas
  const handleSelectAll = () => {
    if (!editorDoc) return;
    const currentPageRegions = editorDoc.regions.filter(r => r.pageIndex === currentPage);
    setSelectedRegionIds(currentPageRegions.map(r => r.id));
  };

  // Toggle región como ancla
  const toggleAnchor = (regionId: string) => {
    setEditorDoc(prev => prev ? {
      ...prev,
      regions: prev.regions.map(r => r.id === regionId ? { ...r, isAnchor: !r.isAnchor } : r)
    } : null);
  };

  // Obtener región seleccionada (para panel de precisión)
  const selectedRegion = selectedRegionIds.length === 1
    ? editorDoc?.regions.find(r => r.id === selectedRegionIds[0])
    : null;

  // Abrir panel de precisión automáticamente al seleccionar una región
  useEffect(() => {
    if (selectedRegion) {
      setShowPrecisionPanel(true);
    }
  }, [selectedRegion?.id]);

  if (isInitializing) return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
      <Loader2 className="animate-spin text-indigo-500" size={40} />
      <div className="text-center">
        <h1 className="text-white text-xs font-black uppercase tracking-[0.5em]">VerbaDoc IDP</h1>
        <p className="text-slate-500 text-[10px] mt-2 font-bold">INICIALIZANDO MOTOR DE IA</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#020617] text-slate-300 overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Sidebar de Navegación */}
      <aside className="w-16 border-r border-slate-800/50 bg-slate-900/50 backdrop-blur-xl flex flex-col items-center py-8 gap-8 z-50 shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] mb-4">
          <Fingerprint size={24}/>
        </div>
        <nav className="flex flex-col gap-5">
          <button onClick={() => setActiveTab('editor')} className={`p-3 rounded-2xl transition-all duration-300 ${activeTab === 'editor' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`} title="Editor Forense"><Layout size={22} /></button>
          <button onClick={() => setActiveTab('library')} className={`p-3 rounded-2xl transition-all duration-300 ${activeTab === 'library' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`} title="Archivo de Plantillas"><BookOpen size={22} /></button>
          <button onClick={() => setActiveTab('batch')} className={`p-3 rounded-2xl transition-all duration-300 ${activeTab === 'batch' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`} title="Procesamiento en Lote"><Gauge size={22} /></button>
        </nav>
        <button onClick={() => navigate('/')} className="mt-auto p-3 text-slate-600 hover:text-indigo-400 transition-colors" title="Volver a VerbaDoc"><ArrowLeft size={22}/></button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-slate-900/30 border-b border-slate-800/50 flex items-center justify-between px-8 z-40 shrink-0 backdrop-blur-sm">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[14px] font-black tracking-tighter text-white uppercase">VerbaDoc <span className="text-indigo-500">IDP</span></span>
              <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Forensic Logic Engine</span>
            </div>
            <div className="h-8 w-px bg-slate-800 mx-2" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
              {activeTab === 'editor' ? 'EDITOR' : activeTab === 'library' ? 'BIBLIOTECA' : 'LOTES'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {editorDoc && activeTab === 'editor' && (
              <>
                <input
                  type="text"
                  placeholder="Nombre de plantilla..."
                  value={editorDoc.name || ''}
                  onChange={(e) => setEditorDoc(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-[11px] font-bold focus:border-indigo-500 focus:outline-none w-48"
                />
                <span className="text-[10px] text-slate-500 font-bold">
                  {editorDoc.regions.length} regiones
                </span>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative flex bg-[#020617]">
          {activeTab === 'library' ? (
            <div className="p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 overflow-y-auto w-full custom-scrollbar">
              {isLoadingTemplates ? (
                <div className="col-span-full flex justify-center py-20">
                  <Loader2 className="animate-spin text-indigo-500" size={40}/>
                </div>
              ) : templates.length === 0 ? (
                <div className="col-span-full py-48 flex flex-col items-center justify-center text-slate-800">
                  <Monitor size={64} className="mb-6 opacity-20" strokeWidth={1}/>
                  <span className="text-[11px] font-black uppercase tracking-[0.5em] opacity-40">Sin Registros en el Archivo</span>
                </div>
              ) : (
                templates.map(t => (
                  <div key={t.id} className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl shadow-2xl hover:border-indigo-500/50 transition-all group flex flex-col gap-6 backdrop-blur-sm">
                    <div className="flex justify-between items-start">
                      <h3 className="text-[14px] font-black text-white uppercase tracking-tight leading-tight">{t.name}</h3>
                      <button onClick={() => deleteTemplate(t.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1"><Trash2 size={18}/></button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-black text-xs">{t.regions.length}</div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Campos Mapeados</span>
                    </div>
                    <button onClick={() => { setEditorDoc({ previews: t.pagePreviews || [], regions: t.regions }); setActiveTab('editor'); }} className="mt-auto w-full py-3.5 bg-slate-800 text-white text-[10px] font-black uppercase border border-slate-700 rounded-2xl hover:bg-indigo-600 hover:border-indigo-500 transition-all tracking-widest">Activar Configuración</button>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'batch' ? (
            <div className="p-12 space-y-12 overflow-y-auto w-full custom-scrollbar">
              <div className="flex justify-between items-end border-b border-slate-800/50 pb-10">
                <div className="flex flex-col gap-2">
                  <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Consola de Lotes</h2>
                  <p className="text-slate-500 text-xs font-bold tracking-widest">COLA DE PROCESAMIENTO MULTI-DOCUMENTO</p>
                </div>
                <button onClick={handleBatchRun} disabled={isProcessing || batch.length === 0} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[12px] font-black uppercase shadow-[0_20px_40px_rgba(79,70,229,0.3)] disabled:opacity-20 hover:bg-indigo-500 flex items-center gap-3 transition-all tracking-[0.2em] active:scale-95">
                  {isProcessing ? <RefreshCw className="animate-spin" size={20}/> : <Cpu size={20}/>} Iniciar Análisis Masivo
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {batch.map(item => (
                  <div key={item.id} onClick={() => item.status === 'completed' && setSelectedResult(item)} className="p-8 bg-slate-900/60 border border-slate-800 rounded-3xl cursor-pointer hover:border-indigo-500/50 transition-all shadow-2xl relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-all">
                      <FileType size={48} className="text-indigo-400"/>
                    </div>
                    <FileText size={32} className="mb-6 text-slate-600 group-hover:text-indigo-400 transition-colors"/>
                    <div className="text-[13px] font-black truncate text-slate-200 mb-6 tracking-tight uppercase">{item.file.name}</div>
                    <div className="space-y-2">
                       <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                          <span>Progreso</span>
                          <span>{item.progress}%</span>
                       </div>
                       <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                        <div className="h-full bg-indigo-500 transition-all duration-700 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                <label className="p-12 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/40 text-slate-700 bg-slate-900/20 transition-all group min-h-[220px]">
                  <Plus size={40} className="mb-4 group-hover:text-indigo-400 transition-colors group-hover:scale-110 duration-300"/>
                  <span className="text-[11px] font-black uppercase tracking-[0.3em]">Cargar Lote</span>
                  <input type="file" multiple className="hidden" accept=".pdf" onChange={(e) => onFileUpload(e, false)} />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {editorDoc ? (
                <>
                  {/* Panel de Herramientas Lateral */}
                  <aside className="w-80 border-r border-slate-800/50 bg-slate-900/40 backdrop-blur-md flex flex-col z-20 shrink-0 shadow-2xl">
                    <div className="p-6 border-b border-slate-800/50 bg-slate-900/20 space-y-3">
                       <button onClick={handleAutoDetect} disabled={isAnalyzing} className="w-full py-4 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-3 hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-[0_15px_30px_rgba(79,70,229,0.25)] active:scale-95">
                         {isAnalyzing ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>} Auto-Mapeo Neural
                       </button>
                       <div className="grid grid-cols-2 gap-2">
                         <label className="py-2.5 bg-amber-600/80 text-white text-[8px] font-black uppercase tracking-[0.1em] rounded-lg flex items-center justify-center gap-1 hover:bg-amber-500 cursor-pointer transition-all">
                           <Upload size={12}/> Cargar JSON
                           <input type="file" className="hidden" accept=".json" onChange={handleImportTemplate} />
                         </label>
                         <button onClick={handleExportTemplate} className="py-2.5 bg-emerald-600/80 text-white text-[8px] font-black uppercase tracking-[0.1em] rounded-lg flex items-center justify-center gap-1 hover:bg-emerald-500 transition-all">
                           <Download size={12}/> Descargar JSON
                         </button>
                         <button onClick={() => setActiveTab('library')} className="py-2.5 bg-slate-700/80 text-white text-[8px] font-black uppercase tracking-[0.1em] rounded-lg flex items-center justify-center gap-1 hover:bg-slate-600 transition-all">
                           <FolderOpen size={12}/> Cargar Biblioteca
                         </button>
                         <button onClick={handleSaveTemplate} className="py-2.5 bg-indigo-600/80 text-white text-[8px] font-black uppercase tracking-[0.1em] rounded-lg flex items-center justify-center gap-1 hover:bg-indigo-500 transition-all">
                           <Save size={12}/> Guardar Biblioteca
                         </button>
                       </div>
                    </div>

                    <div className="p-6 flex justify-between items-center bg-slate-900/10">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2"><Layers size={14} className="text-indigo-500"/> Regiones de Datos</span>
                       <div className="flex items-center gap-2">
                         <button onClick={handleSelectAll} className="text-slate-600 hover:text-indigo-400 p-1 transition-colors" title="Seleccionar Todo"><CheckSquare size={16}/></button>
                         <button onClick={() => setEditorDoc(p => p ? {...p, regions: p.regions.filter(r => r.pageIndex !== currentPage)} : null)} className="text-slate-600 hover:text-red-400 p-1 transition-colors" title="Borrar mapeo de página"><Trash2 size={16}/></button>
                       </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/20">
                      <div className="flex gap-2 mb-4">
                        <button onClick={() => {
                            const id = crypto.randomUUID();
                            setEditorDoc(p => p ? { ...p, regions: [...p.regions, { id, label: `TEXTO_${p.regions.filter(r=>r.type==='field').length+1}`, type: 'field', x: 40, y: 40, width: 15, height: 2.5, pageIndex: currentPage }] } : null);
                            setSelectedRegionIds([id]);
                         }} className="flex-1 py-3 bg-emerald-900/30 text-emerald-400 text-[9px] font-black uppercase border border-emerald-700/50 border-dashed rounded-xl hover:text-emerald-300 hover:bg-emerald-900/50 transition-all flex items-center justify-center gap-1.5">
                          <FileType size={14}/> Campo Texto
                        </button>
                        <button onClick={() => {
                            const id = crypto.randomUUID();
                            setEditorDoc(p => p ? { ...p, regions: [...p.regions, { id, label: `CASILLA_${p.regions.filter(r=>r.type==='box').length+1}`, type: 'box', x: 40, y: 40, width: 2.5, height: 2, pageIndex: currentPage }] } : null);
                            setSelectedRegionIds([id]);
                         }} className="flex-1 py-3 bg-blue-900/30 text-blue-400 text-[9px] font-black uppercase border border-blue-700/50 border-dashed rounded-xl hover:text-blue-300 hover:bg-blue-900/50 transition-all flex items-center justify-center gap-1.5">
                          <CheckSquare size={14}/> Casilla
                        </button>
                      </div>

                      {editorDoc.regions.filter(r => r.pageIndex === currentPage).map(r => (
                        <div key={r.id} onClick={() => setSelectedRegionIds([r.id])} className={`px-5 py-4 rounded-2xl border transition-all duration-300 group cursor-pointer flex flex-col gap-2 ${selectedRegionIds.includes(r.id) ? 'bg-indigo-600 border-indigo-400 shadow-xl scale-[1.02]' : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'}`}>
                           <div className="flex items-center justify-between">
                             <div className={`flex items-center gap-3 truncate flex-1 ${selectedRegionIds.includes(r.id) ? 'text-white' : r.type === 'box' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                               {r.type === 'box' ? <CheckSquare size={18}/> : <FileType size={18}/>}
                               <input className="bg-transparent border-none text-[12px] font-black uppercase focus:outline-none w-full tracking-tight" value={r.label} onClick={(e) => e.stopPropagation()} onChange={(e) => setEditorDoc(prev => prev ? {...prev, regions: prev.regions.map(x => x.id === r.id ? {...x, label: e.target.value.toUpperCase()} : x)} : null)}/>
                             </div>
                             <button onClick={(e) => { e.stopPropagation(); setEditorDoc(p => p ? { ...p, regions: p.regions.filter(x => x.id !== r.id) } : null); }} className={`${selectedRegionIds.includes(r.id) ? 'text-indigo-200 hover:text-white' : 'text-slate-700 hover:text-red-400'} transition-all`}><X size={18}/></button>
                           </div>
                           <div className="flex justify-between items-center opacity-40">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditorDoc(prev => prev ? {...prev, regions: prev.regions.map(x => x.id === r.id ? {...x, type: x.type === 'box' ? 'field' : 'box'} : x)} : null);
                                }}
                                className="text-[8px] font-black uppercase tracking-widest hover:text-indigo-400"
                              >
                                {r.type === 'box' ? 'Casilla' : 'Campo Texto'}
                              </button>
                              <span className="text-[8px] font-mono">X:{Math.round(r.x)} Y:{Math.round(r.y)}</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </aside>

                  {/* Visor de Documentos */}
                  <div className="flex-1 bg-slate-950 overflow-auto flex flex-col items-center relative p-12 custom-scrollbar">
                    {/* Barra HUD Compacta - Esquina inferior izquierda */}
                    <div className="fixed bottom-4 left-24 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 px-3 py-2 rounded-xl z-[100] flex items-center gap-4 shadow-lg text-xs">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1 disabled:opacity-20 hover:bg-slate-800 rounded text-white transition-all"><ChevronLeft size={16}/></button>
                        <span className="text-indigo-400 font-bold min-w-[40px] text-center">{currentPage + 1}/{editorDoc.previews.length}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(editorDoc.previews.length - 1, p + 1))} disabled={currentPage === editorDoc.previews.length - 1} className="p-1 disabled:opacity-20 hover:bg-slate-800 rounded text-white transition-all"><ChevronRight size={16}/></button>
                      </div>
                      <div className="w-px h-4 bg-slate-700"/>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setZoom(prev => Math.max(0.4, prev - 0.1))} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-all"><ZoomOut size={14}/></button>
                        <span className="text-white font-bold min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(prev => Math.min(4.0, prev + 0.1))} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-all"><ZoomIn size={14}/></button>
                      </div>
                      {cursorCoords && (
                        <>
                          <div className="w-px h-4 bg-slate-700"/>
                          <span className="font-mono text-emerald-400">X:{cursorCoords.x.toFixed(1)} Y:{cursorCoords.y.toFixed(1)}</span>
                        </>
                      )}
                      {autoSaveStatus && (
                        <>
                          <div className="w-px h-4 bg-slate-700"/>
                          <span className={`${autoSaveStatus === 'saving' ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {autoSaveStatus === 'saving' ? '💾 Guardando...' : '✓ Auto-guardado'}
                          </span>
                        </>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('¿Borrar todo el trabajo actual?')) {
                            localStorage.removeItem('verbadoc_draft');
                            setEditorDoc(null);
                            setAutoSaveStatus(null);
                          }
                        }}
                        className="p-1 hover:bg-red-900/50 rounded text-slate-500 hover:text-red-400 transition-all"
                        title="Limpiar borrador"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>

                    <div className="flex-1 flex justify-center items-start w-full pb-16 pt-4">
                      <div
                        ref={containerRef}
                        className="relative bg-white shadow-[0_40px_100px_rgba(0,0,0,0.6)] transition-all duration-300 ring-1 ring-white/10 h-fit"
                        style={{ width: `${BASE_WIDTH * zoom}px` }}
                        onClick={() => setSelectedRegionIds([])}
                        onMouseMove={handleDocumentMouseMove}
                        onMouseLeave={handleDocumentMouseLeave}
                      >
                        <img
                          ref={imageRef}
                          src={editorDoc.previews[currentPage]}
                          className="w-full select-none brightness-[1.02] contrast-[1.05]"
                          style={{ display: 'block', pointerEvents: 'none' }}
                          draggable={false}
                        />
                        {editorDoc.regions.filter(r => r.pageIndex === currentPage).map((r, index) => {
                          const isSelected = selectedRegionIds.includes(r.id);
                          const isLabel = r.type === 'label' || r.isAnchor;
                          // Z-index: seleccionados encima, labels debajo, otros en medio
                          const zIndex = isSelected ? 200 : isLabel ? 5 : 100 - Math.floor(r.y);

                          // Colores según tipo
                          const colors = isLabel
                            ? { border: 'border-amber-400/60', bg: 'bg-amber-500/5', hoverBg: 'hover:bg-amber-500/10', dot: 'bg-amber-500', labelBg: 'bg-amber-600' }
                            : r.type === 'box'
                            ? { border: 'border-blue-400', bg: 'bg-blue-500/10', hoverBg: 'hover:bg-blue-500/20', dot: 'bg-blue-500', labelBg: 'bg-blue-600' }
                            : { border: 'border-emerald-400', bg: 'bg-emerald-500/10', hoverBg: 'hover:bg-emerald-500/20', dot: 'bg-emerald-500', labelBg: 'bg-emerald-600' };

                          return (
                          <div
                            key={r.id}
                            onMouseDown={(e) => handleMouseDown(e, r.id)}
                            onClick={(e) => { e.stopPropagation(); setSelectedRegionIds([r.id]); }}
                            className={`absolute border-2 cursor-move flex items-center justify-center group/region ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-500/20 ring-4 ring-indigo-500/30'
                                : `${colors.border} ${colors.bg} ${colors.hoverBg}`
                            } ${isLabel ? 'border-dashed' : ''}`}
                            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.width}%`, height: `${r.height}%`, zIndex }}
                          >
                            {/* Label del campo */}
                            <div
                              className={`absolute left-0 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg select-none whitespace-nowrap pointer-events-none transition-opacity duration-150 ${
                                isSelected
                                  ? 'opacity-100 bg-indigo-600 -top-5'
                                  : isLabel
                                  ? 'opacity-70 -top-4 ' + colors.labelBg
                                  : 'opacity-0 group-hover/region:opacity-100 -top-4 ' + colors.labelBg
                              }`}
                              style={{ zIndex: zIndex + 1 }}
                            >
                              {isLabel && <span className="mr-1">📌</span>}
                              {r.type === 'box' && <span className="mr-1">☐</span>}
                              {r.type === 'field' && <span className="mr-1">✏️</span>}
                              {r.label}
                            </div>
                            {/* Indicador pequeño siempre visible (excepto labels que ya muestran su etiqueta) */}
                            {!isSelected && !isLabel && (
                              <div className={`absolute -top-1 -left-1 w-2 h-2 rounded-full shadow ${colors.dot}`} />
                            )}
                            {/* Tirador de Redimensionamiento */}
                            {isSelected && (
                              <div
                                onMouseDown={(e) => handleResizeStart(e, r.id)}
                                className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-600 border-2 border-white cursor-nwse-resize rounded-sm shadow-lg"
                              />
                            )}
                          </div>
                        );})}
                      </div>
                    </div>

                    {/* Panel de Precisión Flotante */}
                    {selectedRegion && showPrecisionPanel && (
                      <div className="fixed right-8 top-40 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-800/50 rounded-3xl shadow-2xl z-[200] overflow-hidden">
                        <div className="p-4 border-b border-slate-800/50 flex justify-between items-center">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Ajuste de Precisión</span>
                          <button onClick={() => setShowPrecisionPanel(false)} className="text-slate-600 hover:text-white p-1"><X size={16}/></button>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="text-[11px] font-black text-white uppercase mb-3 truncate">{selectedRegion.label}</div>

                          {/* Coordenadas X, Y */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">X (%)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={selectedRegion.x.toFixed(1)}
                                onChange={(e) => updateRegionProperty(selectedRegion.id, 'x', parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-[12px] font-mono focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Y (%)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={selectedRegion.y.toFixed(1)}
                                onChange={(e) => updateRegionProperty(selectedRegion.id, 'y', parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-[12px] font-mono focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Dimensiones W, H */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Ancho (%)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="1"
                                max="100"
                                value={selectedRegion.width.toFixed(1)}
                                onChange={(e) => updateRegionProperty(selectedRegion.id, 'width', parseFloat(e.target.value) || 1)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-[12px] font-mono focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Alto (%)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="1"
                                max="100"
                                value={selectedRegion.height.toFixed(1)}
                                onChange={(e) => updateRegionProperty(selectedRegion.id, 'height', parseFloat(e.target.value) || 1)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-[12px] font-mono focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Tipo y Ancla */}
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Tipo</label>
                              <select
                                value={selectedRegion.type}
                                onChange={(e) => setEditorDoc(prev => prev ? {...prev, regions: prev.regions.map(r => r.id === selectedRegion.id ? {...r, type: e.target.value as any} : r)} : null)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-[11px] font-bold uppercase focus:border-indigo-500 focus:outline-none"
                              >
                                <option value="field">Campo</option>
                                <option value="box">Casilla</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Ancla</label>
                              <button
                                onClick={() => toggleAnchor(selectedRegion.id)}
                                className={`w-full py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${selectedRegion.isAnchor ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-amber-600'}`}
                              >
                                {selectedRegion.isAnchor ? '⚓ Activa' : 'Marcar'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#020617] relative">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>
                  <div className="w-32 h-32 bg-slate-900 border border-slate-800 rounded-[40px] flex items-center justify-center mb-12 shadow-2xl text-indigo-500 animate-pulse-slow">
                    <Cpu size={56} strokeWidth={1.5}/>
                  </div>
                  <h2 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase text-center max-w-lg">Configuración de Estructura Maestro</h2>
                  <p className="text-slate-500 text-[14px] mb-16 text-center max-w-sm font-medium leading-relaxed tracking-wide">Carga el documento original para parametrizar la red neuronal de extracción y definir las coordenadas forenses.</p>
                  <label className="px-12 py-5 bg-indigo-600 text-white rounded-2xl text-[14px] font-black uppercase tracking-[0.3em] cursor-pointer hover:bg-indigo-500 transition-all shadow-[0_25px_50px_-12px_rgba(79,70,229,0.5)] hover:scale-110 active:scale-95 z-10">
                    Cargar Documento PDF
                    <input type="file" className="hidden" accept=".pdf" onChange={(e) => onFileUpload(e, true)} />
                  </label>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Notificaciones HUD Profesionales */}
      {lastMessage && (
        <div className={`fixed bottom-12 right-12 px-10 py-6 border rounded-[2rem] text-[11px] font-black z-[300] shadow-[0_30px_80px_rgba(0,0,0,0.8)] flex items-center gap-6 animate-in slide-in-from-bottom-20 duration-500 backdrop-blur-2xl ${lastMessage.type === 'error' ? 'bg-red-950/80 border-red-800/50 text-red-200' : lastMessage.type === 'success' ? 'bg-indigo-950/80 border-indigo-500/50 text-white' : 'bg-slate-900/90 border-slate-700/50 text-indigo-400'}`}>
          {lastMessage.type === 'error' ? <AlertTriangle size={24}/> : lastMessage.type === 'success' ? <CheckSquare size={24} className="text-indigo-400"/> : <RefreshCw size={24} className="animate-spin text-indigo-500"/>}
          <div className="flex flex-col">
            <span className="tracking-[0.2em] uppercase">{lastMessage.text}</span>
            {lastMessage.type === 'info' && <span className="text-[8px] text-slate-500 font-bold uppercase mt-1">Operación en curso...</span>}
          </div>
          <button onClick={() => setLastMessage(null)} className="ml-6 p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
        </div>
      )}

      {/* Ventana de Inspección Forense (Resultados) */}
      {selectedResult && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl z-[400] flex items-center justify-center p-12 animate-in fade-in duration-500">
          <div className="bg-slate-900 border border-slate-800/50 rounded-[3rem] w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] ring-1 ring-white/5">
            <div className="p-12 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
              <div className="flex flex-col gap-3">
                <h3 className="text-white font-black text-3xl tracking-tighter uppercase leading-none">{selectedResult.file.name}</h3>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-indigo-400 uppercase font-black tracking-[0.6em] bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">Análisis Neuronal Finalizado</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedResult.results?.length} Puntos Extraídos</span>
                </div>
              </div>
              <button onClick={() => setSelectedResult(null)} className="p-4 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-all transform hover:rotate-90 duration-300"><X size={40}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-16 grid grid-cols-1 lg:grid-cols-2 gap-20 custom-scrollbar">
              <div className="space-y-8">
                {selectedResult.results?.map(r => (
                  <div key={r.id} className="p-8 bg-slate-950 rounded-[2rem] border border-slate-800/50 hover:border-indigo-500/30 transition-all shadow-inner group">
                    <div className="text-[10px] text-slate-500 uppercase mb-5 font-black flex justify-between items-center">
                      <span className="tracking-[0.4em] group-hover:text-indigo-400 transition-colors">{r.label}</span>
                      <span className={`text-[9px] px-4 py-1.5 rounded-full font-black border tracking-widest ${r.type === 'box' ? 'bg-indigo-950 text-indigo-400 border-indigo-800/50' : 'bg-emerald-950 text-emerald-400 border-emerald-800/50'}`}>{r.type === 'box' ? 'CASILLA' : 'CAMPO TEXTO'}</span>
                    </div>
                    <div className="text-[16px] font-mono text-white bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-2xl break-words min-h-[70px] flex items-center leading-relaxed tracking-tight group-hover:bg-slate-900 transition-all">
                      {r.extractedValue || <span className="text-slate-700 italic opacity-40 uppercase tracking-widest text-xs">Sin información detectada</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-[2.5rem] border border-slate-800 overflow-hidden bg-slate-950 h-fit sticky top-0 shadow-[0_40px_80px_rgba(0,0,0,0.6)] group ring-1 ring-white/5">
                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-all pointer-events-none"></div>
                <img src={selectedResult.previews[0]} className="w-full opacity-50 grayscale-[30%] group-hover:opacity-80 transition-all duration-700" />
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4f46e5; }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        .animate-pulse-slow { animation: pulse-slow 4s infinite ease-in-out; }
      `}</style>
    </div>
  );
}
