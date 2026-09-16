# Documentación Técnica: `examples/play_game.py`

## 1. Propósito General del Módulo
El script de ejemplo `examples/play_game.py` enseña a los desarrolladores cómo conectar cualquier videojuego (en 2D o 3D) al conectoma cerebral de MoscaBrain utilizando la clase `GameBridge`.

Muestra el flujo completo de:
1. **Configuración de Visión**: Elección entre visión estéreo dividida (`split`) o visión duplicada (`duplicate`).
2. **Mapeo de Teclas**: Vinculación de neuronas motoras biológicas (avance, dirección, salto de escape) a teclas del teclado del juego (`UP`, `LEFT`, `RIGHT`, `SPACE`).
3. **Alimentación de Cuadros**: Envío iterativo de matrices RGB de la pantalla al cerebro mediante `bridge.step_frame`.
4. **Ciclo de Recompensa/Castigo**: Integración de llamadas a `bridge.reward(...)` o `bridge.punish(...)` ante eventos del juego (monedas recogidas, obstáculos superados o colisiones).

---

## 2. Importaciones y Justificación

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import time
from moscabrain import GameBridge, FlyAgent
```

### Justificación de Importaciones:
1. **`sys`, `pathlib.Path`**: Inclusión del directorio raíz en `sys.path` para ejecución directa.
2. **`numpy` (`np`)**: Creación sintética de arrays tridimensionales `uint8` para representar la pantalla del juego.
3. **`moscabrain` (`GameBridge`, `FlyAgent`)**: Componentes para conectar y decodificar el conectoma en pulsaciones de teclas.

---

## 3. Funciones Detalladas

### `create_mock_game_screen(width=160, height=120, obstacle_x=80, player_y=60) -> np.ndarray`
- **Propósito**: Genera un fotograma RGB sintético de $160 \times 120$ píxeles simulando un juego tipo *Flappy Bird* o *Runner 2D*:
  - Cielo/Fondo oscuro: `[15, 20, 30]`.
  - Suelo inferior: `[40, 50, 70]`.
  - Obstáculo vertical verde en movimiento: `[50, 220, 100]`.
  - Cuadrado dorado que representa al jugador: `[255, 200, 50]`.
- **Salida**: Array `np.ndarray` con dimensiones `(120, 160, 3)` y tipo `uint8`.

---

### `main()`
- **Flujo de Ejecución**:
  1. Instancia `GameBridge(stereo_mode="split")`.
  2. Asocia acciones biológicas a teclas:
     - `FORWARD` $\rightarrow$ `UP`
     - `STEER_LEFT` $\rightarrow$ `LEFT`
     - `STEER_RIGHT` $\rightarrow$ `RIGHT`
     - `JUMP_ESCAPE` $\rightarrow$ `SPACE`
     - `ACTION_FEED` $\rightarrow$ `ENTER`
  3. Ejecuta un bucle de 10 fotogramas:
     - Desplaza el obstáculo hacia la izquierda.
     - Genera la imagen y la envía con `bridge.step_frame(screen)`.
     - Si el obstáculo está cerca ($20 \le x \le 50$), expone opcionalmente las antenas a un olor de alarma: `bridge.expose_odor("humo_repelente")`.
     - Interpreta las teclas devueltas en el diccionario `pressed_keys`: si detecta `SPACE` o `UP`, eleva la posición del jugador; si no, aplica gravedad.
     - Si la mosca supera el obstáculo, suma puntos y premia al conectoma con dopamina: `bridge.reward(amount=1.5, reason="obstaculo_superado")`.
