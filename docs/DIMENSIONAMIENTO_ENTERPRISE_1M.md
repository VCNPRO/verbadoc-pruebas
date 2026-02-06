# VerbaDoc Pro - Dimensionamiento Enterprise
## Escenario: 1M Documentos | 50 Empresas | 200 Usuarios | Alta Concurrencia

**Fecha:** Febrero 2026
**Version:** 1.0
**Clasificación:** Confidencial

---

## 1. RESUMEN DEL ESCENARIO

| Parámetro | Valor |
|-----------|-------|
| Documentos totales | 1.000.000 páginas |
| Empresas (tenants) | 50 |
| Usuarios totales | 200 |
| Concurrencia pico | 70% = 140 usuarios simultáneos |
| Operaciones simultáneas | Consultas NLQ + Subidas de documentos |
| SLA objetivo | 99.9% uptime |

---

## 2. ARQUITECTURA ACTUAL vs REQUERIDA

### 2.1 Arquitectura Actual (Limitaciones)

| Componente | Actual | Límite |
|------------|--------|--------|
| Vercel Serverless | Pro ($20/mes) | 40h CPU/mes, timeout 60s |
| Neon PostgreSQL | Scale ($69/mes) | 750 compute-hours, 50GB |
| Vercel Blob | Pay-as-you-go | Sin límite pero costoso a escala |
| pgvector | En Neon | ~100K vectores eficientes |

**Problemas para 1M docs:**
- Serverless timeout insuficiente para ingestas masivas
- pgvector en Neon se degrada >500K vectores
- Sin redundancia geográfica
- Sin colas de procesamiento
- Sin caché distribuida

### 2.2 Arquitectura Requerida

```
                    ┌─────────────────────────────────────────────────┐
                    │              CDN / WAF (Cloudflare)              │
                    │         DDoS Protection + Edge Caching           │
                    └─────────────────┬───────────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────────────────┐
                    │           Load Balancer (Multi-region)           │
                    │              Auto-scaling Groups                 │
                    └─────────────────┬───────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
    ┌─────▼─────┐              ┌──────▼──────┐             ┌──────▼──────┐
    │ API Server│              │ API Server  │             │ API Server  │
    │  (Pod 1)  │              │  (Pod 2)    │             │  (Pod N)    │
    │  4 vCPU   │              │  4 vCPU     │             │  4 vCPU     │
    │  8GB RAM  │              │  8GB RAM    │             │  8GB RAM    │
    └─────┬─────┘              └──────┬──────┘             └──────┬──────┘
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      │
     ┌────────────────────────────────┼────────────────────────────────┐
     │                                │                                │
┌────▼────┐    ┌─────────────┐   ┌────▼────┐   ┌─────────────┐   ┌────▼────┐
│  Redis  │    │   Message   │   │PostgreSQL│   │   Vector    │   │  Blob   │
│ Cluster │    │    Queue    │   │ Primary  │   │  Database   │   │ Storage │
│ (Cache) │    │  (Bull/SQS) │   │ +Replica │   │  (Qdrant)   │   │  (S3)   │
└─────────┘    └─────────────┘   └──────────┘   └─────────────┘   └─────────┘
```

---

## 3. DIMENSIONAMIENTO POR COMPONENTE

### 3.1 Base de Datos Principal (PostgreSQL)

**Cálculo de almacenamiento:**

| Dato | Tamaño Estimado |
|------|-----------------|
| 1M documentos metadata | ~10 GB |
| extracted_data (JSON) | ~50 GB |
| Índices | ~20 GB |
| Auditoría/logs | ~10 GB |
| **Total PostgreSQL** | **~100 GB** |

**Configuración recomendada:**

| Parámetro | Valor |
|-----------|-------|
| Proveedor | Neon Scale o AWS RDS |
| vCPU | 4-8 |
| RAM | 16-32 GB |
| Storage | 200 GB SSD (margen 2x) |
| IOPS | 3000+ |
| Conexiones | 200+ pooled |
| Réplicas | 1 read replica mínimo |

**Coste mensual:** €150-400/mes (Neon Enterprise o RDS)

### 3.2 Base de Datos Vectorial (Embeddings)

**Cálculo de vectores:**

| Parámetro | Valor |
|-----------|-------|
| Documentos | 1.000.000 páginas |
| Chunks por página | ~2 (500 palabras/chunk) |
| Total chunks | 2.000.000 |
| Dimensiones embedding | 768 (Gemini) |
| Bytes por vector | 768 × 4 = 3.072 bytes |
| **Almacenamiento vectores** | **~6 GB** |
| Con índices HNSW | **~18 GB** |

**Opciones:**

| Opción | Configuración | Coste/mes |
|--------|---------------|-----------|
| **pgvector en Neon** | Scale plan | €69 (límite ~500K vectores eficientes) |
| **Qdrant Cloud** | 8GB RAM, 20GB disk | €100-200 |
| **Pinecone** | Standard, 2M vectores | €150-300 |
| **Qdrant Self-hosted** | 16GB RAM VPS | €80-150 |

**Recomendación:** Qdrant Cloud (mejor rendimiento para >500K vectores)

### 3.3 Almacenamiento de Documentos (Blob)

**Cálculo:**

| Parámetro | Valor |
|-----------|-------|
| Documentos | 1.000.000 páginas |
| Tamaño medio página | 500 KB (PDF) / 2 MB (imagen) |
| Mix 70% PDF, 30% imagen | ~1 MB/página promedio |
| **Total storage** | **~1 TB** |

**Opciones:**

| Proveedor | Coste Storage | Coste Egress |
|-----------|---------------|--------------|
| Vercel Blob | €23/TB/mes | €0.05/GB |
| AWS S3 | €23/TB/mes | €0.09/GB |
| Cloudflare R2 | €15/TB/mes | **GRATIS** |

**Recomendación:** Cloudflare R2 (egress gratis = ahorro significativo)

**Coste mensual:** €15-25/mes (storage) + €0-50/mes (egress)

### 3.4 Servidores de Aplicación

**Cálculo de carga:**

| Métrica | Valor |
|---------|-------|
| Usuarios concurrentes | 140 |
| Consultas NLQ/min pico | ~50 (1 cada 3 seg por usuario activo) |
| Ingestas/min pico | ~20 documentos |
| Tiempo respuesta NLQ | 2-5 segundos |

**Configuración Kubernetes/Cloud Run:**

| Parámetro | Valor |
|-----------|-------|
| Pods mínimos | 3 |
| Pods máximos (auto-scale) | 10 |
| CPU por pod | 2-4 vCPU |
| RAM por pod | 4-8 GB |
| Requests/pod | 50-100 concurrentes |

**Opciones:**

| Plataforma | Configuración | Coste/mes |
|------------|---------------|-----------|
| Vercel Pro | Limitado, no recomendado | €20 + overages |
| **Vercel Enterprise** | Custom limits | €500-1000 |
| **Railway** | 3-5 instances | €100-200 |
| **Google Cloud Run** | Auto-scale | €150-300 |
| **AWS ECS/Fargate** | Auto-scale | €200-400 |
| **Kubernetes (GKE/EKS)** | 3 nodes | €300-500 |

### 3.5 Caché Distribuida (Redis)

**Necesidad:** Reducir carga en DB y APIs de IA

| Cache Type | Datos | TTL |
|------------|-------|-----|
| Session cache | Tokens JWT, user data | 24h |
| Query cache | Embeddings de queries frecuentes | 1h |
| Response cache | Respuestas NLQ repetidas | 15min |
| Rate limiting | Contadores por usuario | 1min |

**Configuración:**

| Parámetro | Valor |
|-----------|-------|
| Proveedor | Upstash Redis o AWS ElastiCache |
| Memoria | 1-2 GB |
| Réplicas | 2 (HA) |

**Coste:** €20-50/mes

### 3.6 Cola de Mensajes (Queue)

**Necesidad:** Procesar ingestas sin bloquear API

| Queue | Uso |
|-------|-----|
| ingestion-queue | Documentos pendientes de procesar |
| embedding-queue | Chunks pendientes de vectorizar |
| notification-queue | Emails, webhooks |

**Opciones:**

| Proveedor | Coste/mes |
|-----------|-----------|
| Upstash QStash | €10-30 |
| AWS SQS | €5-20 |
| Redis (Bull) | Incluido en Redis |

---

## 4. SEGURIDAD Y COMPLIANCE

### 4.1 Medidas de Seguridad Requeridas

| Capa | Medidas |
|------|---------|
| **Red** | WAF (Cloudflare), DDoS protection, VPC aislada |
| **Transporte** | TLS 1.3, HSTS, Certificate pinning |
| **Aplicación** | JWT rotation, CSRF tokens, Rate limiting |
| **Datos** | Encryption at rest (AES-256), Encryption in transit |
| **Acceso** | MFA, SSO (SAML/OIDC), RBAC por empresa |
| **Auditoría** | Logs inmutables, trazabilidad completa |

### 4.2 Multi-tenancy (50 Empresas)

```sql
-- Todas las tablas incluyen tenant isolation
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

| Aspecto | Implementación |
|---------|----------------|
| Aislamiento datos | Row-Level Security (RLS) en PostgreSQL |
| Aislamiento vectores | Namespace por tenant en Qdrant |
| Aislamiento storage | Prefijo por tenant en S3/R2 |
| Aislamiento caché | Key prefix por tenant en Redis |
| Quotas | Límites por tenant (docs, queries, storage) |

### 4.3 Compliance

| Regulación | Medidas |
|------------|---------|
| **RGPD** | Datos en UE, derecho al olvido, DPA |
| **ENS** | Logs de acceso, cifrado, control de acceso |
| **ISO 27001** | Políticas documentadas, auditorías |
| **SOC 2 Type II** | Controles de seguridad verificados |

---

## 5. BACKUP Y DISASTER RECOVERY

### 5.1 Estrategia de Backup (3-2-1 Rule)

| Tipo | Frecuencia | Retención | Ubicación |
|------|------------|-----------|-----------|
| **Full backup DB** | Diario (02:00 UTC) | 30 días | S3 EU-West-1 |
| **Incremental DB** | Cada 1 hora | 7 días | S3 EU-West-1 |
| **Point-in-time recovery** | Continuo | 7 días | Neon/RDS built-in |
| **Blob storage** | Versionado S3 | 90 días | S3 + réplica EU-Central |
| **Vector DB** | Snapshot diario | 14 días | S3 |
| **Config/Secrets** | En cada cambio | Ilimitado | Git + Vault |

### 5.2 Disaster Recovery

| Métrica | Objetivo | Implementación |
|---------|----------|----------------|
| **RPO** (Recovery Point Objective) | < 1 hora | Backups incrementales horarios |
| **RTO** (Recovery Time Objective) | < 4 horas | Runbooks automatizados, infra as code |
| **MTTR** (Mean Time To Recovery) | < 2 horas | Alertas + on-call + automation |

### 5.3 Escenarios de Fallo y Recuperación

| Escenario | Impacto | Recuperación |
|-----------|---------|--------------|
| **Fallo de pod/instancia** | Ninguno | Auto-healing Kubernetes |
| **Fallo de zona (AZ)** | Degradación temporal | Failover automático a otra AZ |
| **Fallo de región** | Downtime ~30min | Failover manual a región secundaria |
| **Corrupción de datos** | Crítico | Restore desde backup + replay logs |
| **Ransomware/Breach** | Crítico | Backups offline + incident response |
| **Fallo proveedor IA** | Degradación | Fallback a proveedor alternativo |

### 5.4 Arquitectura Multi-Región (Opcional)

```
┌─────────────────────┐         ┌─────────────────────┐
│   EU-WEST-1 (Primary)│◄───────►│  EU-CENTRAL-1 (DR)  │
│                     │  Sync   │                     │
│  ┌───────────────┐  │         │  ┌───────────────┐  │
│  │   PostgreSQL  │──┼─────────┼──│   PostgreSQL  │  │
│  │   (Primary)   │  │ Replica │  │   (Standby)   │  │
│  └───────────────┘  │         │  └───────────────┘  │
│                     │         │                     │
│  ┌───────────────┐  │         │  ┌───────────────┐  │
│  │    Qdrant     │──┼─────────┼──│    Qdrant     │  │
│  │   (Active)    │  │ Replica │  │   (Standby)   │  │
│  └───────────────┘  │         │  └───────────────┘  │
│                     │         │                     │
│  ┌───────────────┐  │         │  ┌───────────────┐  │
│  │      S3       │──┼─────────┼──│      S3       │  │
│  │   (Primary)   │  │CRR Sync │  │   (Replica)   │  │
│  └───────────────┘  │         │  └───────────────┘  │
└─────────────────────┘         └─────────────────────┘
```

**Coste adicional multi-región:** +50-80% del coste base

---

## 6. MONITORIZACIÓN Y OBSERVABILIDAD

### 6.1 Stack de Monitorización

| Componente | Herramienta | Coste/mes |
|------------|-------------|-----------|
| **Métricas** | Grafana Cloud / Datadog | €50-200 |
| **Logs** | Grafana Loki / Datadog | Incluido |
| **Traces** | Grafana Tempo / Datadog | Incluido |
| **Alertas** | PagerDuty / Opsgenie | €20-50 |
| **Uptime** | Better Uptime / Pingdom | €20-30 |

### 6.2 Métricas Críticas (SLIs)

| Métrica | Objetivo (SLO) | Alerta |
|---------|----------------|--------|
| Latencia P95 consultas | < 3s | > 5s durante 5min |
| Latencia P95 ingestas | < 10s | > 30s durante 5min |
| Error rate | < 0.1% | > 1% durante 5min |
| Uptime | 99.9% | Cualquier downtime |
| CPU usage | < 70% | > 85% durante 10min |
| Memory usage | < 80% | > 90% durante 5min |
| DB connections | < 80% pool | > 90% durante 5min |
| Queue depth | < 1000 | > 5000 durante 10min |

### 6.3 Dashboards Esenciales

1. **Overview**: Uptime, requests/s, error rate, latencia
2. **Infrastructure**: CPU, RAM, disco, red por servicio
3. **Database**: Queries/s, conexiones, slow queries, replicación
4. **RAG Pipeline**: Ingestas/min, embeddings/s, búsquedas/s
5. **Business**: Usuarios activos, docs procesados, consultas por tenant
6. **Security**: Failed logins, rate limits triggered, anomalías

---

## 7. RESUMEN DE COSTES

### 7.1 Infraestructura Mensual

| Componente | Proveedor | Coste/mes |
|------------|-----------|-----------|
| Compute (API servers) | Cloud Run / Railway | €200-400 |
| PostgreSQL | Neon Enterprise / RDS | €200-400 |
| Vector DB | Qdrant Cloud | €150-250 |
| Blob Storage | Cloudflare R2 (1TB) | €25-50 |
| Redis Cache | Upstash | €30-50 |
| Message Queue | Upstash QStash | €20-30 |
| CDN/WAF | Cloudflare Pro | €20-50 |
| Monitorización | Grafana Cloud | €50-100 |
| Backups (storage extra) | S3/R2 | €30-50 |
| DNS/Dominios | Cloudflare | €10-20 |
| **Subtotal Infra** | | **€735-1.400/mes** |

### 7.2 APIs de IA (Variable según uso)

| Servicio | Uso Estimado | Coste/mes |
|----------|--------------|-----------|
| Gemini (OCR/ingesta) | 1M páginas inicial | €5.500 (one-time) |
| Gemini (NLQ queries) | 50K queries/mes | €150-300 |
| OpenAI Embeddings | 2M chunks inicial | €40 (one-time) |
| OpenAI Embeddings | 100K nuevos/mes | €2-5 |
| **Subtotal IA mensual** | | **€150-300/mes** |

### 7.3 Servicios Adicionales

| Servicio | Coste/mes |
|----------|-----------|
| Alertas (PagerDuty) | €30 |
| Uptime monitoring | €20 |
| SSL Certificates | Incluido |
| Email transaccional | €20-50 |
| **Subtotal Adicional** | **€70-100/mes** |

### 7.4 Coste Total

| Concepto | Rango Mensual |
|----------|---------------|
| Infraestructura base | €735-1.400 |
| APIs de IA | €150-300 |
| Servicios adicionales | €70-100 |
| **TOTAL MENSUAL** | **€955-1.800/mes** |
| **TOTAL ANUAL** | **€11.500-21.600/año** |

### 7.5 Coste Inicial (One-time)

| Concepto | Coste |
|----------|-------|
| Ingesta inicial 1M docs | €5.500-6.000 |
| Setup infraestructura | €2.000-5.000 (horas) |
| Migración datos | €1.000-3.000 (horas) |
| **TOTAL INICIAL** | **€8.500-14.000** |

---

## 8. ESCALADO FUTURO

### 8.1 Triggers de Escalado

| Métrica | Umbral | Acción |
|---------|--------|--------|
| Documentos > 2M | 80% capacidad | Añadir sharding |
| Vectores > 5M | 80% Qdrant | Cluster Qdrant |
| Usuarios > 500 | 70% CPU sustained | Añadir pods |
| Queries > 100/s | 80% capacidad | Añadir réplicas read |

### 8.2 Roadmap de Capacidad

| Fase | Documentos | Usuarios | Cambios |
|------|------------|----------|---------|
| Actual | 1M | 200 | Arquitectura descrita |
| +1 año | 3M | 500 | Sharding PostgreSQL, Qdrant cluster |
| +2 años | 10M | 1000 | Multi-región activo-activo |

---

## 9. CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Fundamentos (Semana 1-2)
- [ ] Migrar a Cloud Run / Railway
- [ ] Configurar Qdrant Cloud
- [ ] Implementar Redis cache
- [ ] Configurar Cloudflare (CDN + WAF)

### Fase 2: Resiliencia (Semana 3-4)
- [ ] Implementar colas de procesamiento
- [ ] Configurar backups automatizados
- [ ] Configurar read replica PostgreSQL
- [ ] Implementar health checks

### Fase 3: Seguridad (Semana 5-6)
- [ ] Implementar multi-tenancy RLS
- [ ] Configurar SSO/MFA
- [ ] Auditar logs de acceso
- [ ] Penetration testing

### Fase 4: Observabilidad (Semana 7-8)
- [ ] Deploy Grafana stack
- [ ] Configurar alertas
- [ ] Crear dashboards
- [ ] Documentar runbooks

### Fase 5: DR Testing (Semana 9-10)
- [ ] Test de restore desde backup
- [ ] Simulacro de failover
- [ ] Documentar RTO/RPO real
- [ ] Ajustar según resultados

---

## 10. CONCLUSIONES Y RECOMENDACIONES

### Arquitectura Recomendada

Para el escenario de **1M documentos, 50 empresas, 200 usuarios, 70% concurrencia**:

1. **Compute**: Google Cloud Run o Railway (auto-scaling)
2. **Database**: Neon Enterprise + Read Replica
3. **Vectors**: Qdrant Cloud (dedicated instance)
4. **Storage**: Cloudflare R2 (egress gratis)
5. **Cache**: Upstash Redis
6. **CDN/Security**: Cloudflare Pro

### Coste Total Estimado

| Concepto | Coste |
|----------|-------|
| Setup inicial | €10.000-15.000 |
| Mensual operación | €1.200-1.600 |
| **Anual (Year 1)** | **€24.000-34.000** |
| **Anual (Year 2+)** | **€14.000-20.000** |

### Próximos Pasos

1. Validar requisitos exactos con cliente
2. POC con arquitectura propuesta
3. Load testing para validar capacidad
4. Implementación por fases
5. Go-live con soporte 24/7 primera semana

---

*Documento generado para planificación interna. Cifras sujetas a validación con proveedores.*
