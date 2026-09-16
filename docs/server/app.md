# Documentación Técnica: `server/app.py`

## 1. Propósito General del Módulo
El archivo `server/app.py` implementa el servidor principal de la aplicación basado en **FastAPI**. Proporciona la infraestructura de comunicación de baja latencia entre el backend de simulación conectómica en Python y el frontend en React (Cockpit web).

Responsabilidades principales:
- Servir la interfaz web estática de React compilada en `dist/` (o fallback a `web_server/dist`).
- Montar las rutas estáticas y endpoints del simulador conectómico BANC en `/banc/`.
- Ofrecer una conexión bidireccional continua por **WebSocket (`/ws`)** a 30-60 FPS para streaming de telemetría de la arena, activación de fotorreceptores, tasas de disparo neuronales y cinemática corporal.
- Exponer endpoints REST para inyección de dopamina, configuración visual retinotópica, estimulación olfativa, cambio de escenarios, manipulación interactiva de objetos (añadir, mover, borrar comida/luces/sombras) y partidas de Blackjack/21 conducidas por el conectoma.

---

## 2. Importaciones y Justificación

```python
import asyncio
import os
from pathlib import Path
from typing import Dict, List, Optional
import random
import numpy as np

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from moscabrain import FlyAgent, SimulationArena
```

### Justificación de Importaciones:
1. **`asyncio`**: Gestión de tareas concurrentes asíncronas, bucle de streaming no bloqueante y colas de mensajes (`asyncio.Queue`) para procesar comandos entrantes sin congelar el renderizado.
2. **`pathlib.Path`**: Resolución de rutas relativas hacia `dist/`, `web_server/dist/` y `web_banc/`.
3. **`typing` y `pydantic.BaseModel`**: Validación estricta y automática de esquemas de datos JSON en el cuerpo de las peticiones HTTP.
4. **`random`, `numpy`**: Lógica de barajas y probabilidad estocástica en el minijuego de Blackjack.
5. **`fastapi`**: Framework web ASGI de alto rendimiento.
6. **`moscabrain` (`FlyAgent`, `SimulationArena`)**: Núcleo biológico del simulador y entorno 2D.

---

## 3. Esquemas de Datos Pydantic (Modelos de Entrada)

- **`DopamineRequest`**:
  - `amount` (*float*, def `1.0`): Magnitud del pulso.
  - `is_reward` (*bool*, def `True`): `True` = PAM (azúcar/éxito), `False` = PPL1 (castigo).
  - `reason` (*str*, def `"web_cockpit"`): Motivo del evento.
- **`VisionRequest`**:
  - `fov_horizontal`, `ommatidia_count`, `sensitivity`: Parámetros de visión a modificar.
- **`OlfactionRequest`**:
  - `odor_name` (*str*), `symbol` (*str*), `concentration` (*float*).
- **`ScenarioRequest`**:
  - `scenario` (*str*): Nombre del escenario preconfigurado.
- **`AddStimulusRequest`** / **`RemoveStimulusRequest`** / **`MoveStimulusRequest`**:
  - Parámetros espaciales `(x, y, id, type, radius, old_x, old_y)` para arrastrar, crear o eliminar ítems en la arena interactiva.
- **`ClearStimulusRequest`**:
  - `target` (*str*, def `"all"`): Filtro de borrado (`"all"`, `"food"`, `"light"`, `"threat"`).
- **`ConnectomeModeRequest`**:
  - `mode` (*str*): `"banc"` o `"flywire_brain"`.

---

## 4. Endpoints de la API REST

### `GET /api/status`
- **Propósito**: Consulta síncrona del estado completo de la arena y telemetría de la mosca.
- **Retorno**: Diccionario `arena.get_state()`.

### `POST /api/dopamine`
- **Propósito**: Inyecta un pulso dopaminérgico manual.
- **Retorno**: `{"success": True, "dopamine_level": float, "reason": str}`.

### `POST /api/vision`
- **Propósito**: Modifica el FOV, cantidad de omatidios o sensibilidad del ojo compuesto.

### `POST /api/olfaction`
- **Propósito**: Expone a la mosca a un olor conocido o símbolo químico.

### `GET /api/connectome/mode` y `POST /api/connectome/mode`
- **Propósito**: Consulta o alterna en caliente el modo conectómico (`"banc"` Whole-CNS vs `"flywire_brain"` FAFB v783).

### `POST /api/scenario`
- **Propósito**: Cambia el escenario de la arena (`"alimento_dopamina"`, `"escape_depredador"`, `"fototaxis_luz"`, etc.).

### `POST /api/reset_bias` y `GET /api/reset_bias`
- **Propósito**: Elimina la histéresis motora y resetea las corrientes del conectoma.

### `POST /api/stimulus/add`, `/remove`, `/move`, `/clear`
- **Propósito**: Gestión dinámica de estímulos físicos y químicos desde la interfaz de usuario.

### `POST /api/blackjack/round`
- **Propósito**: Ejecuta una mano completa de 21 Blackjack donde el conectoma decide autónomamente pedir carta o plantarse:
  - Codifica el puntaje y carta visible del croupier en el lóbulo antenal (`encode_blackjack_hand`).
  - Evalúa la diferencia entre MBON apetitivas y aversivas ($MBON_{\text{approach}} - MBON_{\text{avoid}}$).
  - Si gana: inyecta dopamina positiva ($+1.5$). Si pierde o se pasa de 21: inyecta castigo aversivo ($-0.8$).

---

## 5. Protocolo de Comunicación WebSocket (`/ws`)

El canal `/ws` gestiona la simulación continua a $\approx 30\text{ FPS}$ ($33\text{ ms}$ por cuadro):
1. **Manejo Desacoplado de Comandos**: Utiliza una cola asíncrona interna (`asyncio.Queue`) con un worker en segundo plano (`rx_worker`) para recibir comandos JSON (`move_fly`, `set_fly_pose`, `move_threat`, `reward`, `punish`, `pause`, `resume`, `step_frame`) sin bloquear la tasa de refresco.
2. **Pacing Dinámico**: Mide con precisión de microsegundos (`time.perf_counter()`) el tiempo de cómputo del conectoma `elapsed` y ajusta `sleep_time = max(0.002, 0.033 - elapsed)`.
3. **Payload Emitido**: Envía en cada tick el estado de la arena, vector de acción motora, telemetría conectómica de BANC o FlyWire y latencia de cálculo en milisegundos (`compute_ms`).
