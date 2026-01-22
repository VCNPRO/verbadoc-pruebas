# Resumen de Análisis de Riesgos y Gestión de Seguridad (ENS Nivel Alto)

**Proyecto:** Verbadoc Pro Enterprise  
**Fecha:** 19/01/2026  
**Metodología:** MAGERIT v3 (Esquema Nacional de Seguridad)

## 1. Mapa de Riesgos Clave

A continuación, se detallan los riesgos críticos identificados para la plataforma y las medidas de seguridad efectivas implementadas para su mitigación.

### Riesgo 1: Acceso no autorizado a transcripciones confidenciales
*   **Descripción:** Un atacante externo o interno accede a documentos sensibles procesados por la plataforma.
*   **Probabilidad:** Baja | **Impacto:** Muy Alto.
*   **Medida de Mitigación (Salvaguarda):** **[IAM-01] Autenticación Multifactor (MFA)** y gestión de identidades robusta. Se fuerza la autenticación segura para todos los accesos administrativos y de usuario final, impidiendo el acceso mediante credenciales comprometidas.

### Riesgo 2: Indisponibilidad del servicio de Inteligencia Artificial
*   **Descripción:** Interrupción del servicio que impide el procesamiento de nuevos documentos debido a fallos en la infraestructura o pérdida de datos.
*   **Probabilidad:** Media | **Impacto:** Alto.
*   **Medida de Mitigación (Salvaguarda):** **[REC-01] Backups Automáticos en Google Cloud.** Estrategia de recuperación ante desastres con RPO de 24h. Las copias de seguridad distribuidas permiten restaurar la operatividad en caso de corrupción de datos o fallo crítico del proveedor.

### Riesgo 3: Inyección de código malicioso en el front-end (XSS)
*   **Descripción:** Inyección de scripts malignos en el navegador del usuario para robar sesiones o datos.
*   **Probabilidad:** Media | **Impacto:** Alto.
*   **Medida de Mitigación (Salvaguarda):** **[SEC-02] Content Security Policy (CSP) Estricta en Vercel.** Configuración de cabeceras HTTP que restringen la ejecución de scripts únicamente a dominios de confianza (whitelist), bloqueando cualquier intento de inyección de código no autorizado.

### Riesgo 4: Borrado accidental o intencionado de logs de auditoría
*   **Descripción:** Eliminación de las trazas de actividad para ocultar acciones maliciosas o por error humano.
*   **Probabilidad:** Baja | **Impacto:** Muy Alto (Incumplimiento Legal).
*   **Medida de Mitigación (Salvaguarda):** **[AUD-01] Logs Inmutables (Retention Locked).** Almacenamiento de logs en Google Cloud Storage con política de retención bloqueada por 365 días. Esta configuración técnica hace imposible la modificación o eliminación de los registros, incluso para los administradores del sistema.

## 2. Conclusión del Auditor
Las salvaguardas técnicas implementadas reducen el riesgo residual a un nivel **ACEPTABLE**, cumpliendo con los requisitos de trazabilidad, disponibilidad e integridad exigidos por el ENS.
