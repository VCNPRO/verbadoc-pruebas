import React from 'react';
// Fix: Use explicit file extension in import.
import type { SchemaField, SchemaFieldType } from '../types.ts';
import { PlusIcon, TrashIcon } from './Icons.tsx';

interface SchemaBuilderProps {
  schema: SchemaField[];
  setSchema: React.Dispatch<React.SetStateAction<SchemaField[]>>;
  theme?: any;
  isLightMode?: boolean;
}

const fieldTypes: SchemaFieldType[] = ['STRING', 'NUMBER', 'BOOLEAN', 'ARRAY_OF_STRINGS', 'OBJECT', 'ARRAY_OF_OBJECTS'];

const validateFieldName = (name: string): string | undefined => {
  if (!name.trim()) {
    return 'El nombre del campo no puede estar vacío.';
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return 'Nombre inválido. Use solo letras, números y guiones bajos, comenzando con una letra o guion bajo.';
  }
  return undefined;
};

// Recursive function to apply updates to the nested schema structure
const updateSchemaByPath = (
    schema: SchemaField[],
    path: string[],
    updateFn: (field: SchemaField) => SchemaField, // For updates on the field itself
    childrenUpdateFn?: (children: SchemaField[]) => SchemaField[] // For add/remove on a children array
): SchemaField[] => {
    const [currentId, ...restPath] = path;

    if (!currentId) {
        return childrenUpdateFn ? childrenUpdateFn(schema) : schema;
    }

    return schema.map(field => {
        if (field.id === currentId) {
            if (restPath.length > 0) {
                const newChildren = updateSchemaByPath(field.children || [], restPath, updateFn, childrenUpdateFn);
                return { ...field, children: newChildren };
            }
            if (childrenUpdateFn && (field.type === 'OBJECT' || field.type === 'ARRAY_OF_OBJECTS')) {
                return { ...field, children: childrenUpdateFn(field.children || []) };
            } else {
                return updateFn(field);
            }
        }
        return field;
    });
};

const SchemaFieldRow: React.FC<{
    field: SchemaField;
    path: string[];
    onUpdate: (path: string[], newField: Partial<SchemaField>) => void;
    onRemove: (path: string[]) => void;
    onAddChild: (path: string[]) => void;
    isRoot: boolean;
    schemaLength: number;
    theme?: any;
    isLightMode?: boolean;
}> = ({ field, path, onUpdate, onRemove, onAddChild, isRoot, schemaLength, theme, isLightMode }) => {
    const isNestedType = field.type === 'OBJECT' || field.type === 'ARRAY_OF_OBJECTS';
    const textColor = isLightMode ? '#1e3a8a' : '#f1f5f9';
    const bgColor = isLightMode ? '#f9fafb' : '#1e293b';
    const borderColor = isLightMode ? '#dbeafe' : '#475569';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';
    const rowBg = isLightMode ? '#eff6ff' : 'rgba(51, 65, 85, 0.3)';

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        const validationError = validateFieldName(newName);
        onUpdate(path, { name: newName, error: validationError });
    };

    return (
        <div className="flex flex-col gap-1.5">
            <div
                className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center p-2 rounded border"
                style={{
                    backgroundColor: rowBg,
                    borderColor: field.error ? '#ef4444' : borderColor
                }}
            >
                 <input
                    type="text"
                    value={field.name}
                    onChange={handleNameChange}
                    placeholder="nombre_campo"
                    className="w-full rounded px-2 py-1.5 focus:outline-none focus:ring-1 transition-all text-sm"
                    style={{
                        backgroundColor: bgColor,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: field.error ? '#ef4444' : borderColor,
                        color: textColor,
                        focusRingColor: accentColor
                    }}
                />
                <div className="flex items-center gap-2">
                    <select
                        value={field.type}
                        onChange={(e) => onUpdate(path, { type: e.target.value as SchemaFieldType })}
                        className="flex-1 rounded px-2 py-1.5 focus:outline-none focus:ring-1 transition-all text-sm appearance-none"
                        style={{
                            backgroundColor: bgColor,
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: borderColor,
                            color: textColor,
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='${isLightMode ? '#1e3a8a' : '%239ca3af'}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: 'right 0.3rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.2em 1.2em',
                            paddingRight: '2rem',
                        }}
                    >
                        {fieldTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => onRemove(path)}
                        className="p-1.5 rounded transition-colors disabled:opacity-50 hover:bg-opacity-80"
                        style={{
                            color: isLightMode ? '#ef4444' : '#f87171',
                            backgroundColor: isLightMode ? '#fee2e2' : 'rgba(239, 68, 68, 0.1)'
                        }}
                        disabled={isRoot && schemaLength <= 1}
                        aria-label="Eliminar campo"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            {field.error && <p className="text-xs text-red-400 px-1">{field.error}</p>}

            {isNestedType && field.children && (
                <div
                    className="ml-4 pl-3 border-l-2 space-y-2 pt-1"
                    style={{ borderLeftColor: isLightMode ? '#93c5fd' : '#475569' }}
                >
                    {field.children.map(childField => (
                         <SchemaFieldRow
                            key={childField.id}
                            field={childField}
                            path={[...path, childField.id]}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                            onAddChild={onAddChild}
                            isRoot={false}
                            schemaLength={field.children?.length ?? 0}
                            theme={theme}
                            isLightMode={isLightMode}
                        />
                    ))}
                     <button
                        onClick={() => onAddChild(path)}
                        className="flex items-center gap-1.5 font-medium py-1 px-2 rounded transition-colors text-xs hover:opacity-80"
                        style={{
                            color: accentColor,
                            backgroundColor: isLightMode ? '#dbeafe' : 'rgba(51, 65, 85, 0.5)'
                        }}
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Sub-Campo
                    </button>
                </div>
            )}
        </div>
    );
};

export const SchemaBuilder: React.FC<SchemaBuilderProps> = ({ schema, setSchema, theme, isLightMode }) => {
  const accentColor = isLightMode ? '#2563eb' : '#06b6d4';

  const handleUpdate = (path: string[], payload: Partial<SchemaField>) => {
    const updater = (field: SchemaField): SchemaField => {
        const updatedField = { ...field, ...payload };
        if ((updatedField.type === 'OBJECT' || updatedField.type === 'ARRAY_OF_OBJECTS') && !updatedField.children) {
            updatedField.children = [{ id: `field-${Date.now()}`, name: '', type: 'STRING' }];
        }
        if (field.type !== updatedField.type && (field.type === 'OBJECT' || field.type === 'ARRAY_OF_OBJECTS')) {
            delete updatedField.children;
        }
        return updatedField;
    };
    setSchema(currentSchema => updateSchemaByPath(currentSchema, path, updater));
  };

  const handleRemove = (path: string[]) => {
    const parentPath = path.slice(0, -1);
    const childIdToRemove = path[path.length - 1];
    const childrenUpdater = (children: SchemaField[]) => children.filter(f => f.id !== childIdToRemove);
    setSchema(currentSchema => updateSchemaByPath(currentSchema, parentPath, f => f, childrenUpdater));
  };

  const handleAddChild = (path: string[]) => {
    const newField: SchemaField = { id: `field-${Date.now()}`, name: '', type: 'STRING' };
    const childrenUpdater = (children: SchemaField[]) => [...children, newField];
    setSchema(currentSchema => updateSchemaByPath(currentSchema, path, f => f, childrenUpdater));
  };

  const addRootField = () => {
    setSchema([...schema, { id: `field-${Date.now()}`, name: '', type: 'STRING' }]);
  };


  return (
    <div className="space-y-2">
      {schema.map(field => (
        <SchemaFieldRow
            key={field.id}
            field={field}
            path={[field.id]}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            onAddChild={handleAddChild}
            isRoot={true}
            schemaLength={schema.length}
            theme={theme}
            isLightMode={isLightMode}
        />
      ))}
      <button
        onClick={addRootField}
        className="flex items-center gap-1.5 font-medium py-1.5 px-3 rounded transition-colors text-sm hover:opacity-80"
        style={{
          color: accentColor,
          backgroundColor: isLightMode ? '#dbeafe' : 'rgba(51, 65, 85, 0.5)'
        }}
      >
        <PlusIcon className="w-4 h-4" />
        Añadir Campo
      </button>
    </div>
  );
};