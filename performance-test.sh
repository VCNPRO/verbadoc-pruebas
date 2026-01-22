#!/bin/bash
# Prueba de rendimiento simplificada

API_URL="https://www.verbadocpro.eu"
TOTAL=30
echo "🧪 Prueba de Rendimiento - $TOTAL requests"
echo ""

# Documento de prueba
PDF_DATA="JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA1IDAgUj4+Pj4vTWVkaWFCb3hbMCAwIDYxMiA3OTJdL0NvbnRlbnRzIDQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDQ0Pj4Kc3RyZWFtCkJUCi9GMSA0OCBUZgoxMCA3MDAgVGQKKFRFU1QpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKNSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9UaW1lcy1Sb21hbj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyNzQgMDAwMDAgbiAKMDAwMDAwMDIyMyAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxMjQgMDAwMDAgbiAKMDAwMDAwMDMyMyAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjQwMQolJUVPRgo="

START=$(date +%s)
SUCCESS=0
ERRORS=0

echo "⏳ Enviando $TOTAL documentos..."
for i in $(seq 1 $TOTAL); do
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/queue-document" \
        -H "Content-Type: application/json" \
        -d "{\"documentId\":\"perf-test-$i-$(date +%s%N)\",\"fileData\":\"$PDF_DATA\",\"fileName\":\"test-$i.pdf\",\"fileSize\":500,\"schema\":{\"type\":\"object\"},\"model\":\"gemini-2.5-flash\"}" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" = "200" ]; then
        ((SUCCESS++))
        echo -n "✓"
    else
        ((ERRORS++))
        echo -n "✗"
    fi
    
    # Pequeña pausa para no saturar
    sleep 0.2
done

END=$(date +%s)
DURATION=$((END - START))

echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESULTADOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Éxitos: $SUCCESS / $TOTAL"
echo "❌ Errores: $ERRORS / $TOTAL"
echo "⏱️  Duración: ${DURATION}s"
echo "📈 Throughput: $(echo "scale=2; $TOTAL / $DURATION" | bc) docs/seg"
echo ""
