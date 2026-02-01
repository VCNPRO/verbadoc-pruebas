"""
FUNDAE OpenCV Validator - Módulo de Producción v1.1
Validación determinista de checkboxes para formularios FUNDAE.

v1.1: Umbrales calibrados con datos reales.
      Gap natural entre ruido (max 0.1364) y marca real (min 0.2143).
      Corte en 0.17 para máxima separación.

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
    """Validador OpenCV para formularios FUNDAE v1.1 - Calibrado."""

    ROW_TO_FIELD = [
        "valoracion_1_1",
        "valoracion_1_2",
        "valoracion_2_1",
        "valoracion_2_2",
        "valoracion_3_1",
        "valoracion_3_2",
        "valoracion_4_1",           # formadores + tutores
        "valoracion_4_2",           # formadores + tutores
        "valoracion_5_1",
        "valoracion_5_2",
        "valoracion_6_1",
        "valoracion_6_2",
        "valoracion_7_1",
        "valoracion_7_2",
        "valoracion_8_1",           # Sí/No
        "valoracion_8_2",           # Sí/No
        "valoracion_9_1",
        "valoracion_9_2",
        "valoracion_9_3",
        "valoracion_9_4",
        "valoracion_9_5",
        "valoracion_10",
    ]

    # Calibrado con datos reales:
    # - Vacías: 0.0165 - 0.1364
    # - Gap:    0.1364 - 0.2143
    # - Marcadas: 0.2143 - 0.4318
    CONFIG = {
        "roi_x_percent": 0.55,
        "checkbox_min_size": 12,
        "checkbox_max_size": 45,
        "aspect_ratio_min": 0.7,
        "aspect_ratio_max": 1.35,
        "solidity_min": 0.65,
        "binary_block_size": 21,
        "binary_c": 12,
        "row_tolerance_px": 20,
        "min_checkboxes_per_row": 2,
        "max_checkboxes_per_row": 12,
        "interior_margin_percent": 0.28,
        # Umbrales calibrados con gap natural
        "density_marked_threshold": 0.17,   # por encima = marcada (gap empieza en 0.1364)
        "density_empty_threshold": 0.14,    # por debajo = vacía (ruido máx 0.1364)
        # Zona uncertain: 0.14 - 0.17 (muy estrecha, solo 0.03 de margen)
        "size_std_max_ratio": 0.4,
    }

    def __init__(self, config: Optional[Dict] = None):
        self.config = {**self.CONFIG, **(config or {})}

    def validate_page(self, image_path: str) -> ValidationResult:
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
            cy = c['y'] + c['h'] // 2
            # Buscar fila existente cercana
            placed = False
            for key in list(rows_dict.keys()):
                if abs(cy - key) <= tolerance:
                    rows_dict[key].append(c)
                    placed = True
                    break
            if not placed:
                rows_dict[cy].append(c)

        min_per_row = self.config["min_checkboxes_per_row"]
        max_per_row = self.config["max_checkboxes_per_row"]
        valid_rows = []
        for v in rows_dict.values():
            if len(v) < min_per_row or len(v) > max_per_row:
                continue
            row = sorted(v, key=lambda x: x['x'])
            # Filtro de uniformidad de tamaño
            sizes = [cb['w'] * cb['h'] for cb in row]
            mean_size = sum(sizes) / len(sizes)
            if mean_size > 0:
                std_ratio = (sum((s - mean_size)**2 for s in sizes) / len(sizes))**0.5 / mean_size
                if std_ratio > self.config["size_std_max_ratio"]:
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

        # Eliminar líneas de bordes de tabla dentro del checkbox
        ih, iw = bin_interior.shape
        if ih >= 3 and iw >= 3:
            h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (iw, 1))
            v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, ih))
            h_lines = cv2.morphologyEx(bin_interior, cv2.MORPH_OPEN, h_kernel)
            v_lines = cv2.morphologyEx(bin_interior, cv2.MORPH_OPEN, v_kernel)
            lines_mask = cv2.bitwise_or(h_lines, v_lines)
            bin_interior = cv2.subtract(bin_interior, lines_mask)

        dark_pixels = np.sum(bin_interior == 255)
        ink_density = dark_pixels / bin_interior.size

        if ink_density >= self.config["density_marked_threshold"]:
            confidence = min(0.95, 0.75 + ink_density)
            return CheckboxState.MARKED, confidence, ink_density
        elif ink_density <= self.config["density_empty_threshold"]:
            confidence = min(0.95, 0.80 + (self.config["density_empty_threshold"] - ink_density))
            return CheckboxState.EMPTY, confidence, ink_density
        else:
            # Zona uncertain muy estrecha (0.14-0.17)
            return CheckboxState.UNCERTAIN, 0.50, ink_density

    def _compute_row_values(self, rows: List[List[Dict]], checkboxes: List[DetectedCheckbox]) -> List[RowValue]:
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
                opencv_value, confidence = self._resolve_scale_5(row_checks, marked_positions)
            elif num_cbs == 4:
                opencv_value, confidence = self._resolve_scale_4(row_checks, marked_positions)
            elif num_cbs >= 8:
                # Formadores/Tutores
                mid = num_cbs // 2
                form_checks = row_checks[:mid]
                tut_checks = row_checks[mid:]
                form_marked = [i for i, cb in enumerate(form_checks) if cb.state == CheckboxState.MARKED]
                tut_marked = [i for i, cb in enumerate(tut_checks) if cb.state == CheckboxState.MARKED]

                if len(form_checks) == 5:
                    form_val, form_conf = self._resolve_scale_5(form_checks, form_marked)
                else:
                    form_val, form_conf = self._resolve_scale_4(form_checks, form_marked)

                if len(tut_checks) == 5:
                    tut_val, tut_conf = self._resolve_scale_5(tut_checks, tut_marked)
                else:
                    tut_val, tut_conf = self._resolve_scale_4(tut_checks, tut_marked)

                if field and field.startswith("valoracion_4_"):
                    row_values.append(RowValue(
                        row_index=row_idx, field=field + "_formadores",
                        opencv_value=form_val, num_checkboxes=len(form_checks),
                        marked_positions=form_marked, confidence=form_conf,
                    ))
                    row_values.append(RowValue(
                        row_index=row_idx, field=field + "_tutores",
                        opencv_value=tut_val, num_checkboxes=len(tut_checks),
                        marked_positions=tut_marked, confidence=tut_conf,
                    ))
                    continue
            elif num_cbs in (2, 3):
                # Sí/No
                if len(marked_positions) == 1:
                    pos = marked_positions[0]
                    if num_cbs == 3:
                        opencv_value = ["NC", "Si", "No"][pos] if pos < 3 else "NC"
                    else:
                        opencv_value = ["Si", "No"][pos] if pos < 2 else "NC"
                    confidence = row_checks[pos].confidence
                else:
                    opencv_value = "NC"
                    confidence = 0.4

            row_values.append(RowValue(
                row_index=row_idx, field=field,
                opencv_value=opencv_value, num_checkboxes=num_cbs,
                marked_positions=marked_positions, confidence=confidence,
            ))

        return row_values

    def _resolve_scale_5(self, cbs: List[DetectedCheckbox], marked: List[int]) -> Tuple[Optional[str], float]:
        """NC(0), 1(1), 2(2), 3(3), 4(4)"""
        if len(marked) == 1:
            pos = marked[0]
            value = "NC" if pos == 0 else str(pos)
            return value, cbs[pos].confidence
        elif len(marked) == 0:
            return "NC", 0.80
        else:
            # Múltiples: la de mayor densidad gana si es claramente dominante
            best = max(marked, key=lambda i: cbs[i].ink_density)
            densities = sorted([cbs[i].ink_density for i in marked], reverse=True)
            if len(densities) >= 2 and densities[0] > densities[1] * 1.8:
                value = "NC" if best == 0 else str(best)
                return value, 0.60
            return "NC", 0.30

    def _resolve_scale_4(self, cbs: List[DetectedCheckbox], marked: List[int]) -> Tuple[Optional[str], float]:
        """1(0), 2(1), 3(2), 4(3) — falta NC"""
        if len(marked) == 1:
            pos = marked[0]
            return str(pos + 1), cbs[pos].confidence * 0.90
        elif len(marked) == 0:
            return "NC", 0.75
        else:
            best = max(marked, key=lambda i: cbs[i].ink_density)
            densities = sorted([cbs[i].ink_density for i in marked], reverse=True)
            if len(densities) >= 2 and densities[0] > densities[1] * 1.8:
                return str(best + 1), 0.55
            return "NC", 0.30

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
            label = f"R{cb.row}C{cb.col} {cb.ink_density:.3f}"
            cv2.putText(image, label, (cb.x, cb.y - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.3, color, 1)

        for rv in result.row_values:
            if rv.field:
                row_cbs = [cb for cb in result.checkboxes if cb.row == rv.row_index]
                if row_cbs:
                    ry = row_cbs[0].y + row_cbs[0].h + 12
                    rx = row_cbs[0].x
                    val = rv.opencv_value or "??"
                    text = f"{rv.field}={val} ({rv.confidence:.0%})"
                    cv2.putText(image, text, (rx, ry), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 200), 1)

        cv2.imwrite(output_path, image)


def validate_fundae_page(image_path: str) -> Dict:
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
    print("FUNDAE OpenCV Validator v1.1 - Calibrated")
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
        status = "OK" if rv.opencv_value and rv.opencv_value != "NC" else ("NC" if rv.opencv_value == "NC" else "??")
        print(f"  [{status}] {rv.field or '???'}: {rv.opencv_value} (cbs={rv.num_checkboxes}, conf={rv.confidence:.0%})")

    if debug_mode:
        debug_path = image_path.replace('.png', '_debug.png')
        validator.generate_debug_image(image_path, result, debug_path)
        print(f"\nDebug: {debug_path}")

    print(f"\n{'='*60}")
