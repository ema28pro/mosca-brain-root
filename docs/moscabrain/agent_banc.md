# Documentación Técnica: `moscabrain/agent_banc.py`

## 1. Propósito General del Módulo
El módulo `moscabrain/agent_banc.py` implementa la clase `BANCAgent`, una corporización de la mosca basada en el conectoma **Whole-CNS** (Sistema Nervioso Central Completo: Cerebro + Cordón Nervioso Ventral / VNC) derivado del dataset BANC (v888, Bates, Phelps, Kim et al., *Nature* 2026).

A diferencia de `FlyWireAgent` (que emula 138k neuronas cefálicas con alta demanda de memoria), `BANCAgent` está optimizado para:
- Extraer subcircuitos funcionales identificados (como la **Fibra Gigante / Giant Fiber** y la red de marcha **DNp09 / P9**).
- Simular la transmisión sináptica mediante un modelo biofísico de potenciales de acción **Leaky Integrate-and-Fire (LIF)**.
- Monitorear el reclutamiento real de **motoneuronas efectoras** (músculo tergotrocantéreo de salto TTMn, músculos dorsolongitudinales de vuelo DLMn, y motoneuronas de flexión tibial de las patas).
- Operar con bajo consumo de memoria RAM y mínima latencia.

---

## 2. Importaciones y Justificación

```python
from typing import List, Dict, Optional, Any, Union
import numpy as np

from .connectome.banc_circuit import BANCCircuitManager
from .connectome.banc_lif_simulator import BANCLIFSimulator, DEFAULT_PHYSIOLOGY_PARAMS
from .body.motor import ActionOutput, ActionState
```

### Justificación de Importaciones:
1. **`typing` (`List`, `Dict`, `Optional`, `Any`, `Union`)**: Asegura la firma tipada de las estructuras de configuración fisiológica, telemetría y resultados de simulación.
2. **`numpy` (`np`)**: Soporta transformaciones trigonométricas angulares (`np.radians`, `np.cos`, `np.sin`) para desplazar la posición física en el espacio bidimensional según el tiempo transcurrido `dt_s`.
3. **`.connectome.banc_circuit.BANCCircuitManager`**: Administrador que carga y filtra los grafos conectómicos de BANC según el umbral sináptico (*synapse threshold*).
4. **`.connectome.banc_lif_simulator.BANCLIFSimulator`, `DEFAULT_PHYSIOLOGY_PARAMS`**: Motor biofísico de picos (spikes) que resuelve numéricamente la dinámica de membrana de cada neurona.
5. **`.body.motor.ActionOutput`, `ActionState`**: Objetos estándar de salida motora para mantener compatibilidad total con la arena y el servidor web.

---

## 3. Lógica de Clases y Arquitectura

### Clase `BANCAgent`
Representa al agente cuando opera en modo Whole-CNS.

#### Atributos de Estado:
- `connectome_mode`: Valor constante `"banc"`.
- `circuit_id`: Identificador del subcircuito activo (`"giant_fiber"` o `"p9"`).
- `dt`: Paso temporal de integración en segundos (por defecto `0.0002` s = 0.2 ms).
- `circuit_mgr`: Instancia de `BANCCircuitManager`.
- `circuit`: Grafo extraído con metadatos de neuronas y conexiones sinápticas.
- `simulator`: Instancia de `BANCLIFSimulator` configurada con los parámetros biofísicos.
- `x`, `y`, `angle`, `speed`: Coordenadas espaciales y velocidad en la arena.
- `is_feeding`, `feeding_counter`: Estado de alimentación.
- `dopamine_level`: Nivel interno de neuromodulación `[-2.0, 2.0]`.
- `banc_telemetry`: Diccionario con métricas en tiempo real sobre frecuencia de disparo de motoneuronas, detección de salto, neurona motora más activa y total de picos.

---

## 4. Métodos y Funciones Detalladas

### `BANCAgent.__init__(circuit_id="giant_fiber", synapse_threshold=3, physiology_params=None, dt=0.0002)`
- **Entradas**:
  - `circuit_id` (*str*): Identificador del circuito a cargar (`"giant_fiber"` o `"p9"`).
  - `synapse_threshold` (*int*): Número mínimo de sinapsis para validar una conexión anatómica (por defecto 3).
  - `physiology_params` (*Optional[Dict[str, Any]]*): Parámetros biofísicos personalizados (capacitancias, resistencias, potenciales de reposo/umbral).
  - `dt` (*float*): Paso temporal en segundos.
- **Salida**: Instancia configurada y lista para simulación con el subcircuito cargado.

---

### `BANCAgent.set_circuit(circuit_id: str, synapse_threshold: Optional[int] = None)`
- **Propósito**: Cambia en caliente el circuito activo entre el sistema de escape (`giant_fiber`) y el sistema de marcha (`p9`).
- **Entradas**: `circuit_id` (*str*), `synapse_threshold` (*Optional[int]*).
- **Lógica**: Extrae el nuevo grafo mediante `BANCCircuitManager`, reconstruye el simulador LIF preservando los parámetros fisiológicos y actualiza la telemetría.

---

### `BANCAgent.reward(amount=1.0, reason="recompensa")` / `punish(...)`
- **Propósito**: Ajusta el nivel escalar de dopamina de la mosca dentro del rango acotado $[-2.0, 2.0]$.
- **Entradas**: `amount` (*float*), `reason` (*str*).

---

### `BANCAgent.step(threats=None, forward_drive_hz=0.0, trial_duration_ms=50.0) -> ActionOutput`
- **Propósito**: Ejecuta un ensayo biológico temporal integrando potenciales de acción a través del conectoma.
- **Lógica Paso a Paso**:
  1. Detecta si existen amenazas visuales en `threats`. Si las hay, inyecta estímulo de alta frecuencia ($150\text{ Hz}$) a las neuronas descendentes DNp01 (Giant Fiber).
  2. Si no hay amenazas, aplica `forward_drive_hz` (estímulo de marcha a DNp09).
  3. Ejecuta `simulator.run_simulation(stim_rate, t_run=trial_duration_ms)`.
  4. Analiza la salida de las motoneuronas:
     - Si la motoneurona del tergotrocánter (`TTMn`) dispara picos, se activa el salto de escape (`jump_active = True`).
     - Si la tasa motora promedio supera $0.2\text{ Hz}$ o el estímulo es alto, entra en estado de marcha (`WALKING`).
     - Si no hay actividad suficiente, permanece en reposo (`IDLE`).
  5. Actualiza la posición y velocidad en base al tiempo físico (`trial_duration_ms / 1000.0`).
- **Entradas**:
  - `threats` (*Optional[List[Dict]]*): Lista de amenazas en la arena.
  - `forward_drive_hz` (*float*): Frecuencia de excitación descendente artificial (Hz).
  - `trial_duration_ms` (*float*): Duración del ensayo biológico en milisegundos (por defecto 50 ms).
- **Salida**: Objeto `ActionOutput` con el estado motor resultante (`ActionState.ESCAPE_JUMP`, `ActionState.WALKING` o `ActionState.IDLE`).
