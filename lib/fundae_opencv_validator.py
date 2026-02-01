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
        "roi_x_percent": 0.62,
        "checkbox_min_size": 14,
        "checkbox_max_size": 40,
        "aspect_ratio_min": 0.75,
        "aspect_ratio_max": 1.30,
        "solidity_min": 0.70,
        "binary_block_size": 21,
        "binary_c": 12,
        "row_tolerance_px": 20,
        "min_checkboxes_per_row": 2,
        "max_checkboxes_per_row": 8,
        "interior_margin_percent": 0.35,
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
        print(f"[DIAG] Imagen: {w}x{h}, ROI desde x={roi_x} ({self.config['roi_x_percent']*100:.0f}%)")

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

        # Enfoque directo: usar TODOS los candidatos de cada fila.
        # Encontrar la marca (densidad máxima) y determinar su valor
        # por posición relativa en la fila (no por subconjuntos).
        checkboxes = []
        row_values = []
        for row_idx, row_cbs in enumerate(rows):
            # Calcular densidades
            densities = []
            for cb in row_cbs:
                _, _, density = self._classify(gray, cb)
                densities.append(density)

            # Encontrar la marca
            max_d = max(densities) if densities else 0
            max_idx = densities.index(max_d) if densities else -1
            median_d = sorted(densities)[len(densities) // 2] if densities else 0
            max_is_marked = (max_d >= median_d * 1.5 and max_d > 0.15)

            # Diagnóstico
            field_name = self.ROW_TO_FIELD[row_idx] if row_idx < len(self.ROW_TO_FIELD) else f"row_{row_idx}"
            dens_str = " ".join([f"{d:.3f}{'M' if i == max_idx and max_is_marked else 'E'}" for i, d in enumerate(densities)])
            print(f"[DENS] {field_name} ({len(row_cbs)}cb): {dens_str}")

            for col_idx, (cb, density) in enumerate(zip(row_cbs, densities)):
                if col_idx == max_idx and max_is_marked:
                    state = CheckboxState.MARKED
                    confidence = min(0.95, 0.75 + density)
                else:
                    state = CheckboxState.EMPTY
                    confidence = min(0.95, 0.85)
                checkboxes.append(DetectedCheckbox(
                    x=cb['x'], y=cb['y'], w=cb['w'], h=cb['h'],
                    row=row_idx, col=col_idx,
                    state=state, confidence=confidence, ink_density=density
                ))

            # Determinar valor por posición relativa de la marca
            field = self.ROW_TO_FIELD[row_idx] if row_idx < len(self.ROW_TO_FIELD) else None

            if not max_is_marked:
                # Sin marca → NC
                row_values.append(RowValue(
                    row_index=row_idx, field=field, opencv_value="NC",
                    num_checkboxes=len(row_cbs), marked_positions=[], confidence=0.95
                ))
                continue

            # Posición relativa de la marca: 0.0 = extremo izquierdo, 1.0 = extremo derecho
            marked_cb = row_cbs[max_idx]
            first_x = row_cbs[0]['x']
            last_x = row_cbs[-1]['x']
            span = last_x - first_x
            if span > 0:
                rel_pos = (marked_cb['x'] - first_x) / span
            else:
                rel_pos = 0.5

            # Mapear posición relativa a escala NC,1,2,3,4
            # NC está a la izquierda (rel_pos ~0.0), 4 a la derecha (rel_pos ~1.0)
            # Dividir en 5 zonas iguales
            if rel_pos < 0.1:
                value = "NC"
            elif rel_pos < 0.3:
                value = "1"
            elif rel_pos < 0.5:
                value = "2"
            elif rel_pos < 0.7:
                value = "3"
            else:
                value = "4"

            print(f"[MAP] {field}: marca en pos {max_idx}/{len(row_cbs)}, rel_pos={rel_pos:.2f} -> valor={value}")

            # Para formadores/tutores (4_1, 4_2): si hay 2 marcas, dividir en 2 grupos
            if field and field.startswith("valoracion_4_") and len(row_cbs) >= 8:
                # Buscar las 2 marcas más altas
                sorted_by_dens = sorted(enumerate(densities), key=lambda x: x[1], reverse=True)
                marks = [(i, d) for i, d in sorted_by_dens if d > 0.15][:2]
                if len(marks) == 2:
                    marks.sort(key=lambda x: x[0])  # ordenar por posición
                    mid = len(row_cbs) // 2
                    for mark_idx, (mi, md) in enumerate(marks):
                        sub_field = field + ("_formadores" if mi < mid else "_tutores")
                        sub_first = row_cbs[0 if mi < mid else mid]['x']
                        sub_last = row_cbs[mid-1 if mi < mid else -1]['x']
                        sub_span = sub_last - sub_first
                        if sub_span > 0:
                            sub_rel = (row_cbs[mi]['x'] - sub_first) / sub_span
                        else:
                            sub_rel = 0.5
                        if sub_rel < 0.1:
                            sub_val = "NC"
                        elif sub_rel < 0.3:
                            sub_val = "1"
                        elif sub_rel < 0.5:
                            sub_val = "2"
                        elif sub_rel < 0.7:
                            sub_val = "3"
                        else:
                            sub_val = "4"
                        print(f"[MAP] {sub_field}: rel_pos={sub_rel:.2f} -> valor={sub_val}")
                        row_values.append(RowValue(
                            row_index=row_idx, field=sub_field, opencv_value=sub_val,
                            num_checkboxes=len(row_cbs), marked_positions=[mi], confidence=min(0.95, 0.75 + md)
                        ))
                    continue

            row_values.append(RowValue(
                row_index=row_idx, field=field, opencv_value=value,
                num_checkboxes=len(row_cbs), marked_positions=[max_idx], confidence=min(0.95, 0.75 + max_d)
            ))

        marked = [c for c in checkboxes if c.state == CheckboxState.MARKED]
        empty = [c for c in checkboxes if c.state == CheckboxState.EMPTY]
        uncertain = [c for c in checkboxes if c.state == CheckboxState.UNCERTAIN]

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
        rejected = {"size": 0, "aspect": 0, "solidity": 0, "rectangularity": 0}
        total = len(contours)
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            if not (self.config["checkbox_min_size"] <= w <= self.config["checkbox_max_size"]):
                rejected["size"] += 1
                continue
            if not (self.config["checkbox_min_size"] <= h <= self.config["checkbox_max_size"]):
                rejected["size"] += 1
                continue
            aspect = w / h
            if not (self.config["aspect_ratio_min"] <= aspect <= self.config["aspect_ratio_max"]):
                rejected["aspect"] += 1
                continue
            area = cv2.contourArea(c)
            solidity = area / (w * h) if w * h > 0 else 0
            if solidity < self.config["solidity_min"]:
                rejected["solidity"] += 1
                continue

            # Rectangularidad: las casillas reales se aproximan a un polígono de 4+ vértices
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) < 4 or len(approx) > 12:
                rejected["rectangularity"] += 1
                continue

            candidates.append({'x': x + roi_x, 'y': y, 'w': w, 'h': h})
        print(f"[DIAG] Contornos totales: {total} | Pasan filtros: {len(candidates)} | Rechazados: size={rejected['size']} aspect={rejected['aspect']} solidity={rejected['solidity']} rect={rejected['rectangularity']}")
        return candidates

    def _clean_row(self, row: List[Dict], max_count: int, row_y: int) -> List[Dict]:
        """
        Limpia una fila con demasiados candidatos.
        Prueba subconjuntos de tamaños FUNDAE válidos (5, 8, 4, 2) tomando
        los N más a la derecha, y elige el que tenga mejor regularidad de espaciado.
        """
        if len(row) <= max_count:
            return row

        best_row = None
        best_score = float('inf')
        best_n = 0

        for n in [5, 8, 4, 2]:
            if n > len(row):
                continue
            # Tomar los N más a la derecha
            candidate = sorted(row, key=lambda cb: cb['x'], reverse=True)[:n]
            candidate = sorted(candidate, key=lambda cb: cb['x'])
            if len(candidate) < 2:
                continue
            # Evaluar regularidad del espaciado (CV más bajo = mejor)
            centers = [cb['x'] + cb['w'] // 2 for cb in candidate]
            gaps = [centers[i+1] - centers[i] for i in range(len(centers) - 1)]
            mean_gap = sum(gaps) / len(gaps) if gaps else 1
            if mean_gap > 0:
                gap_std = (sum((g - mean_gap)**2 for g in gaps) / len(gaps))**0.5
                gap_cv = gap_std / mean_gap
            else:
                gap_cv = 999
            # Score: gap_cv penalizado por tamaño.
            # n=2 con 1 gap siempre da cv=0, es trampa → penalización alta
            if n == 2:
                penalty = 1.5  # solo gana si no hay otra opción viable
            elif n == 4:
                penalty = 0.35  # n=4 es subconjunto de n=5 con mejor CV artificial
            elif n == 8:
                penalty = 0.30
            else:  # n == 5, el estándar FUNDAE
                penalty = 0.0
            score = gap_cv + penalty
            print(f"[DIAG]   subconjunto n={n}: gap_cv={gap_cv:.2f} penalty={penalty:.2f} score={score:.2f}")
            if score < best_score:
                best_score = score
                best_row = candidate
                best_n = n

        if best_row:
            print(f"[DIAG] Fila y={row_y}: limpieza {len(row)} -> {best_n} (gap_cv={best_score:.2f}, elegido mejor subconjunto)")
            return best_row
        # Fallback: los max_count más a la derecha
        kept = sorted(row, key=lambda cb: cb['x'], reverse=True)[:max_count]
        return sorted(kept, key=lambda cb: cb['x'])

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
        valid_rows = []
        total_rows = len(rows_dict)
        for key, v in sorted(rows_dict.items()):
            if len(v) < min_per_row:
                print(f"[DIAG] Fila y={key}: {len(v)} candidatos -> RECHAZADA (< {min_per_row})")
                continue
            row = sorted(v, key=lambda x: x['x'])
            print(f"[DIAG] Fila y={key}: {len(row)} candidatos raw -> ACEPTADA")
            valid_rows.append(row)
        print(f"[DIAG] Filas agrupadas: {total_rows} | Válidas: {len(valid_rows)}")

        valid_rows.sort(key=lambda row: row[0]['y'])
        return valid_rows

    def _align_to_columns(self, rows: List[List[Dict]], gray: np.ndarray) -> List[List[Dict]]:
        """
        Para filas con >5 candidatos: tomar las 5 más a la derecha (las casillas
        reales NC,1,2,3,4 están siempre en la zona derecha de la tabla).
        Para filas con >8: tomar las 8 más a la derecha (formadores/tutores).
        """
        aligned_rows = []
        for row in rows:
            if len(row) <= 5:
                aligned_rows.append(row)
                continue
            # Elegir el mejor N (5 u 8) basado en las últimas N más a la derecha
            rightmost_5 = sorted(row, key=lambda cb: cb['x'])[-5:]
            rightmost_8 = sorted(row, key=lambda cb: cb['x'])[-8:] if len(row) >= 8 else None

            # Evaluar gap_cv de cada subconjunto
            def gap_cv(subset):
                centers = [cb['x'] + cb['w'] // 2 for cb in subset]
                gaps = [centers[i+1] - centers[i] for i in range(len(centers) - 1)]
                mg = sum(gaps) / len(gaps) if gaps else 1
                if mg <= 0: return 999
                gs = (sum((g - mg)**2 for g in gaps) / len(gaps))**0.5
                return gs / mg

            cv5 = gap_cv(rightmost_5)
            cv8 = gap_cv(rightmost_8) if rightmost_8 else 999

            # Preferir 5 (estándar), elegir 8 solo si tiene mejor espaciado
            if rightmost_8 and cv8 + 0.30 < cv5:
                chosen = rightmost_8
                n = 8
            else:
                chosen = rightmost_5
                n = 5

            print(f"[DIAG] Fila y={row[0]['y']}: {len(row)} -> {n} (cv5={cv5:.2f} cv8={cv8:.2f})")
            aligned_rows.append(chosen)
        return aligned_rows

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

        # Umbral fijo en vez de Otsu: más conservador, evita amplificar ruido
        # Píxeles < 160 son tinta real (negro/gris oscuro), > 160 es fondo/ruido
        _, bin_interior = cv2.threshold(interior, 160, 255, cv2.THRESH_BINARY_INV)

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

            # Diagnóstico: densidades por casilla
            densities_str = " ".join([f"{cb.ink_density:.3f}{'M' if cb.state == CheckboxState.MARKED else 'E' if cb.state == CheckboxState.EMPTY else '?'}" for cb in row_checks])
            field_name = self.ROW_TO_FIELD[row_idx] if row_idx < len(self.ROW_TO_FIELD) else f"row_{row_idx}"
            print(f"[DENS] {field_name} ({num_cbs}cb): {densities_str}")

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
            # Múltiples: la de mayor densidad gana si es dominante (30%+ más)
            best = max(marked, key=lambda i: cbs[i].ink_density)
            densities = sorted([cbs[i].ink_density for i in marked], reverse=True)
            if len(densities) >= 2 and densities[0] > densities[1] * 1.3:
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
            if len(densities) >= 2 and densities[0] > densities[1] * 1.3:
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
