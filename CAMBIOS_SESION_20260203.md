# Cambios Realizados - Sesión 03/02/2026

## Resumen Ejecutivo

Esta sesión se enfocó en mejorar el sistema de plantillas y control de acceso por empresa en VerbadocPro.

---

## 1. Corrección de Cabecera de Usuario

### Problema
El texto mostraba: `"Trabajando para: Normadat por [nombre]"` incluso cuando el usuario no tenía empresa asignada.

### Solución
Simplificado a mostrar solo:
- **Si hay empresa** → Nombre de la empresa
- **Si no hay empresa** → Nombre del usuario

### Archivos modificados
- `App.tsx` (líneas 1319 y 1492)

### Código anterior
```jsx
trabajando para: {user?.company_name || 'Normadat'} por {user?.name || user?.email}
```

### Código nuevo
```jsx
{user?.company_name || user?.name || user?.email}
```

---

## 2. Nueva Plantilla FUNDAE_BASICA

### Descripción
Plantilla simplificada con solo 3 campos para validación contra Excel del cliente.

### Campos incluidos
| # | Campo | Descripción |
|---|-------|-------------|
| 1 | `numero_expediente` | Formato F24XXXX |
| 4 | `numero_accion` | Número 1-4 dígitos |
| 5 | `numero_grupo` | Número 1-4 dígitos |

### Archivos creados
- `src/constants/fundae-basica-template.ts`

### Uso
Esta plantilla se valida contra el archivo Excel `SS339586_Final_v2` en la gestión de Excel del admin.

---

## 3. Sistema de Control de Acceso por Empresa

### Problema anterior
- Las plantillas usaban `subscription: 'premium'` que no existía en la BD
- Todos los usuarios veían todas las plantillas
- No había filtrado por empresa/cliente

### Nueva lógica

#### Campo `clienteEmpresa` en plantillas
```typescript
{
    id: 'fundae-oficial-2024',
    name: 'FUNDAE - Cuestionario Oficial',
    clienteEmpresa: 'normadat', // ← Solo usuarios de Normadat
    // ...
}
```

#### Función `canViewTemplate`
```typescript
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
    
    return true;
};
```

### Resultado
| Usuario | company_name | ¿Ve FUNDAE? |
|---------|--------------|-------------|
| Admin | (cualquiera) | ✅ Siempre |
| User/Reviewer | Normadat | ✅ Sí |
| User/Reviewer | Otra empresa | ❌ No |

---

## 4. Migración de Plantillas: localStorage → Base de Datos

### Problema anterior
- Plantillas guardadas en `localStorage` del navegador
- No persistían entre dispositivos
- No se compartían entre usuarios de la misma empresa
- Cualquier usuario podía ver plantillas de otros

### Solución implementada

#### API `/api/templates` (ya existía)
| Método | Función |
|--------|---------|
| GET | Lista plantillas del usuario o de su `client_id` |
| POST | Crea plantilla con `user_id` y `client_id` |
| PATCH | Activa/desactiva plantilla |
| DELETE | Elimina plantilla |

#### Cambios en `TemplatesPanel.tsx`

**Carga de plantillas:**
```typescript
// ANTES (localStorage)
const stored = localStorage.getItem('customTemplates_europa');

// AHORA (API)
const response = await fetch('/api/templates', { credentials: 'include' });
const templates = await response.json();
```

**Guardar plantilla:**
```typescript
// ANTES
localStorage.setItem('customTemplates_europa', JSON.stringify(templates));

// AHORA
await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, description, regions, prompt }),
});
```

### Tabla de BD utilizada
```sql
CREATE TABLE form_templates (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,      -- Quién creó la plantilla
  client_id INTEGER,          -- Para compartir entre usuarios de la misma empresa
  name VARCHAR(255),
  description TEXT,
  regions JSONB,              -- Campos/schema de la plantilla
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 5. Sección "Mis Modelos" Mejorada

### Estructura visual nueva
```
📁 Mis Modelos
   │
   ├── 📋 Plantillas de tu empresa:
   │   ├── FUNDAE - Cuestionario Oficial
   │   └── FUNDAE BÁSICA - Validación Excel
   │
   └── 🔧 Tus plantillas:
       └── (plantillas personalizadas del usuario)
```

### Separación clara
- **Plantillas del cliente**: Predefinidas, no editables, filtradas por `clienteEmpresa`
- **Plantillas personalizadas**: Creadas por el usuario, editables, guardadas en BD

---

## Commits Realizados

### Commit 1: `9284513`
```
feat: simplificar cabecera usuario + añadir plantilla FUNDAE_BASICA

- Cambiar texto cabecera: mostrar solo empresa o nombre usuario
- Nueva plantilla FUNDAE_BASICA con 3 campos para validación Excel
```

### Commit 2: `e1ba6b3`
```
feat: plantillas filtradas por empresa + guardar en BD

- Control de acceso por empresa (clienteEmpresa)
- Plantillas guardadas en BD via API (no localStorage)
- Filtrado automático por client_id
- Sección "Mis Modelos" mejorada
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `App.tsx` | Simplificado texto cabecera usuario |
| `src/constants/fundae-basica-template.ts` | **NUEVO** - Plantilla FUNDAE_BASICA |
| `components/TemplatesPanel.tsx` | Control acceso por empresa, API en vez de localStorage |

---

## Próximos Pasos Sugeridos

1. **Verificar deploy en Vercel** - Los cambios deberían desplegarse automáticamente
2. **Probar con usuario de Normadat** - Verificar que ve las plantillas FUNDAE
3. **Probar con usuario de otra empresa** - Verificar que NO ve las plantillas FUNDAE
4. **Crear plantillas para otros clientes** - Añadir `clienteEmpresa: 'nombre_cliente'`

---

## Notas Técnicas

- El campo `subscription` sigue sin existir en la BD (no se implementó)
- El control de acceso es únicamente por `company_name` vs `clienteEmpresa`
- Los admin siempre ven todas las plantillas
- Las plantillas predefinidas del cliente aparecen en "Mis Modelos", no en "Plantillas Predefinidas"
