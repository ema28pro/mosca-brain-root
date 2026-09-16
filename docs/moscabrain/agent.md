# Documentación Técnica: `moscabrain/agent.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/agent.py` define la corporización principal de la mosca (*Drosophila melanogaster*) utilizando la topología del conectoma cerebral real de FlyWire (FAFB v783). Actúa como la interfaz de nivel superior que acopla:
- Órganos sensoriales periféricos (ojos compuestos con fotorreceptores retinotópicos y antenas olfativas con glomérulos).
- Neuromodulación por dopamina (sistema de recompensa PAM y aversión PPL1).
- Motor de integración conectómica (dinámica neuronal basada en tasa de disparo y sinapsis biológicas reales).
- Modelo biomecánico y cinemático para locomoción en 2D, giros sacádicos, saltos de escape (*Giant Fiber*) y alimentación/extensión de probóscide.

Adicionalmente, implementa el patrón **Factory** (`FlyAgent`) para alternar limpiamente entre el cerebro cefálico aislado (`FlyWireAgent`) y el sistema nervioso central completo con cordón nervioso ventral (`BANCAgent`).

---

## 2. Importaciones y Justificación

```python
from typing import List, Dict, Optional, Tuple, Union
import numpy as np

from .connectome.circuits import FlyWireConnectomeTopology
from .connectome.dynamics import ConnectomeEngine
from .vision.compound_eye import CompoundEye, VisionConfig
from .vision.hexagonal_eye import HexagonalCompoundEye
from .olfaction.antennal_lobe import AntennalLobe
from .dopamine.system import DopamineSystem
from .body.motor import ActionOutput, ActionState
```

### Justificación de Importaciones:
1. **`typing` (`List`, `Dict`, `Optional`, `Tuple`, `Union`)**: Proporciona anotaciones de tipos estáticos rigurosas para argumentos de sensores, estados de entorno y salidas cinemáticas.
2. **`numpy` (`np`)**: Motor de cálculo vectorial rápido para trigonometría de posición/ángulo ($x, y, \theta$), cálculos de medias de tasas de disparo y modulación de velocidad de giro.
3. **`.connectome.circuits.FlyWireConnectomeTopology`**: Carga los índices, conexiones y mapeos de tipos neuronales (LC4, P9, PAM, PPL1, MN9) sobre la matriz de conectividad cerebral de 15M de sinapsis.
4. **`.connectome.dynamics.ConnectomeEngine`**: Ejecuta las ecuaciones diferenciales de integración y disparo de la red neuronal mediante pasos temporales `dt`.
5. **`.vision.compound_eye.CompoundEye`, `VisionConfig`**: Modela los omatidios fotorreceptores con campo visual angular (FOV), oclusión y detección de amenazas en expansión (*looming*).
6. **`.vision.hexagonal_eye.HexagonalCompoundEye`**: Permite alimentar matrices de imagen directamente (por ejemplo capturas de pantalla o juegos) muestreadas por una rejilla hexagonal facetada sin cálculos polares artificiales.
7. **`.olfaction.antennal_lobe.AntennalLobe`**: Emula las antenas y el lóbulo antenal con 16 glomérulos que codifican perfiles de olores y concentraciones químicas.
8. **`.dopamine.system.DopamineSystem`**: Maneja la dinámica de reforzamiento hedónico/aversivo acoplada al conectoma.
9. **`.body.motor.ActionOutput`, `ActionState`**: Estructuras de datos que representan el comando motor decodificado (empuje hacia adelante, giro angular, probóscide, aleteo Hz, estado de acción).

---

## 3. Lógica de Clases y Arquitectura

### 3.1 Clase `FlyWireAgent` (alias `FlyWireBrainAgent`)
Representa la mosca virtual autónoma orientada al conectoma cerebral de FlyWire.

#### Atributos Principales:
- `connectome_mode`: Modo de operación (`"flywire_brain"` o `"banc"`).
- `topology`: Instancia de `FlyWireConnectomeTopology` con las neuronas identificadas.
- `engine`: Instancia de `ConnectomeEngine` que procesa la red biológica.
- `vision`: Instancia de `CompoundEye` (32 omatidios, FOV 270° por defecto).
- `hex_vision`: Instancia de `HexagonalCompoundEye` (muestreo 6x6 foveal/periférico).
- `olfaction`: Instancia de `AntennalLobe` (16 glomérulos).
- `dopamine`: Instancia de `DopamineSystem`.
- `x`, `y`, `angle`, `speed`: Coordenadas cartesianas en píxeles/unidades de arena, orientación en radianes y velocidad escalar actual.
- `is_feeding`, `feeding_counter`: Bandera y contador de extensión de probóscide.

---

### 3.2 Clase `FlyAgent` (Patrón Factory)
Clase despachadora que implementa `__new__` para evitar duplicidad de instancias y permitir seleccionar bajo demanda:
- `BANCAgent` cuando `connectome_mode == "banc"`.
- `FlyWireAgent` cuando `connectome_mode == "flywire_brain"`.

---

## 4. Métodos y Funciones Detalladas

### `FlyWireAgent.__init__(dt=0.002, num_ommatidia=32, num_glomeruli=16, fov_horizontal=270.0)`
- **Entradas**:
  - `dt` (*float*): Paso de integración temporal en segundos (por defecto `0.002s` = 2ms).
  - `num_ommatidia` (*int*): Cantidad de fotorreceptores visuales por defecto (32).
  - `num_glomeruli` (*int*): Glomérulos olfativos simulados (16).
  - `fov_horizontal` (*float*): Ángulo horizontal de visión en grados (270.0°).
- **Salida**: Nueva instancia inicializada con todos los subsistemas sensoriales y motores vinculados.

---

### `FlyWireAgent.start_feeding()` / `stop_feeding()`
- **Propósito**: Controla el reflejo de alimentación de la probóscide. Al alimentarse (`start_feeding`), la mosca frena a velocidad 0 y fija el estado motor. Al detenerse (`stop_feeding`), limpia el sesgo motor en el motor y reinicia el lóbulo olfativo.
- **Entradas / Salidas**: Ninguna (`None`).

---

### `FlyWireAgent.reward(amount=1.0, reason="recompensa")`
- **Propósito**: Inyecta dopamina positiva activando los grupos PAM (*Protocerebral Anterior Medial*).
- **Entradas**: `amount` (*float*), `reason` (*str*).
- **Salida**: `None`.

---

### `FlyWireAgent.punish(amount=1.0, reason="castigo")` / `aversion(...)`
- **Propósito**: Inyecta señal aversiva activando los grupos PPL1 (*Protocerebral Posterior Lateral 1*).
- **Entradas**: `amount` (*float*), `reason` (*str*).
- **Salida**: `None`.

---

### `FlyWireAgent.stimulate_sugar(intensity=1.5)`
- **Propósito**: Estimula de forma directa las neuronas gustativas receptoras de sacarosa (Sugar GRNs).
- **Entradas**: `intensity` (*float*).

---

### `FlyWireAgent.step(...) -> ActionOutput`
El ciclo fundamental sensoriomotor por paso de simulación:
1. **Entradas**:
   - `light_sources` (*Optional[List[Dict]]*): Lista de puntos de luz con `x, y, intensity`.
   - `threats` (*Optional[List[Dict]]*): Objetos amenazantes con `x, y, radius, speed`.
   - `odor_signal` (*Optional[Dict]*): Concentración química y diferencial antena izquierda/derecha.
   - `odor_name` (*Optional[str]*): Nombre del olor ambiental.
   - `symbol` (*Optional[str]*): Símbolo o etiqueta categórica.
   - `substeps` (*int*): Sub-iteraciones de integración conectómica por tick del entorno (por defecto 1).
2. **Procesamiento**:
   - Procesa los omatidios y señales de *looming* mediante `vision.process_environment`.
   - Modula el lóbulo antenal con `olfaction.expose_odor` o `encode_symbol`.
   - Inyecta corrientes a fotorreceptores R1-R6, glomérulos olfativos y neuronas LC4 (*looming*).
   - Integra la dinámica conectómica con `engine.step()`.
   - Decodifica las tasas de disparo de las neuronas descendientes de marcha P9 y salto de escape DNp01/Giant Fiber.
   - Aplica cinemática corporal con frenado sacádico en giros (`_update_physics`).
3. **Salida**:
   - Objeto `ActionOutput` con:
     - `forward_thrust`: Empuje hacia adelante `[0.0, 1.0]`.
     - `turn_yaw`: Giro angular `[-1.0, 1.0]` (negativo izq, positivo der).
     - `proboscis_extended`: Booleano de alimentación.
     - `escape_jump`: Booleano de salto brusco de escape ante depredador.
     - `wingbeat_hz`: Frecuencia de aleteo en Hz (0 en reposo/marcha, 210Hz en salto/vuelo).
     - `state`: Enumeración `ActionState` (`IDLE`, `WALKING`, `TURNING_LEFT`, `TURNING_RIGHT`, `ESCAPE_JUMP`, `FEEDING`).

---

### `FlyWireAgent.step_screen(screen_frame, stereo_mode="split", substeps=5) -> Tuple[float, float, bool]`
- **Propósito**: Interfaz directa para alimentar matrices visuales en 2D (p. ej. imágenes de videojuegos o entornos externos) al ojo hexagonal sin simulación trigonométrica de arena.
- **Entradas**:
  - `screen_frame` (*np.ndarray*): Imagen en escala de grises o RGB.
  - `stereo_mode` (*str*): `"split"` (mitad izquierda/derecha) o `"duplicate"`.
  - `substeps` (*int*): Ciclos de propagación neuronal (por defecto 5).
- **Salida**: Tupla `(forward_thrust, turn_yaw, escape_jump)`.

---

### `FlyWireAgent._update_physics(action: ActionOutput)`
- **Lógica Interna**: Aplica aceleración y velocidad angular. Implementa la regla biológica de **modulación sacádica** (Rayshubskiy et al., 2020): al ejecutar un giro acentuado, las patas interiores se frenan, reduciendo la velocidad de avance (`turn_penalty`). En saltos de escape aplica un impulso instantáneo de 18 unidades.

---

### `FlyWireAgent.get_telemetry() -> dict`
- **Salida**: Diccionario completo serializable a JSON con:
  - `position`: `x`, `y`, `angle`.
  - `speed`: Velocidad lineal actual.
  - `vision`: FOV, conteo de omatidios, vista de retina y señal de *looming*.
  - `olfaction`: Nombre del olor, concentración y actividad de los 16 glomérulos.
  - `dopamine`: Nivel actual, recompensas totales y castigos acumulados.
  - `brain`: Snapshot de telemetría de tasas de disparo y actividad sináptica del conectoma.
