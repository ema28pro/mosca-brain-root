# Documentación Técnica: `moscabrain/bridge/controller.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/bridge/controller.py` implementa la clase `GameBridge`, una capa de abstracción para conectar el cerebro biológico de la mosca (*FlyWire* o *BANC*) con entornos externos de software y videojuegos (tales como emuladores de Doom, Super Mario, Pong, Flappy Bird o simuladores robóticos).

Sus responsabilidades son:
- Recibir matrices de imágenes del juego (`game_frame` en formato numpy).
- Distribuir la imagen hacia las retinas hexagonales según el modo estereoscópico (`split` o `duplicate`).
- Traducir el disparo de las neuronas descendientes motoras reales (P9 para dirección y avance; Fibra Gigante para salto) en pulsaciones de teclas virtuales (`UP`, `LEFT`, `RIGHT`, `SPACE`, `ENTER`).
- Proporcionar ganchos (*callbacks*) de recompensa hedónica (`reward`) y castigo (`punish`/`aversion`) para condicionamiento operante.

---

## 2. Importaciones y Justificación

```python
from typing import Dict, List, Optional, Callable, Any
import numpy as np
from ..agent import FlyAgent
from ..body.motor import ActionOutput, ActionState
```

### Justificación de Importaciones:
1. **`typing` (`Dict`, `List`, `Optional`, `Callable`, `Any`)**: Define firmas estrictas para callbacks de teclado `Callable[[str, bool], None]`, diccionarios de asignación de teclas y matrices de fotogramas.
2. **`numpy` (`np`)**: Representa la estructura de entrada de los fotogramas del juego `(H, W)` o `(H, W, 3)` para su inyección a la retina.
3. **`..agent.FlyAgent`**: Agente biológico que integra la visión, olfato y conectoma.
4. **`..body.motor.ActionOutput`, `ActionState`**: Tipos auxiliares de respuesta cinemática.

---

## 3. Lógica de Clases y Arquitectura

### Clase `GameBridge`
Controlador bidireccional entre la pantalla del juego y los nervios motores.

#### Atributos Principales:
- `fly`: Instancia de `FlyAgent` (por defecto inicializada si no se pasa externamente).
- `stereo_mode`: Modo de proyección visual (`"split"` o `"duplicate"`).
- `key_bindings`: Diccionario de asignación de acciones biológicas a nombres de teclas:
  - `"FORWARD"` $\rightarrow$ `"UP"`
  - `"STEER_LEFT"` $\rightarrow$ `"LEFT"`
  - `"STEER_RIGHT"` $\rightarrow$ `"RIGHT"`
  - `"JUMP_ESCAPE"` $\rightarrow$ `"SPACE"`
  - `"ACTION_FEED"` $\rightarrow$ `"ENTER"`
- `forward_threshold` ($0.2$): Umbral mínimo de activación de P9 para considerar la tecla de avance presionada.
- `steer_threshold` ($0.25$): Umbral de asimetría para viraje izquierdo o derecho.
- `pressed_keys`: Estado booleano instantáneo de cada tecla (`True`/`False`).
- `_on_key_press_callbacks`: Lista de funciones que se notifican cada vez que una tecla cambia de estado.

---

## 4. Métodos y Funciones Detalladas

### `GameBridge.__init__(fly_agent=None, stereo_mode="split")`
- **Entradas**:
  - `fly_agent` (*Optional[FlyAgent]*): Agente existente o `None` para crear uno nuevo.
  - `stereo_mode` (*str*): `"split"` o `"duplicate"`.

---

### `GameBridge.bind_key(fly_action: str, key_name: str)`
- **Propósito**: Reconfigura el mapeo de teclas personalizándolo para cada juego (por ejemplo mapear `"FORWARD"` a `"W"` o `"BUTTON_A"`).
- **Entradas**: `fly_action` (*str*), `key_name` (*str*).

---

### `GameBridge.set_stereo_mode(mode: str)`
- **Propósito**: Modifica cómo se proyecta el videojuego en los dos ojos compuestos:
  - `"split"`: El ojo izquierdo percibe la mitad izquierda de la pantalla; el derecho percibe la mitad derecha (visión panorámica y binocular).
  - `"duplicate"`: La imagen completa se reescala y se envía a ambos ojos en paralelo.
- **Excepciones**: Lanza `ValueError` si el modo no es uno de los permitidos.

---

### `GameBridge.step_frame(game_frame, odor_stimulus=None, substeps=5) -> Dict[str, bool]`
- **Propósito**: Procesa un cuadro de video del juego a través del conectoma y resuelve las teclas activas.
- **Lógica Paso a Paso**:
  1. Si se provee `odor_stimulus`, expone el lóbulo antenal al olor químico asociado (ej. `"enemigo"`, `"pocion"`).
  2. Llama a `fly.step_screen(game_frame, stereo_mode, substeps)` para propagar los fotones a través de los omatidios y las 15M de sinapsis.
  3. Evalúa la respuesta de las neuronas descendientes:
     - Si $fwd > 0.2$ activa la tecla asignada a `FORWARD`.
     - Si $yaw < -0.25$ activa `STEER_LEFT`.
     - Si $yaw > 0.25$ activa `STEER_RIGHT`.
     - Si $escape == True$ activa `JUMP_ESCAPE`.
  4. Dispara los callbacks registrados pasando `(nombre_tecla, estado_booleano)`.
- **Entradas**:
  - `game_frame` (*np.ndarray*): Matriz bidimensional o tridimensional de píxeles.
  - `odor_stimulus` (*Optional[str]*): Estímulo químico contextual.
  - `substeps` (*int*): Ciclos de propagación neuronal (por defecto 5).
- **Salida**: Diccionario `Dict[str, bool]` con el estado de cada tecla (ej. `{"UP": True, "LEFT": False, ...}`).

---

### `GameBridge.reward(amount=1.0, reason="juego_punto_ganado")`
- **Propósito**: Dispara un pulso de dopamina en el conectoma cuando el jugador-mosca consigue una meta en el juego.

---

### `GameBridge.punish(amount=1.0, reason="juego_colision_muerte")` / `aversion(...)`
- **Propósito**: Dispara una señal aversiva PPL1 cuando la mosca recibe daño o muere en el juego.

---

### `GameBridge.expose_odor(odor_name: str, concentration: float = 1.0)`
- **Propósito**: Inyecta una señal olfativa persistente vinculada al estado del juego.
