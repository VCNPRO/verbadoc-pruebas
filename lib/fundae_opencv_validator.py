"""
FUNDAE OpenCV Validator - Módulo de Producción
Validación determinista de checkboxes para formularios FUNDAE.

Uso:
    from fundae_opencv_validator import FUNDAEValidator, validate_fundae_page
    
    # Opción 1: Función simple
    result = validate_fundae_page("pagina2.png")
    
    # Opción 2: Clase con más control
    validator = FUNDAEValidator()
    result = validator.validate_page("pagina2.png")
    comparison = validator.compare_with_gemini(result, gemini_data)

Requisitos:
    pip install opencv-python-headless numpy
"""

import cv2
import numpy as np
from collections import defaultdict
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
from enum import Enum
import json


class CheckboxState(Enum):
    EMPTY = "empty"
    MARKED = "marked"
    UNCERTAIN = "uncertain"


@dataclass
class DetectedCheckbox:
    x: int
    y: int
    w: int
    h: int
    row: int
    col: int
    state: CheckboxState
    confidence: float
    ink_density: float


@dataclass
class RowValue:
    """Valor detectado por OpenCV para una fila de checkboxes."""
    row_index: int
    field: Optional[str]  # campo FUNDAE mapeado (None si no hay mapeo)
    opencv_value: Optional[str]  # "1","2","3","4","NC" o None si no se detectó
    num_checkboxes: int
    marked_positions: List[int]  # posiciones marcadas (0-based dentro de la fila)
    confidence: float


@dataclass
class ValidationResult:
    total_checkboxes: int
    total_rows: int
    marked_count: int
    empty_count: int
    uncertain_count: int
    checkboxes: List[DetectedCheckbox]
    row_values: List[RowValue]
    processing_time_ms: float


class FUNDAEValidator:
    """Validador OpenCV para formularios FUNDAE."""

    # Mapeo fila (0-based) → campo FUNDAE en la página 2 del formulario.
    # El orden es fijo porque el formulario FUNDAE siempre tiene la misma estructura.
    # Filas con 5 casillas (NC,1,2,3,4) → valoraciones escala 1-4
    # Filas con 2 casillas (Sí,No) → valoracion_8_x
    # Filas de Formadores/Tutores tienen 8+ casillas → se gestionan aparte
    ROW_TO_FIELD = [
        "valoracion_1_1",           # fila 0
        "valoracion_1_2",           # fila 1
        "valoracion_2_1",           # fila 2
        "valoracion_2_2",           # fila 3
        "valoracion_3_1",           # fila 4
        "valoracion_3_2",           # fila 5
        # filas 6-7: Formadores/Tutores (4.1 y 4.2) - se gestionan en _compute_row_values
        "valoracion_4_1",           # fila 6 (formadores + tutores)
        "valoracion_4_2",           # fila 7 (formadores + tutores)
        "valoracion_5_1",           # fila 8
        "valoracion_5_2",           # fila 9
        "valoracion_6_1",           # fila 10
        "valoracion_6_2",           # fila 11
        "valoracion_7_1",           # fila 12
        "valoracion_7_2",           # fila 13
        "valoracion_8_1",           # fila 14 (Sí/No)
        "valoracion_8_2",           # fila 15 (Sí/No)
        "valoracion_9_1",           # fila 16
        "valoracion_9_2",           # fila 17
        "valoracion_9_3",           # fila 18
        "valoracion_9_4",           # fila 19
        "valoracion_9_5",           # fila 20
        "valoracion_10",            # fila 21
    ]

    # Configuración validada en pruebas con formularios reales
    CONFIG = {
        "roi_x_percent": 0.55,
        "checkbox_min_size": 14,
        "checkbox_max_size": 40,
        "aspect_ratio_min": 0.8,
        "aspect_ratio_max": 1.25,
        "solidity_min": 0.75,           # filtra contornos irregulares (texto)
        "binary_block_size": 21,
        "binary_c": 12,
        "row_tolerance_px": 20,
        "min_checkboxes_per_row": 3,
        "max_checkboxes_per_row": 6,    # FUNDAE tiene NC,1,2,3,4 = 5 columnas máx
        "interior_margin_percent": 0.28,
        "density_marked_threshold": 0.07,
        "density_empty_threshold": 0.035,
        "size_std_max_ratio": 0.3,      # uniformidad: checkboxes tienen tamaño similar
    }
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = {**self.CONFIG, **(config or {})}
    
    def validate_page(self, image_path: str) -> ValidationResult:
        """Valida una página de formulario FUNDAE."""
        import time
        start = time.time()
        
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"No se pudo cargar: {image_path}")
        
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        roi_x = int(w * self.config["roi_x_percent"])
        
        binary = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_MEAN_C,
            cv2.THRESH_BINARY_INV,
            self.config["binary_block_size"],
            self.config["binary_c"]
        )
        
        roi_binary = binary[:, roi_x:]
        contours, _ = cv2.findContours(roi_binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        candidates = self._filter_candidates(contours, roi_x)
        rows = self._group_by_rows(candidates)
        
        checkboxes = []
        for row_idx, row_cbs in enumerate(rows):
            for col_idx, cb in enumerate(row_cbs):
                state, conf, density = self._classify(gray, cb)
                checkboxes.append(DetectedCheckbox(
                    x=cb['x'], y=cb['y'], w=cb['w'], h=cb['h'],
                    row=row_idx, col=col_idx,
                    state=state, confidence=conf, ink_density=density
                ))
        
        marked = [c for c in checkboxes if c.state == CheckboxState.MARKED]
        empty = [c for c in checkboxes if c.state == CheckboxState.EMPTY]
        uncertain = [c for c in checkboxes if c.state == CheckboxState.UNCERTAIN]

        row_values = self._compute_row_values(rows, checkboxes)

        return ValidationResult(
            total_checkboxes=len(checkboxes),
            total_rows=len(rows),
            marked_count=len(marked),
            empty_count=len(empty),
            uncertain_count=len(uncertain),
            checkboxes=checkboxes,
            row_values=row_values,
            processing_time_ms=(time.time() - start) * 1000
        )
    
    def _compute_row_values(self, rows: List[List[Dict]], checkboxes: List[DetectedCheckbox]) -> List[RowValue]:
        """Para cada fila, determina qué posición está marcada (1-4) o NC."""
        row_values = []

        for row_idx, row_cbs in enumerate(rows):
            # Obtener checkboxes de esta fila, ordenados por X (ya lo están)
            row_checks = [cb for cb in checkboxes if cb.row == row_idx]
            row_checks.sort(key=lambda c: c.x)
            num_cbs = len(row_checks)

            # Buscar posiciones marcadas
            marked_positions = [
                i for i, cb in enumerate(row_checks)
                if cb.state == CheckboxState.MARKED
            ]

            # Determinar el campo FUNDAE
            field = None
            if row_idx < len(self.ROW_TO_FIELD):
                field = self.ROW_TO_FIELD[row_idx]

            # Determinar el valor
            opencv_value = None
            confidence = 0.0

            if num_cbs == 5:
                # Fila estándar: NC(0), 1(1), 2(2), 3(3), 4(4)
                if len(marked_positions) == 1:
                    pos = marked_positions[0]
                    if pos == 0:
                        opencv_value = "NC"
                    else:
                        opencv_value = str(pos)  # 1,2,3,4
                    confidence = row_checks[pos].confidence
                elif len(marked_positions) == 0:
                    opencv_value = "NC"
                    confidence = 0.8
                else:
                    # Múltiples marcas → NC
                    opencv_value = "NC"
                    confidence = 0.3
            elif num_cbs >= 8:
                # Fila Formadores/Tutores: tiene 2 grupos de 4-5 casillas
                # Primer grupo (formadores): primeras 4-5 casillas
                # Segundo grupo (tutores): últimas 4-5 casillas
                mid = num_cbs // 2
                formadores_checks = row_checks[:mid]
                tutores_checks = row_checks[mid:]

                form_marked = [i for i, cb in enumerate(formadores_checks) if cb.state == CheckboxState.MARKED]
                tut_marked = [i - mid for i, cb in enumerate(row_checks[mid:]) if cb.state == CheckboxState.MARKED]

                # Valor formadores
                form_value = "NC"
                if len(form_marked) == 1:
                    pos = form_marked[0]
                    form_value = "NC" if pos == 0 else str(pos)

                # Valor tutores
                tut_value = "NC"
                if len(tut_marked) == 1:
                    pos = tut_marked[0]
                    tut_value = "NC" if pos == 0 else str(pos)

                # Para filas formadores/tutores, crear 2 RowValues
                if field and field.startswith("valoracion_4_"):
                    row_values.append(RowValue(
                        row_index=row_idx,
                        field=field.replace("valoracion_4_", "valoracion_4_") + "_formadores",
                        opencv_value=form_value,
                        num_checkboxes=len(formadores_checks),
                        marked_positions=form_marked,
                        confidence=max((cb.confidence for cb in formadores_checks), default=0.5),
                    ))
                    row_values.append(RowValue(
                        row_index=row_idx,
                        field=field.replace("valoracion_4_", "valoracion_4_") + "_tutores",
                        opencv_value=tut_value,
                        num_checkboxes=len(tutores_checks),
                        marked_positions=tut_marked,
                        confidence=max((cb.confidence for cb in tutores_checks), default=0.5),
                    ))
                    continue  # ya añadimos las 2, no añadir la fila genérica
            elif num_cbs in (2, 3):
                # Fila Sí/No (valoracion_8_x): 2-3 casillas (NC, Sí, No)
                if len(marked_positions) == 1:
                    pos = marked_positions[0]
                    if num_cbs == 3:
                        # NC(0), Sí(1), No(2)
                        opencv_value = ["NC", "Si", "No"][pos] if pos < 3 else "NC"
                    else:
                        # Sí(0), No(1)
                        opencv_value = ["Si", "No"][pos] if pos < 2 else "NC"
                    confidence = row_checks[pos].confidence
                else:
                    opencv_value = "NC"
                    confidence = 0.3

            row_values.append(RowValue(
                row_index=row_idx,
                field=field,
                opencv_value=opencv_value,
                num_checkboxes=num_cbs,
                marked_positions=marked_positions,
                confidence=confidence,
            ))

        return row_values

    def _filter_candidates(self, contours, roi_x: int) -> List[Dict]:
        candidates = []
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)

            if not (self.config["checkbox_min_size"] <= w <= self.config["checkbox_max_size"]):
                continue
            if not (self.config["checkbox_min_size"] <= h <= self.config["checkbox_max_size"]):
                continue

            aspect = w / h
            if not (self.config["aspect_ratio_min"] <= aspect <= self.config["aspect_ratio_max"]):
                continue

            # Solidity: area del contorno / area del bounding rect
            # Checkboxes reales son rectangulares (solidity alta)
            area = cv2.contourArea(c)
            solidity = area / (w * h) if w * h > 0 else 0
            if solidity < self.config["solidity_min"]:
                continue

            candidates.append({'x': x + roi_x, 'y': y, 'w': w, 'h': h})

        return candidates
    
    def _group_by_rows(self, candidates: List[Dict]) -> List[List[Dict]]:
        if not candidates:
            return []
        
        rows_dict = defaultdict(list)
        tolerance = self.config["row_tolerance_px"]
        
        for c in candidates:
            row_key = (c['y'] // tolerance) * tolerance
            rows_dict[row_key].append(c)
        
        min_per_row = self.config["min_checkboxes_per_row"]
        max_per_row = self.config.get("max_checkboxes_per_row", 20)
        valid_rows = []
        for v in rows_dict.values():
            if len(v) < min_per_row or len(v) > max_per_row:
                continue
            row = sorted(v, key=lambda x: x['x'])
            # Filtrar filas con tamaños no uniformes
            sizes = [cb['w'] * cb['h'] for cb in row]
            mean_size = sum(sizes) / len(sizes)
            if mean_size > 0:
                std_ratio = (sum((s - mean_size)**2 for s in sizes) / len(sizes))**0.5 / mean_size
                if std_ratio > self.config.get("size_std_max_ratio", 0.3):
                    continue
            valid_rows.append(row)

        valid_rows.sort(key=lambda row: row[0]['y'])

        return valid_rows
    
    def _classify(self, gray: np.ndarray, cb: Dict) -> Tuple[CheckboxState, float, float]:
        x, y, w, h = cb['x'], cb['y'], cb['w'], cb['h']

        margin = max(3, int(self.config["interior_margin_percent"] * min(w, h)))
        y1, y2 = y + margin, y + h - margin
        x1, x2 = x + margin, x + w - margin

        if y2 <= y1 or x2 <= x1:
            return CheckboxState.UNCERTAIN, 0.5, 0.0

        interior = gray[y1:y2, x1:x2]
        if interior.size == 0:
            return CheckboxState.UNCERTAIN, 0.5, 0.0

        _, bin_interior = cv2.threshold(interior, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Eliminar líneas horizontales y verticales (bordes de tabla)
        ih, iw = bin_interior.shape
        if ih >= 3 and iw >= 3:
            # Solo elimina líneas rectas que cruzan todo el ancho/alto
            h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (iw, 1))
            v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, ih))
            h_lines = cv2.morphologyEx(bin_interior, cv2.MORPH_OPEN, h_kernel)
            v_lines = cv2.morphologyEx(bin_interior, cv2.MORPH_OPEN, v_kernel)
            lines_mask = cv2.bitwise_or(h_lines, v_lines)
            bin_interior = cv2.subtract(bin_interior, lines_mask)

        dark_pixels = np.sum(bin_interior == 255)
        ink_density = dark_pixels / bin_interior.size

        if ink_density > self.config["density_marked_threshold"]:
            confidence = min(0.95, 0.70 + ink_density)
            return CheckboxState.MARKED, confidence, ink_density
        elif ink_density < self.config["density_empty_threshold"]:
            return CheckboxState.EMPTY, 0.90, ink_density
        else:
            num_labels, _, stats, _ = cv2.connectedComponentsWithStats(bin_interior, connectivity=8)
            big_components = sum(1 for i in range(1, num_labels) if stats[i, cv2.CC_STAT_AREA] > 15)

            if big_components >= 2 and ink_density > 0.05:
                return CheckboxState.MARKED, 0.65, ink_density
            return CheckboxState.UNCERTAIN, 0.50, ink_density
    
    def compare_with_gemini(self, opencv_result: ValidationResult, gemini_data: Dict) -> Dict:
        """Compara resultados OpenCV vs Gemini."""
        opencv_marked = opencv_result.marked_count
        
        gemini_marked = 0
        for field, value in gemini_data.items():
            if value and value not in [None, "", "NC", "null", "No contesta"]:
                gemini_marked += 1
        
        diff = abs(opencv_marked - gemini_marked)
        diff_percent = diff / max(opencv_marked, gemini_marked, 1) * 100
        
        if diff <= 2:
            recommendation = "ACCEPT"
        elif diff <= 5 or diff_percent <= 15:
            recommendation = "VALIDATE"
        else:
            recommendation = "HUMAN_REVIEW"
        
        return {
            "opencv_marked": opencv_marked,
            "gemini_marked": gemini_marked,
            "discrepancy": diff,
            "discrepancy_percent": round(diff_percent, 1),
            "recommendation": recommendation
        }
    
    def to_json(self, result: ValidationResult) -> str:
        return json.dumps({
            "total_checkboxes": result.total_checkboxes,
            "total_rows": result.total_rows,
            "marked": result.marked_count,
            "empty": result.empty_count,
            "uncertain": result.uncertain_count,
            "processing_time_ms": round(result.processing_time_ms, 1),
            "row_values": [
                {
                    "row_index": rv.row_index,
                    "field": rv.field,
                    "opencv_value": rv.opencv_value,
                    "num_checkboxes": rv.num_checkboxes,
                    "marked_positions": rv.marked_positions,
                    "confidence": round(rv.confidence, 3),
                }
                for rv in result.row_values
            ],
            "checkboxes": [
                {
                    "row": cb.row,
                    "col": cb.col,
                    "state": cb.state.value,
                    "confidence": round(cb.confidence, 3),
                    "ink_density": round(cb.ink_density, 4),
                    "bbox": [cb.x, cb.y, cb.w, cb.h]
                }
                for cb in result.checkboxes
            ]
        }, indent=2, ensure_ascii=False)
    
    def generate_debug_image(self, image_path: str, result: ValidationResult, output_path: str):
        image = cv2.imread(image_path)
        h, w = image.shape[:2]
        
        roi_x = int(w * self.config["roi_x_percent"])
        cv2.line(image, (roi_x, 0), (roi_x, h), (128, 128, 128), 1)
        
        for cb in result.checkboxes:
            if cb.state == CheckboxState.MARKED:
                color = (0, 255, 0)
            elif cb.state == CheckboxState.EMPTY:
                color = (255, 0, 0)
            else:
                color = (0, 165, 255)
            
            cv2.rectangle(image, (cb.x, cb.y), (cb.x + cb.w, cb.y + cb.h), color, 2)
            label = f"R{cb.row}C{cb.col}"
            cv2.putText(image, label, (cb.x, cb.y - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.3, color, 1)
        
        cv2.imwrite(output_path, image)


def validate_fundae_page(image_path: str) -> Dict:
    """Función simple para validar una página FUNDAE."""
    validator = FUNDAEValidator()
    result = validator.validate_page(image_path)
    return json.loads(validator.to_json(result))


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Uso: python fundae_opencv_validator.py <imagen.png> [--debug]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    debug_mode = "--debug" in sys.argv
    
    print(f"\n{'='*60}")
    print("FUNDAE OpenCV Validator")
    print(f"{'='*60}")
    
    validator = FUNDAEValidator()
    result = validator.validate_page(image_path)
    
    print(f"\nResultados: {image_path}")
    print(f"  Filas: {result.total_rows}")
    print(f"  Total: {result.total_checkboxes}")
    print(f"  ✓ Marcados: {result.marked_count}")
    print(f"  ○ Vacíos: {result.empty_count}")
    print(f"  ? Inciertos: {result.uncertain_count}")
    print(f"  Tiempo: {result.processing_time_ms:.1f} ms")
    
    marked = [cb for cb in result.checkboxes if cb.state == CheckboxState.MARKED]
    if marked:
        print(f"\nMarcados:")
        for cb in marked:
            print(f"  R{cb.row}C{cb.col}: density={cb.ink_density:.1%}")
    
    if debug_mode:
        debug_path = image_path.replace('.png', '_opencv_debug.png')
        validator.generate_debug_image(image_path, result, debug_path)
        print(f"\nDebug: {debug_path}")
    
    print(f"\n{'='*60}")
    print("JSON Output:")
    print(f"{'='*60}")
    print(validator.to_json(result))
