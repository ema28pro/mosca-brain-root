# Documentación Técnica: `server/banc_api.py`

## 1. Propósito General del Módulo
El archivo `server/banc_api.py` implementa la API REST y el servidor web dedicado para el simulador de conectoma **BANC v888** (*Brain and Nerve Cord*).

Puede utilizarse de dos formas:
1. **Router Integrado (`router = APIRouter(prefix="/api/banc")`)**: Es consumido directamente por el servidor principal de FastAPI en `server/app.py` para exponer los endpoints de simulación de BANC bajo la ruta `/api/banc/*`.
2. **Servidor Autónomo (`app = FastAPI(...)`)**: Puede ejecutarse como un proceso independiente en el puerto 8080 (`python -m server.banc_api`) para servir exclusivamente la interfaz de BANC (`web_banc/`).

Permite consultar grafos con coordenadas 3D, ejecutar simulaciones LIF con parámetros fisiológicos interactivos, barrer frecuencias de estimulación descendente ($0\text{ a }250\text{ Hz}$) y descargar reportes científicos reproducibles en JSON.

---

## 2. Importaciones y Justificación

```python
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
import numpy as np

from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from moscabrain.connectome.banc_circuit import BANCCircuitManager
from moscabrain.connectome.banc_lif_simulator import BANCLIFSimulator, run_comparison_experiment, DEFAULT_PHYSIOLOGY_PARAMS
from moscabrain.connectome.banc_experiment import run_full_banc_evaluation
```

### Justificación de Importaciones:
1. **`json`, `pathlib.Path`**: Carga y exportación de reportes científicos en formato JSON.
2. **`fastapi` (`FastAPI`, `APIRouter`, `HTTPException`)**: Gestión de rutas, excepciones HTTP 404/400 y montaje de archivos estáticos.
3. **`pydantic` (`BaseModel`, `Field`)**: Validación de parámetros numéricos con rangos estrictos (`ge`, `le`) para evitar desbordamientos o frecuencias físicamente irreales.
4. **`moscabrain.connectome`**: Submódulos de BANC para extracción de circuitos, simulación LIF y evaluación experimental completa.

---

## 3. Modelo de Petición `SimulationRequest`

```python
class SimulationRequest(BaseModel):
    circuit_id: str = "giant_fiber"
    stim_rate: float = Field(150.0, ge=0.0, le=500.0)
    duration_ms: float = Field(500.0, ge=50.0, le=2000.0)
    bg_rate: float = Field(20.0, ge=0.0, le=100.0)
    weight_scale: float = Field(1.5, ge=0.1, le=5.0)
    synapse_cutoff: int = Field(3, ge=1, le=20)
    seed: int = Field(42)
```

Valida:
- `stim_rate`: Frecuencia de estimulación en Hz (entre 0 y 500 Hz).
- `duration_ms`: Duración del ensayo (entre 50 y 2000 ms).
- `bg_rate`: Tasa de ruido Poisson (0 a 100 Hz).
- `weight_scale`: Multiplicador de pesos (0.1 a 5.0).
- `synapse_cutoff`: Umbral de corte sináptico anatómico (1 a 20).
- `seed`: Semilla para reproducibilidad estocástica.

---

## 4. Endpoints de la API REST

### `GET /api/banc/circuits`
- **Propósito**: Lista los circuitos biológicos disponibles (`"giant_fiber"` y `"p9"`), sus tipos descendentes, efectores motores diana y umbrales sinápticos recomendados.

---

### `GET /api/banc/circuit/{circuit_id}`
- **Propósito**: Retorna la topología completa del grafo: lista de nodos con tipos celulares, neurotransmisores predichos y coordenadas 3D en nanómetros (`position_nm: [x, y, z]`), junto con la lista de aristas presinápticas y postsinápticas con conteos de sinapsis.

---

### `POST /api/banc/simulate`
- **Propósito**: Ejecuta una simulación LIF bajo demanda con los parámetros del usuario.
- **Lógica**:
  1. Extrae el circuito mediante `get_or_load_circuit`.
  2. Inicializa `BANCLIFSimulator`.
  3. Ejecuta `sim.run_simulation(...)`.
  4. Si `stim_rate > 0`, ejecuta automáticamente un control basal a $0\text{ Hz}$ y calcula para cada motoneurona su incremento diferencial $\Delta\text{ Hz} = \text{rate}_{\text{stim}} - \text{rate}_{\text{base}}$.
- **Retorno**: Diccionario con trenes de picos, trazas de voltaje, estadísticas poblacionales y estado de salud de la red.

---

### `GET /api/banc/sweep`
- **Propósito**: Ejecuta un barrido de frecuencia de estímulo en 8 pasos ($0, 25, 50, 75, 100, 150, 200, 250\text{ Hz}$) para trazar curvas dosis-respuesta.
- **Retorno**: Lista de puntos con tasas de disparo de interneuronas y motoneuronas torácicas.

---

### `GET /api/banc/export`
- **Propósito**: Genera o lee el reporte científico precomputado y lo entrega como una descarga de archivo JSON con cabecera `Content-Disposition: attachment`.

---

## 5. Servidor de Interfaz Web Estática
Cuando se inicia en modo independiente, localiza la carpeta [`web_banc/`](file:///c:/Users/Fixer/Desktop/Mosca/web_banc) y sirve:
- `/` y `/banc`: `web_banc/index.html`
- `/banc_style.css`: Estilos visuales del simulador
- `/banc_app.js`: Lógica cliente en JavaScript para visualización 3D y gráficos
- `/static`: Montaje completo de la carpeta estática
