# Documentación Técnica: `server/tetris_server.py`

## 1. Propósito General del Módulo
El archivo `server/tetris_server.py` implementa un servidor de inferencia neuronal en tiempo real dedicado exclusivamente al juego de **Tetris** interactivo (controlado vía Three.js o canvas web).

Opera en un proceso y puerto independiente (**puerto 8001**) para garantizar:
- Aislamiento total de recursos respecto al servidor de la arena principal (puerto 8000).
- Latencia inferior a 10 ms por decisión motora.
- Soporte dual para ejecutar el cerebro completo de FlyWire (138k neuronas) o el subcircuito motor de BANC (Whole-CNS, predeterminado mediante la variable de entorno `AGENT_MODE="banc"`).
- Inyección multisensorial simultánea: omatidios retinianos (visión del tablero) y olor químico asociado a cada tetrominó ($I, O, T, S, Z, J, L$).
- Decodificación estocástica de acciones (Softmax con temperatura modulada por sobresalto aversivo).

---

## 2. Importaciones y Justificación

```python
import asyncio
import time
from typing import Dict, List, Optional
import numpy as np

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os

from moscabrain import FlyAgent, FlyWireAgent, BANCAgent
```

### Justificación de Importaciones:
1. **`asyncio`, `time`**: Medición de latencia de inferencia con `time.perf_counter()` y gestión de conexiones concurrentes WebSocket.
2. **`numpy` (`np`)**: Transformación vectorial de probabilidades mediante función exponencial Softmax con temperatura biológica (`np.exp`), promedios de actividad de DNa/P9 y muestreo estocástico acumulado.
3. **`fastapi`, `uvicorn`**: Servidor ASGI en el puerto 8001.
4. **`os`**: Lectura de la variable de entorno `AGENT_MODE` para seleccionar el modo por defecto (`"banc"` o `"flywire_brain"`).
5. **`moscabrain`**: Modelos de agentes conectómicos corporizados.

---

## 3. Modelos Pydantic y Esquemas de Petición

- **`AgentModeRequest`**:
  - `mode` (*str*): `"flywire_brain"` o `"banc"`.
- **`StepRequest`**:
  - `left_eye`, `right_eye` (*Optional[List[float]]*): Vectores de luminosidad de los omatidios.
  - `piece_type` (*Optional[str]*): Identificador de la pieza actual (`"I"`, `"O"`, `"T"`, `"S"`, `"Z"`, `"J"`, `"L"`).
  - `odor_glomeruli` (*Optional[List[float]]*): Vector opcional de activación del lóbulo antenal.
  - `substeps` (*int*, def `1`): Subciclos de integración conectómica por tick.
  - `olfaction_enabled` (*bool*, def `True`): Bandera para activar/desactivar la quimiorrecepción.
- **`DopamineTriggerRequest`**:
  - `amount` (*float*), `reason` (*str*).

---

## 4. Endpoints REST y Modos de Operación

### `GET /api/agent/mode` y `POST /api/agent/mode`
- **Propósito**: Consulta o conmuta en caliente el agente biológico que juega al Tetris entre BANC Whole-CNS y FlyWire Brain.

### `GET /api/status`
- **Propósito**: Reporte de salud del motor: modo activo, número de neuronas y sinapsis cargadas en memoria, nivel de dopamina y conteo de espigas recientes.

### `POST /api/reward`, `/api/punish`, `/api/aversion`
- **Propósito**: Canales para enviar refuerzo hedónico (línea completada en Tetris $\rightarrow$ `reward`) o castigo aversivo (muerte / Game Over $\rightarrow$ `aversion`).

### `POST /api/step`
- **Propósito**: Ejecuta un paso síncrono de inferencia motora vía REST invocando `_process_neural_step`.

---

## 5. Algoritmo de Inferencia Sensoriomotora (`_process_neural_step`)

La función central traduce la percepción en cuatro canales de juego de Tetris:
- Acción `0`: Desplazar a la izquierda (`p9_left`).
- Acción `1`: Desplazar a la derecha (`p9_right`).
- Acción `2`: Rotar pieza (`rot`).
- Acción `3`: Caída rápida (`drop`).

### Lógica Biofísica:
1. **Modo BANC (Whole-CNS)**:
   - Proyecta la luminosidad ocular sobre la excitación de avance de DNp09 (`forward_drive_hz`).
   - Si la luminosidad excede $0.3$, simula amenaza en la Fibra Gigante.
   - Si la motoneurona de salto `TTMn` dispara, asigna alta probabilidad de rotación (`score_rot = 3.5`). La tasa motora regula la caída (`score_drop`).
2. **Modo FlyWire (Cerebro 15M de Sinapsis)**:
   - Inyecta los omatidios retinianos al lóbulo óptico y el olor de la pieza al lóbulo antenal.
   - Avanza de 1 a 4 subticks conectómicos (`fly.engine.step()`).
   - Lee las tasas de disparo de $P9_L, P9_R$, $DNa_L, DNa_R$, Giant Fiber, PPL1 y MBON-Avoid.
   - **Modulación por Sobresalto y Aversión**:
     Si hay arousal aversivo (tras un Game Over o error grave), la mosca entra en pánico motor: se disparan los virajes y rotaciones convulsivas (`score_rot`, `score_left`, `score_right`) y se inhibe la caída rápida (`drop_inhibition = 1 / (1 + 4 \cdot \text{arousal})`).
   - **Softmax con Temperatura Adaptativa**:
     $$\text{temp} = \text{clip}(0.8 + 1.5 \cdot \text{arousal}, 0.4, 3.2)$$
     $$\text{probs} = \frac{\exp((\text{scores} - \max)/\text{temp})}{\sum \exp((\text{scores} - \max)/\text{temp})}$$
   - Selecciona estocásticamente la acción resultante según la distribución `probs`.

---

## 6. Canal WebSocket Full-Duplex (`/ws/tetris`)
- Conexión persistente para juegos web a 60 FPS.
- Permite enviar mensajes JSON continuos con `command: "step"` y recibir inmediatamente el índice de acción, vector de probabilidades `[p_left, p_right, p_rot, p_drop]`, nivel de dopamina y latencia de inferencia `compute_ms`.
- Soporta comandos de recompensa inmediata (`"reward"`), castigo (`"punish"`) y reseteo general (`"reset"`).
