#!/bin/bash

###############################################################################
# VERBADOCPRO - SCRIPT DE PRUEBAS DE RENDIMIENTO Y STRESS
# Sin coste - Usando herramientas open source gratuitas
###############################################################################

set -e

API_BASE_URL="${1:-https://verbadocpro.eu}"
TOTAL_REQUESTS="${2:-50}"
CONCURRENT="${3:-10}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 VERBADOCPRO - PRUEBAS DE RENDIMIENTO Y STRESS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Configuración de pruebas:"
echo "   • URL Base: $API_BASE_URL"
echo "   • Total requests: $TOTAL_REQUESTS"
echo "   • Concurrentes: $CONCURRENT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Directorios temporales
RESULTS_DIR="./stress-test-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "📁 Resultados se guardarán en: $RESULTS_DIR"
echo ""

###############################################################################
# TEST 1: PRUEBA DE ENCOLADO (Queue API)
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: Prueba de Encolado - API /api/queue-document"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Documento de prueba (PDF pequeño en base64)
TEST_PDF_BASE64="JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA1IDAgUj4+Pj4vTWVkaWFCb3hbMCAwIDYxMiA3OTJdL0NvbnRlbnRzIDQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDQ0Pj4Kc3RyZWFtCkJUCi9GMSA0OCBUZgoxMCA3MDAgVGQKKFRFU1QpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKNSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9UaW1lcy1Sb21hbj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyNzQgMDAwMDAgbiAKMDAwMDAwMDIyMyAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxMjQgMDAwMDAgbiAKMDAwMDAwMDMyMyAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjQwMQolJUVPRgo="

# Schema de prueba simple
TEST_SCHEMA='{
  "type": "object",
  "properties": {
    "test": {
      "type": "string"
    }
  }
}'

# Función para encolar un documento
enqueue_document() {
    local doc_id=$1
    local timestamp=$(date +%s%N)

    curl -s -X POST "$API_BASE_URL/api/queue-document" \
        -H "Content-Type: application/json" \
        -w "\n%{http_code}|%{time_total}" \
        -d "{
            \"documentId\": \"stress-test-${doc_id}-${timestamp}\",
            \"fileData\": \"$TEST_PDF_BASE64\",
            \"fileName\": \"test-${doc_id}.pdf\",
            \"fileSize\": 500,
            \"schema\": $TEST_SCHEMA,
            \"model\": \"gemini-2.5-flash\"
        }" 2>&1
}

# Arrays para estadísticas
declare -a response_times_queue=()
declare -a http_codes_queue=()
declare -a doc_ids=()

echo "⏳ Enviando $TOTAL_REQUESTS documentos en lotes de $CONCURRENT..."
echo ""

start_time=$(date +%s)

# Procesar en lotes
for ((i=1; i<=TOTAL_REQUESTS; i+=$CONCURRENT)); do
    echo -n "Lote $((i/$CONCURRENT + 1)): Enviando docs $i-$((i+CONCURRENT-1))..."

    # Procesar en paralelo dentro del lote
    for ((j=0; j<CONCURRENT && i+j<=TOTAL_REQUESTS; j++)); do
        doc_num=$((i+j))
        (
            response=$(enqueue_document $doc_num)
            echo "$doc_num|$response" >> "$RESULTS_DIR/queue-responses.txt"
        ) &
    done

    # Esperar a que terminen todos los del lote
    wait
    echo " ✓"
done

end_time=$(date +%s)
total_time=$((end_time - start_time))

echo ""
echo "✅ Encolado completado en $total_time segundos"
echo ""

# Analizar resultados
echo "📊 Analizando resultados de encolado..."

success_count=0
error_count=0
total_response_time=0

while IFS='|' read -r doc_num http_code response_time rest; do
    if [[ "$http_code" == "200" ]]; then
        ((success_count++))
        response_times_queue+=($response_time)
        total_response_time=$(echo "$total_response_time + $response_time" | bc)
    else
        ((error_count++))
    fi
done < "$RESULTS_DIR/queue-responses.txt"

if [ $success_count -gt 0 ]; then
    avg_response_time=$(echo "scale=3; $total_response_time / $success_count" | bc)
else
    avg_response_time=0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESULTADOS TEST 1: Encolado de Documentos"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Éxitos: $success_count / $TOTAL_REQUESTS ($(echo "scale=1; $success_count * 100 / $TOTAL_REQUESTS" | bc)%)"
echo "❌ Errores: $error_count / $TOTAL_REQUESTS ($(echo "scale=1; $error_count * 100 / $TOTAL_REQUESTS" | bc)%)"
echo "⏱️  Tiempo total: $total_time segundos"
echo "📈 Throughput: $(echo "scale=2; $TOTAL_REQUESTS / $total_time" | bc) docs/segundo"
echo "⏱️  Tiempo respuesta promedio: ${avg_response_time}s"
echo ""

###############################################################################
# TEST 2: PRUEBA DE ESTADO (Status API)
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Prueba de Consulta de Estado - API /api/document-status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Extraer algunos IDs de documentos encolados
sample_doc_ids=($(grep -oP '"documentId":"stress-test-\K[^"]+' "$RESULTS_DIR/queue-responses.txt" | head -10))

if [ ${#sample_doc_ids[@]} -eq 0 ]; then
    echo "⚠️  No se pudieron extraer IDs de documentos. Saltando test de estado."
else
    echo "⏳ Consultando estado de ${#sample_doc_ids[@]} documentos..."

    for doc_id in "${sample_doc_ids[@]}"; do
        response=$(curl -s -X GET "$API_BASE_URL/api/document-status?documentId=stress-test-$doc_id" \
            -w "\n%{http_code}|%{time_total}" 2>&1)
        echo "$doc_id|$response" >> "$RESULTS_DIR/status-responses.txt"
    done

    echo "✅ Consultas de estado completadas"
    echo ""
fi

###############################################################################
# TEST 3: PRUEBA DE CARGA SOSTENIDA
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Prueba de Carga Sostenida (30 segundos)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

sustained_count=0
sustained_start=$(date +%s)
sustained_duration=30

echo "⏳ Enviando requests continuos durante ${sustained_duration}s..."

while [ $(($(date +%s) - sustained_start)) -lt $sustained_duration ]; do
    (enqueue_document "sustained-$sustained_count" > "$RESULTS_DIR/sustained-$sustained_count.txt" 2>&1) &
    ((sustained_count++))
    sleep 0.1  # 100ms entre requests
done

wait

sustained_end=$(date +%s)
sustained_total=$((sustained_end - sustained_start))

echo ""
echo "✅ Prueba sostenida completada"
echo "   • Duración: ${sustained_total}s"
echo "   • Requests enviados: $sustained_count"
echo "   • Promedio: $(echo "scale=2; $sustained_count / $sustained_total" | bc) req/s"
echo ""

###############################################################################
# INFORME FINAL
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 INFORME FINAL DE PRUEBAS DE RENDIMIENTO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Sistema probado: VerbadocPro Europa"
echo "URL: $API_BASE_URL"
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "RESUMEN DE RESULTADOS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test 1 - Encolado de Documentos:"
echo "  ✅ Éxitos: $success_count / $TOTAL_REQUESTS"
echo "  ❌ Errores: $error_count / $TOTAL_REQUESTS"
echo "  ⏱️  Throughput: $(echo "scale=2; $TOTAL_REQUESTS / $total_time" | bc) docs/segundo"
echo "  ⏱️  Latencia promedio: ${avg_response_time}s"
echo ""
echo "Test 3 - Carga Sostenida (${sustained_duration}s):"
echo "  📊 Total requests: $sustained_count"
echo "  📈 Promedio: $(echo "scale=2; $sustained_count / $sustained_total" | bc) req/s"
echo ""
echo "CONCLUSIONES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

success_rate=$(echo "scale=1; $success_count * 100 / $TOTAL_REQUESTS" | bc)

if (( $(echo "$success_rate >= 99" | bc -l) )); then
    echo "✅ EXCELENTE: Tasa de éxito ≥ 99%"
elif (( $(echo "$success_rate >= 95" | bc -l) )); then
    echo "✅ BUENO: Tasa de éxito ≥ 95%"
elif (( $(echo "$success_rate >= 90" | bc -l) )); then
    echo "⚠️  ACEPTABLE: Tasa de éxito ≥ 90%"
else
    echo "❌ INSUFICIENTE: Tasa de éxito < 90%"
fi

if (( $(echo "$avg_response_time < 1.0" | bc -l) )); then
    echo "✅ EXCELENTE: Latencia promedio < 1s"
elif (( $(echo "$avg_response_time < 2.0" | bc -l) )); then
    echo "✅ BUENO: Latencia promedio < 2s"
else
    echo "⚠️  Latencia promedio elevada (>${avg_response_time}s)"
fi

echo ""
echo "CAPACIDAD ESTIMADA (basado en resultados):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
throughput=$(echo "scale=2; $TOTAL_REQUESTS / $total_time" | bc)
capacity_hour=$(echo "scale=0; $throughput * 3600" | bc)
capacity_day_8h=$(echo "scale=0; $throughput * 3600 * 8" | bc)
capacity_day_24h=$(echo "scale=0; $throughput * 3600 * 24" | bc)

echo ""
echo "  📊 Throughput medido: ${throughput} docs/segundo"
echo "  📊 Capacidad por hora: ${capacity_hour} docs/hora"
echo "  📊 Capacidad diaria (8h): ${capacity_day_8h} docs/día"
echo "  📊 Capacidad diaria (24h): ${capacity_day_24h} docs/día"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Resultados completos guardados en: $RESULTS_DIR/"
echo ""
echo "✅ Pruebas de rendimiento completadas exitosamente"
echo ""
