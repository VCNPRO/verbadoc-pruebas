import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './src/index.css';
import './src/i18n';
import App from './App.tsx';
import { AuthProvider } from './src/contexts/AuthContext.tsx';
import { LanguageProvider } from './src/contexts/LanguageContext.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("No se pudo encontrar el elemento raíz para montar la aplicación");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">Cargando...</p>
              </div>
            </div>
          }>
            <App />
          </Suspense>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
