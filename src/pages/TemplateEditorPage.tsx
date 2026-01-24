// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BoxSelect, Loader2, ShieldCheck, Trash2, Info, CheckSquare, Type as TypeIcon } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

// Definir tipos localmente para simplicidad
interface Region {
  id: string;
  label: string;
  type: 'field' | 'box';
  x: number; y: number; width: number; height: number;
}
interface FormTemplate {
  id: string;
  name: string;
  regions: Region[];
}

pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';

export default function TemplateEditorPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // Cargar plantillas existentes desde la BD
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const res = await fetch('/api/templates');
      if (!res.ok) throw new Error('Error al cargar plantillas');
      const data = await res.json();
      setTemplates(data);
    } catch (error) {
      console.error(error);
      alert('No se pudieron cargar las plantillas.');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Renderizar PDF a imagen
  const renderPdfToImage = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Manejar subida de archivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setRegions([]);
      const url = await renderPdfToImage(selectedFile);
      setPreviewUrl(url);
    }
  };

  // Llamar a la API para auto-detectar regiones
  const handleAutoDetect = async () => {
    if (!previewUrl) return;
    try {
      setIsAnalyzing(true);
      const base64Image = previewUrl.split(',')[1];
      const res = await fetch('/api/analyze-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image }),
      });
      if (!res.ok) throw new Error('Error en la detección de IA');
      const data = await res.json();
      setRegions(data.regions || []);
    } catch (error) {
      console.error(error);
      alert('La auto-detección de IA falló.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Guardar la plantilla nueva en la BD
  const handleSaveTemplate = async () => {
    const name = prompt("Nombre descriptivo del patrón (ej. Factura Modelo A):");
    if (!name || regions.length === 0) {
      alert("Se necesita un nombre y al menos una región para guardar.");
      return;
    }
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, regions }),
      });
      if (!res.ok) throw new Error('Error al guardar la plantilla');
      await fetchTemplates(); // Recargar lista
      alert('¡Plantilla guardada con éxito!');
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar la plantilla.');
    }
  };

  // Eliminar una plantilla de la BD
  const deleteTemplate = async (id: string) => {
    if (!confirm("¿Seguro que quieres borrar este patrón maestro?")) return;
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      await fetchTemplates();
    } catch (error) {
      console.error(error);
      alert('No se pudo eliminar la plantilla.');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Vista principal: Editor de Patrones */}
      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col border-r border-gray-200">
          <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white">
            <div className='flex items-center gap-4'>
                <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800">← Volver</button>
                <h1 className="text-xl font-bold text-gray-800">Editor de Plantillas IDP</h1>
            </div>
            <div className="flex gap-4">
              <label className="bg-white hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border border-gray-300">
                Subir PDF Maestro
                <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
              </label>
              <button
                onClick={handleAutoDetect}
                disabled={!previewUrl || isAnalyzing}
                className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={20}/> : "Auto-Detectar Regiones con IA"}
              </button>
              <button
                disabled={regions.length === 0}
                onClick={handleSaveTemplate}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-2 rounded-lg text-sm font-semibold text-white transition-all"
              >
                Guardar como Plantilla
              </button>
            </div>
          </header>

          <main className="flex-1 p-8 overflow-auto flex justify-center bg-gray-100 relative">
             {previewUrl ? (
               <div className="relative bg-white shadow-lg inline-block">
                  <img src={previewUrl} className="block max-h-[80vh] w-auto" draggable={false} />
                  <div className="absolute inset-0">
                    {regions.map(r => (
                      <div
                        key={r.id}
                        className={`absolute border-2 ${r.type === 'box' ? 'border-blue-500 bg-blue-500/20' : 'border-emerald-500 bg-emerald-500/20'} pointer-events-none`}
                        style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.width}%`, height: `${r.height}%` }}
                      >
                        <span className="absolute -top-5 left-0 text-xs bg-gray-800 text-white px-2 py-0.5 rounded whitespace-nowrap">
                          {r.label}
                        </span>
                      </div>
                    ))}
                  </div>
               </div>
             ) : (
               <div className="m-auto text-center max-w-md">
                  <div className="inline-flex p-6 bg-gray-200 rounded-full mb-4 border border-gray-300">
                    <BoxSelect size={50} className="text-gray-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Editor de Plantillas</h3>
                  <p className="text-gray-500 mt-1 text-sm">Sube un PDF modelo para definir qué campos debe extraer la IA. Puedes detectarlos automáticamente o, en el futuro, dibujarlos.</p>
               </div>
             )}
          </main>
        </div>

        {/* Panel de Gestión de Plantillas Guardadas */}
        <aside className="w-[350px] bg-white p-6 flex flex-col gap-4 overflow-y-auto border-l border-gray-200">
          <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
            <ShieldCheck size={18} className="text-gray-500"/> Plantillas Activas
          </h4>
          <div className="space-y-3">
            {isLoadingTemplates ? <Loader2 className="animate-spin text-gray-400"/> :
             templates.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No hay plantillas guardadas.</p>
            ) : (
              templates.map(t => (
                <div key={t.id} className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between group">
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-gray-800 truncate">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.regions.length} campos</p>
                  </div>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-auto p-4 rounded-lg bg-blue-50 border border-blue-200">
             <div className="flex items-center gap-2 mb-2 text-blue-600">
               <Info size={16}/>
               <span className="text-sm font-semibold">Leyenda</span>
             </div>
             <div className="space-y-2">
               <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                 <span className="text-xs text-gray-600">Box: Casillas (X/Check)</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                 <span className="text-xs text-gray-600">Field: Texto</span>
               </div>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
