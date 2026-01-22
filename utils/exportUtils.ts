// Utilidades para exportar datos a diferentes formatos
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { SchemaField } from '../types.ts';

/**
 * Descarga un texto plano como un archivo PDF.
 * @param text El texto a exportar.
 * @param filename El nombre del archivo (sin extensión).
 */
export const downloadTextAsPDF = (text: string, filename: string) => {
    const pdf = new jsPDF();
    
    // Establecer metadatos
    pdf.setProperties({
        title: `${filename}`,
        subject: 'Transcripción de documento',
        author: 'VerbaDoc Pro',
    });

    // Establecer fuente y tamaño
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    // Dividir el texto en líneas que quepan en la página
    const margin = 15;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const usableWidth = pageWidth - (2 * margin);
    const lines = pdf.splitTextToSize(text, usableWidth);

    // Añadir el texto, manejando saltos de página
    let cursorY = margin;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const lineHeight = pdf.getLineHeight() / pdf.internal.scaleFactor;

    for (let i = 0; i < lines.length; i++) {
        if (cursorY + lineHeight > pageHeight - margin) {
            pdf.addPage();
            cursorY = margin;
        }
        pdf.text(lines[i], margin, cursorY);
        cursorY += lineHeight;
    }

    // Generar y descargar el Blob
    const blob = pdf.output('blob');
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.pdf`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Limpiar URL después de la descarga
    setTimeout(() => URL.revokeObjectURL(url), 100);
};


/**
 * Extrae el orden de campos del schema de forma recursiva
 */
const getFieldOrderFromSchema = (schema: SchemaField[], prefix = ''): string[] => {
    const fields: string[] = [];

    for (const field of schema) {
        const fieldName = prefix ? `${prefix}.${field.name}` : field.name;

        // Si es un objeto con hijos, procesar recursivamente
        if (field.type === 'OBJECT' && field.children) {
            fields.push(...getFieldOrderFromSchema(field.children, fieldName));
        }
        // Si es ARRAY_OF_OBJECTS con hijos, agregar el campo base y sus propiedades
        else if (field.type === 'ARRAY_OF_OBJECTS' && field.children) {
            // Agregar las propiedades del objeto dentro del array
            for (const child of field.children) {
                fields.push(`${fieldName}.${child.name}`);
            }
        }
        // Campo simple
        else {
            fields.push(fieldName);
        }
    }

    return fields;
};

/**
 * Convierte un objeto JSON a PDF y retorna el blob
 */
export const jsonToPDF = (data: object | object[], filename: string, schema?: SchemaField[]): Blob => {
    const pdf = new jsPDF();
    const dataArray = Array.isArray(data) ? data : [data];

    if (dataArray.length === 0) {
        pdf.text('No hay datos para mostrar', 10, 10);
        return pdf.output('blob');
    }

    // Título
    pdf.setFontSize(16);
    pdf.setTextColor(0, 102, 204);
    pdf.text('Resultados de Extracción de Datos', 14, 15);

    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Fecha: ${new Date().toLocaleString('es-ES')}`, 14, 22);
    pdf.text(`Archivo: ${filename}`, 14, 27);

    // Función para aplanar objetos anidados
    const flattenObject = (obj: any, prefix = ''): any => {
        return Object.keys(obj).reduce((acc: any, key: string) => {
            const prefixedKey = prefix ? `${prefix}.${key}` : key;

            if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                Object.assign(acc, flattenObject(obj[key], prefixedKey));
            } else if (Array.isArray(obj[key])) {
                // Verificar si es un array de objetos
                if (obj[key].length > 0 && typeof obj[key][0] === 'object' && obj[key][0] !== null) {
                    // Array de objetos: agrupar por propiedad (PDF usa ; como separador)
                    const allProps = new Set<string>();
                    obj[key].forEach((item: any) => {
                        Object.keys(item).forEach(prop => allProps.add(prop));
                    });

                    allProps.forEach(prop => {
                        const values = obj[key].map((item: any, index: number) => {
                            const value = item[prop];
                            return value !== undefined && value !== null ? `[${index + 1}] ${value}` : '';
                        }).filter(v => v !== '');

                        acc[`${prefixedKey}.${prop}`] = values.join('; ');
                    });
                } else {
                    // Array de primitivos: usar punto y coma
                    acc[prefixedKey] = obj[key].join('; ');
                }
            } else {
                acc[prefixedKey] = obj[key];
            }

            return acc;
        }, {});
    };

    const flattenedData = dataArray.map(item => flattenObject(item));

    // Si tenemos schema, usar su orden; si no, extraer de los datos
    let allColumns: string[];
    if (schema && schema.length > 0) {
        allColumns = getFieldOrderFromSchema(schema);
    } else {
        allColumns = Array.from(
            new Set(flattenedData.flatMap(item => Object.keys(item)))
        );
    }

    // Preparar datos para la tabla
    const tableData = flattenedData.map(item =>
        allColumns.map(col => String(item[col] ?? ''))
    );

    // Crear tabla con autoTable
    autoTable(pdf, {
        head: [allColumns],
        body: tableData,
        startY: 32,
        theme: 'striped',
        headStyles: {
            fillColor: [0, 102, 204],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'left'
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
        },
        alternateRowStyles: {
            fillColor: [240, 240, 240]
        },
        margin: { top: 32, left: 14, right: 14 }
    });

    return pdf.output('blob');
};

/**
 * Convierte un objeto JSON a PDF en formato vertical (campos como filas)
 */
export const jsonToPDFVertical = (data: object | object[], filename: string, schema?: SchemaField[]): Blob => {
    const pdf = new jsPDF();
    const dataArray = Array.isArray(data) ? data : [data];

    if (dataArray.length === 0) {
        pdf.text('No hay datos para mostrar', 10, 10);
        return pdf.output('blob');
    }

    // Título
    pdf.setFontSize(16);
    pdf.setTextColor(0, 102, 204);
    pdf.text('Resultados de Extracción de Datos', 14, 15);

    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Fecha: ${new Date().toLocaleString('es-ES')}`, 14, 22);
    pdf.text(`Documento: ${filename}`, 14, 27);

    // Función para aplanar objetos anidados
    const flattenObject = (obj: any, prefix = ''): any => {
        return Object.keys(obj).reduce((acc: any, key: string) => {
            const prefixedKey = prefix ? `${prefix}.${key}` : key;

            if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                Object.assign(acc, flattenObject(obj[key], prefixedKey));
            } else if (Array.isArray(obj[key])) {
                if (obj[key].length > 0 && typeof obj[key][0] === 'object' && obj[key][0] !== null) {
                    const allProps = new Set<string>();
                    obj[key].forEach((item: any) => {
                        Object.keys(item).forEach(prop => allProps.add(prop));
                    });

                    allProps.forEach(prop => {
                        const values = obj[key].map((item: any, index: number) => {
                            const value = item[prop];
                            return value !== undefined && value !== null ? `[${index + 1}] ${value}` : '';
                        }).filter(v => v !== '');

                        acc[`${prefixedKey}.${prop}`] = values.join('; ');
                    });
                } else {
                    acc[prefixedKey] = obj[key].join('; ');
                }
            } else {
                acc[prefixedKey] = obj[key];
            }

            return acc;
        }, {});
    };

    const flattenedData = dataArray.map(item => flattenObject(item));

    // Si tenemos schema, usar su orden; si no, extraer de los datos
    let allColumns: string[];
    if (schema && schema.length > 0) {
        allColumns = getFieldOrderFromSchema(schema);
    } else {
        allColumns = Array.from(
            new Set(flattenedData.flatMap(item => Object.keys(item)))
        );
    }

    // FORMATO VERTICAL: Cada fila es un campo
    // Columna 1: Nombre del campo
    // Columnas 2-N: Valores de cada registro

    const headers = flattenedData.length === 1
        ? ['Campo', 'Valor']
        : ['Campo', ...flattenedData.map((_, idx) => `Registro ${idx + 1}`)];

    const tableData = allColumns.map(fieldName => {
        const row = [fieldName];
        flattenedData.forEach(item => {
            row.push(String(item[fieldName] ?? ''));
        });
        return row;
    });

    // Crear tabla con autoTable
    autoTable(pdf, {
        head: [headers],
        body: tableData,
        startY: 32,
        theme: 'striped',
        headStyles: {
            fillColor: [0, 102, 204],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'left'
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
        },
        alternateRowStyles: {
            fillColor: [240, 240, 240]
        },
        margin: { top: 32, left: 14, right: 14 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 'auto' }
        }
    });

    return pdf.output('blob');
};

/**
 * Descarga un archivo PDF
 * Por defecto usa formato vertical (campos como filas)
 */
export const downloadPDF = (data: object | object[], filename: string, schema?: SchemaField[], vertical: boolean = true) => {
    const blob = vertical ? jsonToPDFVertical(data, filename, schema) : jsonToPDF(data, filename, schema);
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.pdf`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Genera una URL de objeto para mostrar el PDF en un iframe
 * Por defecto usa formato vertical (campos como filas)
 */
export const generatePDFPreviewURL = (data: object | object[], filename: string, schema?: SchemaField[], vertical: boolean = true): string => {
    const blob = vertical ? jsonToPDFVertical(data, filename, schema) : jsonToPDF(data, filename, schema);
    return URL.createObjectURL(blob);
};

/**
 * Convierte un objeto JSON a CSV
 */
export const jsonToCSV = (data: object | object[], schema?: SchemaField[]): string => {
    // Si es un solo objeto, convertirlo a array
    const dataArray = Array.isArray(data) ? data : [data];

    if (dataArray.length === 0) {
        return '';
    }

    // Función recursiva para aplanar objetos anidados
    const flattenObject = (obj: any, prefix = ''): any => {
        return Object.keys(obj).reduce((acc: any, key: string) => {
            const prefixedKey = prefix ? `${prefix}.${key}` : key;

            if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                Object.assign(acc, flattenObject(obj[key], prefixedKey));
            } else if (Array.isArray(obj[key])) {
                // Verificar si es un array de objetos
                if (obj[key].length > 0 && typeof obj[key][0] === 'object' && obj[key][0] !== null) {
                    // Array de objetos: agrupar por propiedad (CSV usa ; como separador)
                    const allProps = new Set<string>();
                    obj[key].forEach((item: any) => {
                        Object.keys(item).forEach(prop => allProps.add(prop));
                    });

                    allProps.forEach(prop => {
                        const values = obj[key].map((item: any, index: number) => {
                            const value = item[prop];
                            return value !== undefined && value !== null ? `[${index + 1}] ${value}` : '';
                        }).filter(v => v !== '');

                        acc[`${prefixedKey}.${prop}`] = values.join('; ');
                    });
                } else {
                    // Array de primitivos: usar punto y coma
                    acc[prefixedKey] = obj[key].join('; ');
                }
            } else {
                acc[prefixedKey] = obj[key];
            }

            return acc;
        }, {});
    };

    // Aplanar todos los objetos
    const flattenedData = dataArray.map(item => flattenObject(item));

    // Si tenemos schema, usar su orden; si no, extraer de los datos
    let allColumns: string[];
    if (schema && schema.length > 0) {
        allColumns = getFieldOrderFromSchema(schema);
    } else {
        allColumns = Array.from(
            new Set(flattenedData.flatMap(item => Object.keys(item)))
        );
    }

    // Crear encabezados CSV
    const headers = allColumns.map(col => `"${col}"`).join(',');

    // Crear filas CSV
    const rows = flattenedData.map(item => {
        return allColumns.map(col => {
            const value = item[col] ?? '';
            // Escapar comillas y envolver en comillas si contiene comas o saltos de línea
            const stringValue = String(value).replace(/"/g, '""');
            return `"${stringValue}"`;
        }).join(',');
    });

    return [headers, ...rows].join('\n');
};

/**
 * Descarga un archivo CSV
 */
export const downloadCSV = (data: object | object[], filename: string, schema?: SchemaField[]) => {
    const csv = jsonToCSV(data, schema);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Convierte un objeto JSON a Excel usando la librería xlsx (genera archivo .xlsx real)
 * Arrays de objetos se expanden como múltiples filas
 */
export const jsonToExcel = (data: object | object[], schema?: SchemaField[]): Blob => {
    const dataArray = Array.isArray(data) ? data : [data];

    if (dataArray.length === 0) {
        // Crear libro vacío
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([['No hay datos']]);
        XLSX.utils.book_append_sheet(wb, ws, 'Datos Extraídos');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // Función para expandir arrays de objetos en múltiples filas
    const expandArrays = (obj: any, prefix = ''): any[] => {
        // Primero, identificar el array de objetos más largo
        let maxArrayLength = 1;
        const arrayFields: { [key: string]: any[] } = {};
        const scalarFields: { [key: string]: any } = {};

        const processObject = (o: any, p = '') => {
            Object.keys(o).forEach(key => {
                const prefixedKey = p ? `${p}.${key}` : key;
                const value = o[key];

                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    // Objeto anidado: procesar recursivamente
                    processObject(value, prefixedKey);
                } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                    // Array de objetos: guardar para expandir
                    arrayFields[prefixedKey] = value;
                    maxArrayLength = Math.max(maxArrayLength, value.length);
                } else if (Array.isArray(value)) {
                    // Array de primitivos: unir
                    scalarFields[prefixedKey] = value.join('\n');
                } else {
                    // Campo escalar
                    scalarFields[prefixedKey] = value;
                }
            });
        };

        processObject(obj);

        // Generar filas
        const rows: any[] = [];
        for (let i = 0; i < maxArrayLength; i++) {
            const row: any = { ...scalarFields };

            // Para cada array de objetos, tomar el elemento en la posición i
            Object.entries(arrayFields).forEach(([arrayKey, arrayValue]) => {
                const item = arrayValue[i];
                if (item) {
                    // Expandir propiedades del objeto
                    Object.entries(item).forEach(([propKey, propValue]) => {
                        row[`${arrayKey}.${propKey}`] = propValue;
                    });
                } else {
                    // Si este array es más corto, dejar vacío
                    // Obtener propiedades del primer elemento para saber qué columnas crear
                    if (arrayValue[0]) {
                        Object.keys(arrayValue[0]).forEach(propKey => {
                            row[`${arrayKey}.${propKey}`] = '';
                        });
                    }
                }
            });

            rows.push(row);
        }

        return rows;
    };

    // Expandir cada objeto a múltiples filas si tiene arrays
    const allRows = dataArray.flatMap(item => expandArrays(item));

    // Si tenemos schema, usar su orden; si no, extraer de los datos
    let allColumns: string[];
    if (schema && schema.length > 0) {
        allColumns = getFieldOrderFromSchema(schema);
    } else {
        allColumns = Array.from(
            new Set(allRows.flatMap(row => Object.keys(row)))
        );
    }

    // Crear array de arrays para xlsx (mantiene orden)
    const worksheetData = [
        allColumns, // Headers
        ...allRows.map(row =>
            allColumns.map(col => row[col] ?? '')
        )
    ];

    // Crear libro y hoja de trabajo
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Configurar ancho de columnas (auto-ajustar)
    const colWidths = allColumns.map(col => ({
        wch: Math.max(col.length, 15) // Mínimo 15 caracteres
    }));
    ws['!cols'] = colWidths;

    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, 'Datos Extraídos');

    // Generar archivo Excel como buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // Retornar como Blob
    return new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
};

/**
 * Convierte un objeto JSON a Excel en formato transpuesto/pivotado
 * Los campos se muestran como filas (de arriba a abajo) y los registros como columnas
 */
export const jsonToExcelTransposed = (data: object | object[], schema?: SchemaField[]): Blob => {
    const dataArray = Array.isArray(data) ? data : [data];

    if (dataArray.length === 0) {
        // Crear libro vacío
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([['No hay datos']]);
        XLSX.utils.book_append_sheet(wb, ws, 'Datos Extraídos');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // Función para expandir arrays de objetos en múltiples filas
    const expandArrays = (obj: any, prefix = ''): any[] => {
        let maxArrayLength = 1;
        const arrayFields: { [key: string]: any[] } = {};
        const scalarFields: { [key: string]: any } = {};

        const processObject = (o: any, p = '') => {
            Object.keys(o).forEach(key => {
                const prefixedKey = p ? `${p}.${key}` : key;
                const value = o[key];

                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    processObject(value, prefixedKey);
                } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                    arrayFields[prefixedKey] = value;
                    maxArrayLength = Math.max(maxArrayLength, value.length);
                } else if (Array.isArray(value)) {
                    scalarFields[prefixedKey] = value.join('\n');
                } else {
                    scalarFields[prefixedKey] = value;
                }
            });
        };

        processObject(obj);

        const rows: any[] = [];
        for (let i = 0; i < maxArrayLength; i++) {
            const row: any = { ...scalarFields };

            Object.entries(arrayFields).forEach(([arrayKey, arrayValue]) => {
                const item = arrayValue[i];
                if (item) {
                    Object.entries(item).forEach(([propKey, propValue]) => {
                        row[`${arrayKey}.${propKey}`] = propValue;
                    });
                } else {
                    if (arrayValue[0]) {
                        Object.keys(arrayValue[0]).forEach(propKey => {
                            row[`${arrayKey}.${propKey}`] = '';
                        });
                    }
                }
            });

            rows.push(row);
        }

        return rows;
    };

    // Expandir cada objeto a múltiples filas si tiene arrays
    const allRows = dataArray.flatMap(item => expandArrays(item));

    // Obtener todas las columnas (campos)
    let allColumns: string[];
    if (schema && schema.length > 0) {
        allColumns = getFieldOrderFromSchema(schema);
    } else {
        allColumns = Array.from(
            new Set(allRows.flatMap(row => Object.keys(row)))
        );
    }

    // Crear datos transpuestos
    // Fila de encabezado: "Campo" + "Registro 1", "Registro 2", etc.
    const headers = ['Campo', ...allRows.map((_, idx) => `Registro ${idx + 1}`)];

    // Cada fila subsiguiente representa un campo
    const transposedData = [headers];

    allColumns.forEach(column => {
        const row = [column]; // Primera celda es el nombre del campo
        allRows.forEach(dataRow => {
            row.push(dataRow[column] ?? '');
        });
        transposedData.push(row);
    });

    // Crear libro y hoja de trabajo
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(transposedData);

    // Configurar ancho de columnas
    const colWidths = [
        { wch: Math.max(...allColumns.map(c => c.length), 15) }, // Columna de campos
        ...allRows.map(() => ({ wch: 20 })) // Columnas de registros
    ];
    ws['!cols'] = colWidths;

    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, 'Datos Extraídos');

    // Generar archivo Excel como buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // Retornar como Blob
    return new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
};

/**
 * Descarga un archivo Excel (.xlsx real)
 * @param transposed - Si es true, exporta en formato transpuesto (campos como filas)
 */
export const downloadExcel = (data: object | object[], filename: string, schema?: SchemaField[], transposed: boolean = false) => {
    const blob = transposed ? jsonToExcelTransposed(data, schema) : jsonToExcel(data, schema);
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xlsx`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Limpiar URL después de la descarga
    setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Descarga datos en formato JSON
 */
export const downloadJSON = (data: object | object[], filename: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};