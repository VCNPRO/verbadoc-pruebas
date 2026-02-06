/**
 * ExcelManagementPanel.tsx
 *
 * Panel de administración Excel (simplificado)
 * Las funcionalidades legacy de validación, plantilla y ciudades han sido eliminadas.
 */

import React from 'react';

export function ExcelManagementPanel() {
  return (
    <div className="p-6 space-y-8 bg-gray-900 text-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestión de Archivos Excel</h1>
        <p className="text-gray-400">
          Panel de administración de configuraciones Excel
        </p>
      </div>

      <div className="p-8 bg-gray-800 rounded-lg border border-gray-700 text-center">
        <p className="text-gray-400">
          No hay configuraciones Excel activas.
        </p>
      </div>
    </div>
  );
}

export default ExcelManagementPanel;
