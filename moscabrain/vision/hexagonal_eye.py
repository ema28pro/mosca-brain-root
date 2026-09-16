"""
MoscaBrain: Ojo Compuesto Hexagonal Directo (Hexagonal Retina Screen Capture).
Permite capturar la pantalla directamente como una cuadrícula hexagonal de omatidios
sin cálculos de FOV ni trigonometría sintética, exactamente como el ojo compuesto
de Drosophila muestrea una imagen 2D o ventana de juego.
"""

from dataclasses import dataclass
from typing import Tuple
import numpy as np


@dataclass
class HexagonalLatticeConfig:
    rows: int = 6              # Número de filas de hexágonos
    cols: int = 6              # Número de columnas por fila
    sensitivity: float = 1.0   # Ganancia de los fotorreceptores
    contrast_boost: float = 1.2


class HexagonalCompoundEye:
    """
    Ojo compuesto que muestrea imágenes o pantallas directamente usando una red hexagonal.
    Puede operar en:
      - Modo 'split': divide la pantalla en mitad izquierda (ojo izq) y derecha (ojo der).
      - Modo 'duplicate': ambos ojos reciben la imagen completa muestreada en hexágonos.
      - Modo 'separate': alimenta imágenes independientes a cada ojo.
    """

    def __init__(self, rows: int = 6, cols: int = 6, sensitivity: float = 1.0):
        self.config = HexagonalLatticeConfig(rows=rows, cols=cols, sensitivity=sensitivity)
        self.num_ommatidia_per_eye = rows * cols
        self.left_hex_values = np.zeros(self.num_ommatidia_per_eye, dtype=np.float32)
        self.right_hex_values = np.zeros(self.num_ommatidia_per_eye, dtype=np.float32)

    def capture_screen(
        self,
        frame: np.ndarray,
        stereo_mode: str = "split",  # "split" o "duplicate"
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Muestrea un fotograma de pantalla (juego, cámara o ventana)
        en las retinas hexagonales del ojo izquierdo y derecho.

        Args:
            frame: array numpy (H, W) o (H, W, 3)
            stereo_mode: 'split' (pantalla dividida izq/der) o 'duplicate' (pantalla completa a ambos)

        Returns:
            (left_hex_array, right_hex_array) cada uno de tamaño (rows * cols)
        """
        arr = np.asarray(frame, dtype=np.float32)
        if arr.ndim == 3:
            # Luminancia estándar
            arr = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        if arr.max() > 1.0:
            arr = arr / 255.0

        h, w = arr.shape

        if stereo_mode == "split":
            mid = w // 2
            left_img = arr[:, :mid]
            right_img = arr[:, mid:]
        else:
            left_img = arr
            right_img = arr

        self.left_hex_values = self._sample_hexagonal_grid(left_img)
        self.right_hex_values = self._sample_hexagonal_grid(right_img)

        return self.left_hex_values, self.right_hex_values

    def capture_eyes_separately(
        self,
        left_frame: np.ndarray,
        right_frame: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Permite suministrar una imagen o captura diferente a cada ojo."""
        self.left_hex_values = self._sample_hexagonal_grid(left_frame)
        self.right_hex_values = self._sample_hexagonal_grid(right_frame)
        return self.left_hex_values, self.right_hex_values

    def _sample_hexagonal_grid(self, image: np.ndarray) -> np.ndarray:
        """
        Muestrea una imagen usando empaquetamiento hexagonal (offset de medio paso en filas pares/impares).
        """
        img = np.asarray(image, dtype=np.float32)
        if img.ndim == 3:
            img = 0.299 * img[:, :, 0] + 0.587 * img[:, :, 1] + 0.114 * img[:, :, 2]
        if img.max() > 1.0:
            img = img / 255.0

        h, w = img.shape
        r_count = self.config.rows
        c_count = self.config.cols
        values = np.zeros(r_count * c_count, dtype=np.float32)

        # Dimensiones de cada celda hexagonal
        cell_h = h / max(1, r_count)
        cell_w = w / max(1, c_count + 0.5)

        idx = 0
        for r in range(r_count):
            # En empaquetamiento hexagonal, las filas alternas se desplazan 0.5 celda a la derecha
            row_offset = 0.5 * cell_w if (r % 2 == 1) else 0.0
            y_start = int(r * cell_h)
            y_end = max(y_start + 1, int((r + 1) * cell_h))

            for c in range(c_count):
                x_start = int(c * cell_w + row_offset)
                x_end = max(x_start + 1, int((c + 1) * cell_w + row_offset))

                # Clampear a las dimensiones de la imagen
                x_s = max(0, min(w - 1, x_start))
                x_e = max(x_s + 1, min(w, x_end))
                y_s = max(0, min(h - 1, y_start))
                y_e = max(y_s + 1, min(h, y_end))

                # Promediar el bloque hexagonal
                patch = img[y_s:y_e, x_s:x_e]
                mean_val = float(np.mean(patch)) if patch.size > 0 else 0.0
                values[idx] = mean_val
                idx += 1

        return np.clip(values * self.config.sensitivity * self.config.contrast_boost, 0.0, 1.5)

    def get_left_grid(self) -> np.ndarray:
        return self.left_hex_values.reshape((self.config.rows, self.config.cols))

    def get_right_grid(self) -> np.ndarray:
        return self.right_hex_values.reshape((self.config.rows, self.config.cols))
