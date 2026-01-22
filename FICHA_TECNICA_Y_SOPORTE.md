# Ficha Técnica de Infraestructura y Acuerdo de Nivel de Servicio (SLA)

**Producto:** Verbadoc Pro Enterprise  
**Versión del Documento:** 1.2  
**Fecha de Emisión:** 19/01/2026  
**Clasificación de Seguridad:** Confidencial / ENS Nivel Alto

---

## 1. Arquitectura e Infraestructura Tecnológica

Verbadoc Pro opera sobre una arquitectura *Serverless* de alta disponibilidad, distribuida geográficamente en la Unión Europea para garantizar la soberanía del dato y el cumplimiento del RGPD.

### 1.1. Componentes Principales
*   **Front-end & Edge Computing:** Alojado en **Vercel**, utilizando su red global (Edge Network) para la entrega de contenido estático y funciones *serverless*. Certificación SOC 2 Type II e ISO 27001.
*   **Procesamiento de IA:** Motor cognitivo basado en **Google Cloud Vertex AI** (Gemini Models). Los datos son procesados en memoria y no se utilizan para re-entrenar modelos públicos (política *Zero-Retention* para inferencia).
*   **Base de Datos:** PostgreSQL gestionado por **Neon Tech** sobre infraestructura AWS (Región Frankfurt/Madrid). Cifrado nativo en reposo.
*   **Almacenamiento y Auditoría:** **Google Cloud Storage** para documentos y logs. Configuración de "WORM" (Write Once, Read Many) para garantizar la inmutabilidad de la traza de auditoría.

### 1.2. Medidas de Seguridad Aplicadas
*   **Cifrado:**
    *   **En Tránsito:** TLS 1.3 forzado mediante HSTS (*Strict-Transport-Security*).
    *   **En Reposo:** Algoritmo AES-256 para bases de datos y buckets de almacenamiento.
*   **Defensa Perimetral:**
    *   **WAF & CSP:** Política de Seguridad de Contenido estricta para mitigar XSS e inyecciones.
    *   **DDoS Protection:** Mitigación automática de ataques de denegación de servicio en capa 3/4 y 7.

---

## 2. Plan de Soporte y Mantenimiento

### 2.1. Canales de Soporte
El servicio de soporte técnico está disponible para incidencias, consultas y peticiones de servicio a través de:
*   **Portal de Cliente:** https://support.verbadocpro.eu
*   **Correo Electrónico:** soporte@verbadocpro.eu
*   **Horario de Atención:** Lunes a Viernes, 09:00 - 18:00 (CET). *Soporte 24/7 disponible para incidencias de Severidad 1.*

### 2.2. Niveles de Severidad y Tiempos de Respuesta
Los Acuerdos de Nivel de Servicio (SLA) para la respuesta y resolución de incidencias se definen a continuación:

| Severidad | Descripción | Tiempo de Respuesta (TTR) | Objetivo de Resolución |
| :--- | :--- | :--- | :--- |
| **S1 - Crítica** | Caída total del servicio o pérdida de datos. La producción está detenida. | < 1 Hora (24/7) | < 4 Horas |
| **S2 - Alta** | Degradación severa del rendimiento o fallo de funciones críticas (ej. exportación masiva). | < 4 Horas | < 1 Día Laborable |
| **S3 - Normal** | Errores menores que no impiden la operativa principal, dudas funcionales. | < 8 Horas | < 3 Días Laborables |
| **S4 - Baja** | Peticiones cosméticas o sugerencias de mejora. | < 24 Horas | Según Roadmap |

### 2.3. Continuidad de Negocio (Disaster Recovery)
En cumplimiento con el Esquema Nacional de Seguridad (ENS), se garantizan los siguientes parámetros de recuperación:

*   **RPO (Recovery Point Objective):** **24 Horas**. Garantizamos que, ante un desastre catastrófico, la pérdida máxima de datos nunca superará las últimas 24 horas.
*   **RTO (Recovery Time Objective):** **4 Horas**. Tiempo máximo comprometido para restaurar el servicio operativo tras una incidencia crítica.

---

## 3. Matriz de Responsabilidades

| Responsabilidad | Verbadoc Pro (Proveedor) | Cliente |
| :--- | :--- | :--- |
| Seguridad Física de Centros de Datos | ✅ (Vía Proveedores Cloud) | ❌ |
| Parcheado de SO y Red | ✅ (Serverless) | ❌ |
| Seguridad de la Aplicación (Código) | ✅ | ❌ |
| Gestión de Accesos (Usuarios/Passwords) | ❌ | ✅ |
| Clasificación de la Información subida | ❌ | ✅ |
| Auditoría de Logs de Acceso | ✅ (Provisión) | ✅ (Revisión) |

---
*Este documento forma parte contractual del Acuerdo Maestro de Servicios (MSA) de Verbadoc Pro.*
