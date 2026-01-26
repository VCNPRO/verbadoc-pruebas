
export interface Region {
  id: string;
  label: string;
  type: 'text' | 'box' | 'field';
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex?: number;
  isAnchor?: boolean;
  extractedValue?: string;
  isProcessing?: boolean;
}

export interface FormTemplate {
  id: string;
  name: string;
  regions: Region[];
  thumbnail?: string;
}

export interface BatchItem {
  id: string;
  file: File;
  previewUrl?: string;
  status: 'pending' | 'classifying' | 'calibrating' | 'extracting' | 'completed' | 'error';
  detectedTemplateId?: string;
  results?: Region[];
  progress: number;
}

export interface DocumentState {
  file: File | null;
  previewUrl: string | null;
  regions: Region[];
  detectedElements: Region[];
  isGlobalProcessing: boolean;
  isAnalyzing: boolean;
  templates: FormTemplate[];
  batch: BatchItem[];
}
