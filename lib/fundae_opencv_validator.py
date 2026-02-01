"""
FUNDAE OpenCV Validator - Módulo de Producción v3
Validación determinista de checkboxes para formularios FUNDAE.

v3: Enfoque GRID FIJO. El formulario FUNDAE siempre tiene el mismo layout.
    En vez de detectar contornos (frágil), localizamos la tabla de valoraciones
    por las cabeceras "NC 1 2 3 4" y muestreamos densidad en posiciones fijas.

Requisitos:
    pip install opencv-python-headless numpy
"""

import cv2
import numpy as np
from dataclasses import dataclass, field
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
    """Validador OpenCV para formularios FUNDAE v3 - Grid fijo."""

    # Campos FUNDAE en orden de aparición en la página 2
    FIELDS = [
        # Sección 1: Organización
        {"field": "valoracion_1_1", "type": "scale"},
        {"field": "valoracion_1_2", "type": "scale"},
        # Sección 2: Contenidos
        {"field": "valoracion_2_1", "type": "scale"},
        {"field": "valoracion_2_2", "type": "scale"},
        # Sección 3: Duración
        {"field": "valoracion_3_1", "type": "scale"},
        {"field": "valoracion_3_2", "type": "scale"},
        # Sección 4: Formadores/Tutores (doble)
        {"field": "valoracion_4_1_formadores", "type": "scale"},
        {"field": "valoracion_4_1_tutores", "type": "scale"},
        {"field": "valoracion_4_2_formadores", "type": "scale"},
        {"field": "valoracion_4_2_tutores", "type": "scale"},
        # Sección 5: Medios
        {"field": "valoracion_5_1", "type": "scale"},
        {"field": "valoracion_5_2", "type": "scale"},
        # Sección 6: Instalaciones
        {"field": "valoracion_6_1", "type": "scale"},
        {"field": "valoracion_6_2", "type": "scale"},
        # Sección 7: Teleformación
        {"field": "valoracion_7_1", "type": "scale"},
        {"field": "valoracion_7_2", "type": "scale"},
        # Sección 8: Evaluación (Sí/No)
        {"field": "valoracion_8_1", "type": "yesno"},
        {"field": "valoracion_8_2", "type": "yesno"},
        # Sección 9: Valoración general
        {"field": "valoracion_9_1", "type": "scale"},
        {"field": "valoracion_9_2", "type": "scale"},
        {"field": "valoracion_9_3", "type": "scale"},
        {"field": "valoracion_9_4", "type": "scale"},
        {"field": "valoracion_9_5", "type": "scale"},
        # Sección 10: Satisfacción
        {"field": "valoracion_10", "type": "scale"},
    ]

    CONFIG = {
        # Tamaño de la zona de muestreo para cada casilla (en píxeles)
        "sample_size": 16,
        # Margen interior para evitar bordes
        "sample_margin": 4,
        # Umbral para considerar marcada (densidad relativa vs fila)
        "marked_ratio_threshold": 2.5,
        # Umbral absoluto mínimo para marcada
        "marked_abs_threshold": 0.08,
        # Umbral para empty absoluto
        "empty_abs_threshold": 0.03,
    }

    def __init__(self, config: Optional[Dict] = None):
        self.config = {**self.CONFIG, **(config or {})}

    def validate_page(self, image_path: str) -> ValidationResult:
        """Valida una página de formulario FUNDAE usando detección de grid."""
        import time
        start = time.time()

        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"No se pudo cargar: {image_path}")

        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Paso 1: Encontrar las filas de casillas usando detección de líneas horizontales
        rows_info = self._find_checkbox_rows(gray, w, h)

        if not rows_info:
            # Fallback: no se encontraron filas
            return ValidationResult(
                total_checkboxes=0, total_rows=0,
                marked_count=0, empty_count=0, uncertain_count=0,
                checkboxes=[], row_values=[],
                processing_time_ms=(time.time() - start) * 1000
            )

        # Paso 2: Para cada fila, encontrar las casillas por espaciado regular
        checkboxes = []
        all_row_densities = []

        for row_idx, row_info in enumerate(rows_info):
            row_cbs, densities = self._sample_row(gray, row_info, row_idx)
            checkboxes.extend(row_cbs)
            all_row_densities.append(densities)

        # Paso 3: Clasificar usando densidad relativa
        for row_idx, densities in enumerate(all_row_densities):
            row_cbs = [cb for cb in checkboxes if cb.row == row_idx]
            self._classify_row(row_cbs, densities)

        marked = [c for c in checkboxes if c.state == CheckboxState.MARKED]
        empty = [c for c in checkboxes if c.state == CheckboxState.EMPTY]
        uncertain = [c for c in checkboxes if c.state == CheckboxState.UNCERTAIN]

        row_values = self._compute_row_values(checkboxes, rows_info)

        return ValidationResult(
            total_checkboxes=len(checkboxes),
            total_rows=len(rows_info),
            marked_count=len(marked),
            empty_count=len(empty),
            uncertain_count=len(uncertain),
            checkboxes=checkboxes,
            row_values=row_values,
            processing_time_ms=(time.time() - start) * 1000
        )

    def _find_checkbox_rows(self, gray: np.ndarray, w: int, h: int) -> List[Dict]:
        """
        Encuentra las filas de casillas buscando líneas horizontales de la tabla.
        Retorna lista de dicts con: y_center, x_start, x_end, num_cols
        """
        # Binarizar
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Detectar líneas horizontales largas (> 30% del ancho)
        h_len = int(w * 0.25)
        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_len, 1))
        h_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel)

        # Encontrar posiciones Y de las líneas horizontales
        h_projection = np.sum(h_lines, axis=1) / 255
        line_ys = []
        in_line = False
        line_start = 0

        for y in range(len(h_projection)):
            if h_projection[y] > w * 0.1:  # línea significativa
                if not in_line:
                    line_start = y
                    in_line = True
            else:
                if in_line:
                    line_ys.append((line_start + y) // 2)
                    in_line = False

        if len(line_ys) < 3:
            return []

        # Detectar líneas verticales en la zona derecha (donde están las casillas)
        # Las casillas están típicamente en el 55% derecho
        roi_x = int(w * 0.50)
        roi_binary = binary[:, roi_x:]
        roi_w = roi_binary.shape[1]

        v_len = int(h * 0.02)  # líneas verticales cortas (entre filas)
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_len))
        v_lines = cv2.morphologyEx(roi_binary, cv2.MORPH_OPEN, v_kernel)

        # Para cada par de líneas horizontales consecutivas, buscar columnas verticales
        rows_info = []
        for i in range(len(line_ys) - 1):
            y_top = line_ys[i]
            y_bot = line_ys[i + 1]
            row_height = y_bot - y_top

            # Filas demasiado altas o bajas no son de checkboxes
            if row_height < 15 or row_height > 80:
                continue

            y_center = (y_top + y_bot) // 2

            # Proyección vertical en esta franja para encontrar columnas
            row_strip = v_lines[y_top:y_bot, :]
            v_projection = np.sum(row_strip, axis=0) / 255

            # Encontrar posiciones X de separadores verticales
            col_xs = []
            in_col = False
            col_start = 0
            for x in range(len(v_projection)):
                if v_projection[x] > row_height * 0.3:
                    if not in_col:
                        col_start = x
                        in_col = True
                else:
                    if in_col:
                        col_xs.append(roi_x + (col_start + x) // 2)
                        in_col = False

            # Necesitamos al menos 4 separadores para tener 3+ casillas
            if len(col_xs) >= 4:
                # Calcular centros de casillas (entre separadores)
                cell_centers = []
                for j in range(len(col_xs) - 1):
                    cx = (col_xs[j] + col_xs[j + 1]) // 2
                    cw = col_xs[j + 1] - col_xs[j]
                    if 8 < cw < 60:  # ancho razonable para casilla
                        cell_centers.append({"x": cx, "w": cw})

                if len(cell_centers) >= 2:
                    rows_info.append({
                        "y_center": y_center,
                        "y_top": y_top,
                        "y_bot": y_bot,
                        "cells": cell_centers,
                        "num_cols": len(cell_centers),
                    })

        return rows_info

    def _sample_row(self, gray: np.ndarray, row_info: Dict, row_idx: int) -> Tuple[List[DetectedCheckbox], List[float]]:
        """Muestrea la densidad de tinta en cada casilla de la fila."""
        checkboxes = []
        densities = []

        y_center = row_info["y_center"]
        y_top = row_info["y_top"]
        y_bot = row_info["y_bot"]
        row_h = y_bot - y_top
        margin = self.config["sample_margin"]

        for col_idx, cell in enumerate(row_info["cells"]):
            cx = cell["x"]
            cw = cell["w"]

            # Zona de muestreo: interior de la celda
            sample_h = max(4, row_h - margin * 2)
            sample_w = max(4, cw - margin * 2)
            x1 = cx - sample_w // 2
            x2 = cx + sample_w // 2
            y1 = y_center - sample_h // 2
            y2 = y_center + sample_h // 2

            # Clamp
            y1 = max(0, y1)
            y2 = min(gray.shape[0], y2)
            x1 = max(0, x1)
            x2 = min(gray.shape[1], x2)

            if y2 <= y1 or x2 <= x1:
                densities.append(0.0)
                checkboxes.append(DetectedCheckbox(
                    x=x1, y=y1, w=x2-x1, h=y2-y1,
                    row=row_idx, col=col_idx,
                    state=CheckboxState.UNCERTAIN, confidence=0.0, ink_density=0.0
                ))
                continue

            roi = gray[y1:y2, x1:x2]
            _, bin_roi = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

            # Eliminar líneas dentro de la celda
            rh, rw = bin_roi.shape
            if rh >= 3 and rw >= 3:
                hl = max(3, int(rw * 0.8))
                vl = max(3, int(rh * 0.8))
                h_k = cv2.getStructuringElement(cv2.MORPH_RECT, (hl, 1))
                v_k = cv2.getStructuringElement(cv2.MORPH_RECT, (1, vl))
                h_l = cv2.morphologyEx(bin_roi, cv2.MORPH_OPEN, h_k)
                v_l = cv2.morphologyEx(bin_roi, cv2.MORPH_OPEN, v_k)
                mask = cv2.bitwise_or(h_l, v_l)
                bin_roi = cv2.subtract(bin_roi, mask)

            density = np.sum(bin_roi == 255) / max(bin_roi.size, 1)
            densities.append(density)

            checkboxes.append(DetectedCheckbox(
                x=x1, y=y1, w=x2-x1, h=y2-y1,
                row=row_idx, col=col_idx,
                state=CheckboxState.UNCERTAIN,  # se clasifica después
                confidence=0.0, ink_density=density
            ))

        return checkboxes, densities

    def _classify_row(self, row_cbs: List[DetectedCheckbox], densities: List[float]):
        """Clasifica casillas usando densidad relativa dentro de la fila."""
        if not densities or not row_cbs:
            return

        sorted_d = sorted(densities)
        # Mediana = densidad típica de casilla vacía
        median = sorted_d[len(sorted_d) // 2]
        max_d = sorted_d[-1]

        for cb in row_cbs:
            d = cb.ink_density

            # Absoluto: claramente marcada
            if d > self.config["marked_abs_threshold"] and d > median * self.config["marked_ratio_threshold"]:
                cb.state = CheckboxState.MARKED
                cb.confidence = min(0.95, 0.70 + d)
            elif d < self.config["empty_abs_threshold"]:
                cb.state = CheckboxState.EMPTY
                cb.confidence = 0.90
            elif median > 0 and d < median * 1.3:
                # Cerca de la mediana = vacía
                cb.state = CheckboxState.EMPTY
                cb.confidence = 0.75
            elif median > 0 and d > median * self.config["marked_ratio_threshold"] and d > 0.06:
                cb.state = CheckboxState.MARKED
                cb.confidence = 0.70
            else:
                cb.state = CheckboxState.UNCERTAIN
                cb.confidence = 0.50

    def _compute_row_values(self, checkboxes: List[DetectedCheckbox], rows_info: List[Dict]) -> List[RowValue]:
        """Determina el valor de cada fila basado en las casillas clasificadas."""
        row_values = []
        field_idx = 0

        for row_idx, row_info in enumerate(rows_info):
            row_cbs = sorted(
                [cb for cb in checkboxes if cb.row == row_idx],
                key=lambda c: c.x
            )
            num_cbs = len(row_cbs)

            marked_positions = [i for i, cb in enumerate(row_cbs) if cb.state == CheckboxState.MARKED]

            # Determinar campo
            field = None
            if field_idx < len(self.FIELDS):
                field_info = self.FIELDS[field_idx]
                field = field_info["field"]
                field_type = field_info.get("type", "scale")
            else:
                field_type = "scale"

            # Determinar valor según tipo y número de casillas
            opencv_value = None
            confidence = 0.0

            if num_cbs >= 8:
                # Formadores/Tutores: dos grupos
                mid = num_cbs // 2
                form_cbs = row_cbs[:mid]
                tut_cbs = row_cbs[mid:]

                form_marked = [i for i, cb in enumerate(form_cbs) if cb.state == CheckboxState.MARKED]
                tut_marked = [i for i, cb in enumerate(tut_cbs) if cb.state == CheckboxState.MARKED]

                form_value, form_conf = self._resolve_scale(form_cbs, form_marked)
                tut_value, tut_conf = self._resolve_scale(tut_cbs, tut_marked)

                # Formadores
                form_field = field + "_formadores" if field and not field.endswith("_formadores") else field
                if field and "_formadores" in field:
                    form_field = field
                elif field:
                    form_field = field.replace(field.split("_")[-1], "") + "formadores" if "formadores" not in field else field

                # Usar los campos del FIELDS directamente
                if field_idx < len(self.FIELDS):
                    row_values.append(RowValue(
                        row_index=row_idx,
                        field=self.FIELDS[field_idx]["field"],
                        opencv_value=form_value,
                        num_checkboxes=len(form_cbs),
                        marked_positions=form_marked,
                        confidence=form_conf,
                    ))
                    field_idx += 1

                if field_idx < len(self.FIELDS):
                    row_values.append(RowValue(
                        row_index=row_idx,
                        field=self.FIELDS[field_idx]["field"],
                        opencv_value=tut_value,
                        num_checkboxes=len(tut_cbs),
                        marked_positions=tut_marked,
                        confidence=tut_conf,
                    ))
                    field_idx += 1
                continue

            elif field_type == "yesno" or num_cbs in (2, 3):
                if len(marked_positions) == 1:
                    pos = marked_positions[0]
                    if num_cbs == 3:
                        opencv_value = ["NC", "Si", "No"][pos] if pos < 3 else "NC"
                    elif num_cbs == 2:
                        opencv_value = ["Si", "No"][pos] if pos < 2 else "NC"
                    else:
                        opencv_value = "NC"
                    confidence = row_cbs[pos].confidence if pos < len(row_cbs) else 0.3
                else:
                    opencv_value = "NC"
                    confidence = 0.3
            else:
                # Escala 1-4 (con posible NC)
                opencv_value, confidence = self._resolve_scale(row_cbs, marked_positions)

            row_values.append(RowValue(
                row_index=row_idx,
                field=field,
                opencv_value=opencv_value,
                num_checkboxes=num_cbs,
                marked_positions=marked_positions,
                confidence=confidence,
            ))
            field_idx += 1

        return row_values

    def _resolve_scale(self, cbs: List[DetectedCheckbox], marked: List[int]) -> Tuple[Optional[str], float]:
        """Resuelve el valor para una escala NC,1,2,3,4."""
        num = len(cbs)
        if num == 0:
            return None, 0.0

        if len(marked) == 1:
            pos = marked[0]
            if num == 5:
                # NC(0), 1(1), 2(2), 3(3), 4(4)
                value = "NC" if pos == 0 else str(pos)
            elif num == 4:
                # Probablemente 1(0), 2(1), 3(2), 4(3)
                value = str(pos + 1)
            elif num == 3:
                # Podría ser parcial
                value = str(pos + 1) if pos < 4 else "NC"
            else:
                value = str(pos + 1) if pos < 4 else "NC"
            return value, cbs[pos].confidence
        elif len(marked) == 0:
            return "NC", 0.8
        else:
            # Múltiples marcas: elegir la de mayor densidad si es claramente dominante
            best_idx = max(marked, key=lambda i: cbs[i].ink_density)
            best_d = cbs[best_idx].ink_density
            second_best = sorted([cbs[i].ink_density for i in marked])[-2] if len(marked) > 1 else 0

            if best_d > second_best * 2.0 and best_d > 0.10:
                pos = best_idx
                if num == 5:
                    value = "NC" if pos == 0 else str(pos)
                elif num == 4:
                    value = str(pos + 1)
                else:
                    value = str(pos + 1) if pos < 4 else "NC"
                return value, 0.55
            return "NC", 0.3

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

        for cb in result.checkboxes:
            if cb.state == CheckboxState.MARKED:
                color = (0, 255, 0)
            elif cb.state == CheckboxState.EMPTY:
                color = (255, 0, 0)
            else:
                color = (0, 165, 255)

            cv2.rectangle(image, (cb.x, cb.y), (cb.x + cb.w, cb.y + cb.h), color, 2)
            label = f"{cb.ink_density:.3f}"
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
    print("FUNDAE OpenCV Validator v3 - Grid Detection")
    print(f"{'='*60}")

    validator = FUNDAEValidator()
    result = validator.validate_page(image_path)

    print(f"\nResultados: {image_path}")
    print(f"  Filas: {result.total_rows}")
    print(f"  Total checkboxes: {result.total_checkboxes}")
    print(f"  Marcados: {result.marked_count}")
    print(f"  Vacios: {result.empty_count}")
    print(f"  Inciertos: {result.uncertain_count}")
    print(f"  Tiempo: {result.processing_time_ms:.1f} ms")

    print(f"\nValores por fila:")
    for rv in result.row_values:
        status = "OK" if rv.opencv_value and rv.opencv_value != "NC" else ("NC" if rv.opencv_value == "NC" else "??")
        print(f"  [{status}] {rv.field or '???'}: {rv.opencv_value} (cbs={rv.num_checkboxes}, conf={rv.confidence:.0%})")

    if debug_mode:
        debug_path = image_path.replace('.png', '_opencv_debug_v3.png')
        validator.generate_debug_image(image_path, result, debug_path)
        print(f"\nDebug: {debug_path}")

    print(f"\n{'='*60}")
