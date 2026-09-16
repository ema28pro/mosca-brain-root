# Documentación Técnica: `moscabrain/vision/hexagonal_eye.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/vision/hexagonal_eye.py` implementa el modelo de **retina con empaquetamiento hexagonal compacto** (`HexagonalCompoundEye`) y su configuración (`HexagonalLatticeConfig`).

En lugar de calcular aproximaciones polares trigonométricas de campo visual, este módulo emula directamente la microestructura anatómica de la córnea de los insectos: una celosía hexagonal donde las filas alternas se encuentran desplazadas medio ancho de celda ($\Delta x = 0.5 \cdot w_{\text{celda}}$).

Esto permite alimentar capturas de pantalla de computadoras, ventanas de videojuegos o transmisiones de video hacia los ojos de la mosca preservando la resolución espacial facetada nativa.

---

## 2. Importaciones y Justificación

```python
from dataclasses import dataclass
from typing import Tuple, List, Optional, Dict
import numpy as np
```

### Justificación de Importaciones:
1. **`dataclasses.dataclass`**: Declara de forma concisa y tipada la clase de configuración `HexagonalLatticeConfig`.
2. **`typing` (`Tuple`, `List`, `Optional`, `Dict`)**: Anotaciones de tipos para pares de retinas `(left, right)` y firmas de métodos.
3. **`numpy` (`np`)**: Soporta transformaciones matriciales de conversión de color, indexado de parches espaciales mediante slicing 2D y reformateo matricial (`reshape`).

---

## 3. Lógica de Clases y Configuración

### 3.1 Clase `HexagonalLatticeConfig`
- `rows` (*int*): Número de filas hexagonales por ojo (por defecto 6).
- `cols` (*int*): Número de columnas por fila (por defecto 6).
- `sensitivity` (*float*): Ganancia multiplicativa de los fotorreceptores ($1.0$).
- `contrast_boost` (*float*): Realce de bordes y contrastes locales ($1.2$).

---

### 3.2 Clase `HexagonalCompoundEye`

#### Atributos de Estado:
- `config`: Instancia de `HexagonalLatticeConfig`.
- `num_ommatidia_per_eye`: Producto $\text{rows} \times \text{cols}$ (por ejemplo, $6 \times 6 = 36$ omatidios por hemisferio).
- `left_hex_values`, `right_hex_values`: Arrays vectorizados `np.ndarray` unidimensionales de longitud `num_ommatidia_per_eye` con los valores de activación fotónica.

---

## 4. Métodos y Funciones Detalladas

### `HexagonalCompoundEye.capture_screen(frame, stereo_mode="split") -> Tuple[np.ndarray, np.ndarray]`
- **Propósito**: Muestrea un fotograma de pantalla (matriz numpy) sobre las retinas hexagonales de ambos ojos.
- **Entradas**:
  - `frame` (*np.ndarray*): Imagen en escala de grises `(H, W)` o a color `(H, W, 3)`.
  - `stereo_mode` (*str*): `"split"` (divide la imagen a la mitad horizontal para visión estereoscópica panorámica) o `"duplicate"` (la imagen completa se envía a ambos ojos).
- **Salida**: Tupla `(left_hex_array, right_hex_array)` de arrays continuos en `float32`.

---

### `HexagonalCompoundEye.capture_eyes_separately(left_frame, right_frame) -> Tuple[np.ndarray, np.ndarray]`
- **Propósito**: Permite pasar dos fuentes de video independientes para cada ojo (por ejemplo dos cámaras robóticas físicas estéreo).
- **Entradas**: `left_frame` (*np.ndarray*), `right_frame` (*np.ndarray*).
- **Salida**: Tupla `(left_hex_values, right_hex_values)`.

---

### `HexagonalCompoundEye._sample_hexagonal_grid(image: np.ndarray) -> np.ndarray`
- **Algoritmo de Muestreo Hexagonal**:
  1. Convierte a luminancia estándar si la imagen tiene canales de color:
     $$Y = 0.299 R + 0.587 G + 0.114 B$$
  2. Normaliza el rango a $[0.0, 1.0]$.
  3. Divide la imagen en una rejilla donde el ancho efectivo considera el desfase hexagonal:
     $$\text{cell\_h} = \frac{H}{\text{rows}},\quad \text{cell\_w} = \frac{W}{\text{cols} + 0.5}$$
  4. Para cada fila $r$:
     - Si la fila es impar ($r \pmod 2 == 1$), aplica un desplazamiento lateral $\Delta x = 0.5 \cdot \text{cell\_w}$.
     - Extrae el parche espacial `patch = img[y_s:y_e, x_s:x_e]` y calcula el promedio de intensidad fotónica.
  5. Aplica ganancia y realce de contraste acotando a $[0.0, 1.5]$:
     $$\text{val} = \text{clip}(\text{val} \cdot \text{sensitivity} \cdot \text{contrast\_boost}, 0.0, 1.5)$$
- **Salida**: Array 1D de longitud $\text{rows} \times \text{cols}$.

---

### `HexagonalCompoundEye.get_left_grid() -> np.ndarray` y `get_right_grid() -> np.ndarray`
- **Salida**: Reorganiza el vector 1D de fotorreceptores en una matriz 2D con forma `(rows, cols)` para representaciones gráficas y mapas de calor.
