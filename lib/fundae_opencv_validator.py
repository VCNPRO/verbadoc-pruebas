"""
FUNDAE OpenCV Validator - Módulo de Producción v2
Validación determinista de checkboxes para formularios FUNDAE.

v2: Eliminación agresiva de líneas de tabla antes de detección.
    Clasificación por densidad relativa dentro de cada fila.

Uso:
    from fundae_opencv_validator import FUNDAEValidator, validate_fundae_page

    validator = FUNDAEValidator()
    result = validator.validate_page("pagina2.png")

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
    field: Optional[str]
    opencv_value: Optional[str]
    num_checkboxes: int
    marked_positions: List[int]
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
    """Validador OpenCV para formularios FUNDAE v2."""

    ROW_TO_FIELD = [
        "valoracion_1_1",           # fila 0
        "valoracion_1_2",           # fila 1
        "valoracion_2_1",           # fila 2
        "valoracion_2_2",           # fila 3
        "valoracion_3_1",           # fila 4
        "valoracion_3_2",           # fila 5
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

    CONFIG = {
        "roi_x_percent": 0.45,          # más a la izquierda para capturar secciones 7-10
        "checkbox_min_size": 10,
        "checkbox_max_size": 50,
        "aspect_ratio_min": 0.6,
        "aspect_ratio_max": 1.5,
        "solidity_min": 0.55,
        "binary_block_size": 21,
        "binary_c": 10,
        "row_tolerance_px": 18,
        "min_checkboxes_per_row": 2,
        "max_checkboxes_per_row": 12,   # formadores+tutores pueden tener 10
        "interior_margin_percent": 0.25,
        "density_marked_threshold": 0.15,
        "density_empty_threshold": 0.04,
        "size_std_max_ratio": 0.4,
        # v2: eliminación de líneas
        "line_removal_h_ratio": 0.6,    # líneas horizontales > 60% del ancho ROI
        "line_removal_v_ratio": 0.4,    # líneas verticales > 40% del alto de zona
        "line_thickness": 3,
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
        roi_gray = gray[:, roi_x:]
        roi_h, roi_w = roi_gray.shape

        # Binarización
        binary = cv2.adaptiveThreshold(
            roi_gray, 255,
            cv2.ADAPTIVE_THRESH_MEAN_C,
            cv2.THRESH_BINARY_INV,
            self.config["binary_block_size"],
            self.config["binary_c"]
        )

        # v2: Eliminar líneas de tabla ANTES de buscar contornos
        cleaned = self._remove_table_lines(binary, roi_w, roi_h)

        contours, hierarchy = cv2.findContours(cleaned, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

        candidates = self._filter_candidates(contours, hierarchy, roi_x)
        rows = self._group_by_rows(candidates)

        checkboxes = []
        for row_idx, row_cbs in enumerate(rows):
            # Clasificar con densidad relativa dentro de la fila
            row_densities = []
            row_data = []
            for col_idx, cb in enumerate(row_cbs):
                density = self._measure_density(gray, cb)
                row_densities.append(density)
                row_data.append((col_idx, cb, density))

            # Clasificar usando densidad relativa a la fila
            for col_idx, cb, density in row_data:
                state, conf = self._classify_relative(density, row_densities)
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

    def _remove_table_lines(self, binary: np.ndarray, w: int, h: int) -> np.ndarray:
        """Elimina líneas horizontales y verticales de la tabla."""
        cleaned = binary.copy()

        # Líneas horizontales largas
        h_len = max(30, int(w * self.config["line_removal_h_ratio"]))
        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_len, 1))
        h_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel, iterations=1)
        # Engrosar un poco para eliminar restos
        h_lines = cv2.dilate(h_lines, cv2.getStructuringElement(cv2.MORPH_RECT, (1, self.config["line_thickness"])))
        cleaned = cv2.subtract(cleaned, h_lines)

        # Líneas verticales largas
        v_len = max(30, int(h * self.config["line_removal_v_ratio"]))
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_len))
        v_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel, iterations=1)
        v_lines = cv2.dilate(v_lines, cv2.getStructuringElement(cv2.MORPH_RECT, (self.config["line_thickness"], 1)))
        cleaned = cv2.subtract(cleaned, v_lines)

        return cleaned

    def _filter_candidates(self, contours, hierarchy, roi_x: int) -> List[Dict]:
        candidates = []
        for i, c in enumerate(contours):
            x, y, w, h = cv2.boundingRect(c)

            if not (self.config["checkbox_min_size"] <= w <= self.config["checkbox_max_size"]):
                continue
            if not (self.config["checkbox_min_size"] <= h <= self.config["checkbox_max_size"]):
                continue

            aspect = w / h
            if not (self.config["aspect_ratio_min"] <= aspect <= self.config["aspect_ratio_max"]):
                continue

            area = cv2.contourArea(c)
            solidity = area / (w * h) if w * h > 0 else 0
            if solidity < self.config["solidity_min"]:
                continue

            candidates.append({'x': x + roi_x, 'y': y, 'w': w, 'h': h})

        return candidates

    def _group_by_rows(self, candidates: List[Dict]) -> List[List[Dict]]:
        if not candidates:
            return []

        # Agrupar por centroide Y con tolerancia
        sorted_cands = sorted(candidates, key=lambda c: c['y'] + c['h'] // 2)
        rows = []
        current_row = [sorted_cands[0]]
        current_y = sorted_cands[0]['y'] + sorted_cands[0]['h'] // 2

        for c in sorted_cands[1:]:
            cy = c['y'] + c['h'] // 2
            if abs(cy - current_y) <= self.config["row_tolerance_px"]:
                current_row.append(c)
                # Actualizar centroide promedio
                current_y = sum(cb['y'] + cb['h'] // 2 for cb in current_row) / len(current_row)
            else:
                rows.append(current_row)
                current_row = [c]
                current_y = cy
        rows.append(current_row)

        min_per_row = self.config["min_checkboxes_per_row"]
        max_per_row = self.config["max_checkboxes_per_row"]
        valid_rows = []
        for row in rows:
            if len(row) < min_per_row or len(row) > max_per_row:
                continue
            row = sorted(row, key=lambda x: x['x'])
            # Filtrar filas con tamaños no uniformes
            sizes = [cb['w'] * cb['h'] for cb in row]
            mean_size = sum(sizes) / len(sizes)
            if mean_size > 0:
                std_ratio = (sum((s - mean_size)**2 for s in sizes) / len(sizes))**0.5 / mean_size
                if std_ratio > self.config["size_std_max_ratio"]:
                    continue
            valid_rows.append(row)

        valid_rows.sort(key=lambda row: row[0]['y'])
        return valid_rows

    def _measure_density(self, gray: np.ndarray, cb: Dict) -> float:
        """Mide densidad de tinta dentro del checkbox (sin líneas de tabla)."""
        x, y, w, h = cb['x'], cb['y'], cb['w'], cb['h']
        margin = max(3, int(self.config["interior_margin_percent"] * min(w, h)))
        y1, y2 = y + margin, y + h - margin
        x1, x2 = x + margin, x + w - margin

        if y2 <= y1 or x2 <= x1:
            return 0.0

        interior = gray[y1:y2, x1:x2]
        if interior.size == 0:
            return 0.0

        _, bin_interior = cv2.threshold(interior, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Eliminar líneas dentro del checkbox
        ih, iw = bin_interior.shape
        if ih >= 3 and iw >= 3:
            # Líneas horizontales que cruzan > 70% del ancho interior
            h_len = max(3, int(iw * 0.7))
            h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_len, 1))
            h_lines = cv2.morphologyEx(bin_interior, cv2.MORPH_OPEN, h_kernel)
            # Líneas verticales que cruzan > 70% del alto interior
            v_len = max(3, int(ih * 0.7))
            v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_len))
            v_lines = cv2.morphologyEx(bin_interior, cv2.MORPH_OPEN, v_kernel)
            lines_mask = cv2.bitwise_or(h_lines, v_lines)
            bin_interior = cv2.subtract(bin_interior, lines_mask)

        dark_pixels = np.sum(bin_interior == 255)
        return dark_pixels / bin_interior.size

    def _classify_relative(self, density: float, row_densities: List[float]) -> Tuple[CheckboxState, float]:
        """
        Clasifica un checkbox usando tanto umbral absoluto como posición relativa en la fila.
        La idea: en una fila de 5 casillas, la marcada tiene MUCHA más tinta que las vacías.
        """
        # Umbral absoluto
        if density > self.config["density_marked_threshold"]:
            return CheckboxState.MARKED, min(0.95, 0.70 + density)

        if density < self.config["density_empty_threshold"]:
            return CheckboxState.EMPTY, 0.90

        # Zona uncertain: usar contexto de la fila
        if len(row_densities) >= 3:
            sorted_densities = sorted(row_densities)
            # Mediana de la fila (representa las casillas vacías)
            median = sorted_densities[len(sorted_densities) // 2]
            # El máximo de la fila (la casilla marcada, si existe)
            max_d = sorted_densities[-1]

            # Si esta casilla tiene densidad mucho mayor que la mediana → marcada
            if median > 0 and density > median * 3.0 and density > 0.08:
                return CheckboxState.MARKED, 0.75

            # Si la densidad está cerca de la mediana → vacía
            if median > 0 and density < median * 1.5:
                return CheckboxState.EMPTY, 0.70

            # Si hay una separación clara entre máximo y el resto
            if max_d > 0 and density == max_d and density > median * 2.5:
                return CheckboxState.MARKED, 0.70

        return CheckboxState.UNCERTAIN, 0.50

    def _compute_row_values(self, rows: List[List[Dict]], checkboxes: List[DetectedCheckbox]) -> List[RowValue]:
        """Para cada fila, determina qué posición está marcada (1-4) o NC."""
        row_values = []

        for row_idx, row_cbs in enumerate(rows):
            row_checks = [cb for cb in checkboxes if cb.row == row_idx]
            row_checks.sort(key=lambda c: c.x)
            num_cbs = len(row_checks)

            marked_positions = [
                i for i, cb in enumerate(row_checks)
                if cb.state == CheckboxState.MARKED
            ]

            field = None
            if row_idx < len(self.ROW_TO_FIELD):
                field = self.ROW_TO_FIELD[row_idx]

            opencv_value = None
            confidence = 0.0

            if num_cbs == 5:
                # Fila estándar: NC(0), 1(1), 2(2), 3(3), 4(4)
                if len(marked_positions) == 1:
                    pos = marked_positions[0]
                    if pos == 0:
                        opencv_value = "NC"
                    else:
                        opencv_value = str(pos)
                    confidence = row_checks[pos].confidence
                elif len(marked_positions) == 0:
                    opencv_value = "NC"
                    confidence = 0.8
                else:
                    # Múltiples marcas: elegir la de mayor densidad
                    best = max(marked_positions, key=lambda i: row_checks[i].ink_density)
                    if row_checks[best].ink_density > 0.20:
                        if best == 0:
                            opencv_value = "NC"
                        else:
                            opencv_value = str(best)
                        confidence = 0.55  # baja confianza por ambigüedad
                    else:
                        opencv_value = "NC"
                        confidence = 0.3
            elif num_cbs == 4:
                # Falta una casilla (probablemente NC no detectada)
                # Asumimos: 1(0), 2(1), 3(2), 4(3)
                if len(marked_positions) == 1:
                    pos = marked_positions[0]
                    opencv_value = str(pos + 1)
                    confidence = row_checks[pos].confidence * 0.85
                elif len(marked_positions) == 0:
                    opencv_value = "NC"
                    confidence = 0.7
                else:
                    best = max(marked_positions, key=lambda i: row_checks[i].ink_density)
                    if row_checks[best].ink_density > 0.20:
                        opencv_value = str(best + 1)
                        confidence = 0.50
                    else:
                        opencv_value = "NC"
                        confidence = 0.3
            elif num_cbs >= 8:
                # Formadores/Tutores
                mid = num_cbs // 2
                formadores_checks = row_checks[:mid]
                tutores_checks = row_checks[mid:]

                form_marked = [i for i, cb in enumerate(formadores_checks) if cb.state == CheckboxState.MARKED]
                tut_marked = [i for i, cb in enumerate(tutores_checks) if cb.state == CheckboxState.MARKED]

                form_value = "NC"
                form_conf = 0.5
                if len(form_marked) == 1:
                    pos = form_marked[0]
                    form_value = "NC" if pos == 0 else str(pos)
                    form_conf = formadores_checks[pos].confidence

                tut_value = "NC"
                tut_conf = 0.5
                if len(tut_marked) == 1:
                    pos = tut_marked[0]
                    tut_value = "NC" if pos == 0 else str(pos)
                    tut_conf = tutores_checks[pos].confidence

                if field and field.startswith("valoracion_4_"):
                    row_values.append(RowValue(
                        row_index=row_idx,
                        field=field + "_formadores",
                        opencv_value=form_value,
                        num_checkboxes=len(formadores_checks),
                        marked_positions=form_marked,
                        confidence=form_conf,
                    ))
                    row_values.append(RowValue(
                        row_index=row_idx,
                        field=field + "_tutores",
                        opencv_value=tut_value,
                        num_checkboxes=len(tutores_checks),
                        marked_positions=tut_marked,
                        confidence=tut_conf,
                    ))
                    continue
            elif num_cbs in (2, 3):
                # Fila Sí/No
                if len(marked_positions) == 1:
                    pos = marked_positions[0]
                    if num_cbs == 3:
                        opencv_value = ["NC", "Si", "No"][pos] if pos < 3 else "NC"
                    else:
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

    def compare_with_gemini(self, opencv_result: ValidationResult, gemini_data: Dict) -> Dict:
        """Compara resultados OpenCV vs Gemini."""
        opencv_marked = opencv_result.marked_count
        gemini_marked = sum(1 for v in gemini_data.values()
                          if v and v not in [None, "", "NC", "null", "No contesta"])
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
            label = f"R{cb.row}C{cb.col} {cb.ink_density:.2f}"
            cv2.putText(image, label, (cb.x, cb.y - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.3, color, 1)

        # Anotar row_values
        for rv in result.row_values:
            if rv.opencv_value and rv.field:
                # Buscar primer checkbox de esta fila para posición
                row_cbs = [cb for cb in result.checkboxes if cb.row == rv.row_index]
                if row_cbs:
                    ry = row_cbs[0].y + row_cbs[0].h + 12
                    rx = row_cbs[0].x
                    text = f"{rv.field}={rv.opencv_value} ({rv.confidence:.0%})"
                    cv2.putText(image, text, (rx, ry), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 200), 1)

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
    print("FUNDAE OpenCV Validator v2")
    print(f"{'='*60}")

    validator = FUNDAEValidator()
    result = validator.validate_page(image_path)

    print(f"\nResultados: {image_path}")
    print(f"  Filas: {result.total_rows}")
    print(f"  Total: {result.total_checkboxes}")
    print(f"  Marcados: {result.marked_count}")
    print(f"  Vacios: {result.empty_count}")
    print(f"  Inciertos: {result.uncertain_count}")
    print(f"  Tiempo: {result.processing_time_ms:.1f} ms")

    print(f"\nValores por fila:")
    for rv in result.row_values:
        status = "OK" if rv.opencv_value else "??"
        print(f"  [{status}] {rv.field or '???'}: {rv.opencv_value} (cbs={rv.num_checkboxes}, conf={rv.confidence:.0%})")

    if debug_mode:
        debug_path = image_path.replace('.png', '_opencv_debug_v2.png')
        validator.generate_debug_image(image_path, result, debug_path)
        print(f"\nDebug: {debug_path}")

    print(f"\n{'='*60}")
