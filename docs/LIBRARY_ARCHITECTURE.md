# MoscaBrain: Arquitectura de la Biblioteca, Guía de Modularidad y Referencia de API

## 1. Visión General de la Biblioteca (Root Library)

**MoscaBrain** (`moscabrain`) es una biblioteca de Inteligencia Artificial Corporizada (*Embodied AI*) y neurocomputación biofísica para simular el sistema nervioso completo de la mosca de la fruta (*Drosophila melanogaster*).

La biblioteca está diseñada con arquitectura modular para ser importada como paquete de Python (`import moscabrain`) por investigadores, ingenieros y desarrolladores, permitiendo alternar de forma transparente entre dos conectomas biológicos reales:

```
                                  ┌────────────────────────────────────────┐
                                  │           MOSCABRAIN LIBRARY           │
                                  └───────────────────┬────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
         [ MODO BANC (Whole-CNS) ]                                     [ MODO FLYWIRE (Brain-Only) ]
    - Cerebro + Cuello + VNC (Continuo)                            - Cerebro supraesofágico (FAFB v783)
    - 188.508 neuronas | 13.62M sinapsis                           - 138.639 neuronas | 15.09M sinapsis
    - Bates, Phelps, Kim et al. (Nature 2026)                      - Dorkenwald et al. (Nature 2024)
    - Circuitos descendentes a MOTONEURONAS                        - Olfato, Visión, MB, CX a neuronas descendentes
    - Salto de escape (TTMn), Vuelo (DLM), Patas                   - Control cognitivo y sensoriomotor cefálico
```

---

## 2. Justificación de Cada Importación (`Imports Rationale`)

En los módulos de `moscabrain`, cada librería externa responde a una estricta necesidad biofísica o de rendimiento:

| Librería / Módulo | ¿Por qué se usa? (Justificación Técnica y Biofísica) |
| :--- | :--- |
| `numpy` | **Álgebra lineal y dinámicas vectorizadas continuas en C:** Permite actualizar simultáneamente los vectores de potencial de membrana $V_m$ y conductancias sinápticas $G$ de miles de neuronas en $\sim 0.4\text{ ms}$ por paso, evitando el sobrecoste de bucles `for` en Python nativo. Generación determinista de números pseudoaleatorios (`RandomState`). |
| `pandas` | **Indexación y filtrado relacional de metadatos biológicos:** La metadata celular de BANC v888 cuenta con 188.508 filas y 81 columnas. Pandas permite indexar por `banc_888_id` como clave primaria para resolver rápidamente tipos celulares, neuromeros, neurotransmisores predichos y lateralidad. |
| `pyarrow` | **Carga ultra-rápida de conectomas en memoria (Feather/IPC):** `banc_888_edgelist_simple_v3.feather` pesa ~360 MB con 13.6 millones de conexiones. PyArrow lee directamente las columnas mapeadas en memoria (*zero-copy deserialization*), reduciendo el tiempo de carga de minutos a $\sim 1.5$ segundos. |
| `scipy` | **Matrices dispersas (*sparse matrices* CSR/CSC) y análisis de grafos:** Las matrices de conectividad de conectomas enteros tienen una dispersión $> 99.9\%$. SciPy permite almacenar y multiplicar matrices dispersas sin consumir gigabytes de RAM. |
| `fastapi` & `pydantic` | **Servidor REST asíncrono y contratos de datos tipados:** Expone el simulador conectómico mediante APIs web HTTP y WebSockets con tipado estricto (`BaseModel`), validando rangos físicos (ej. $0 \le \text{Hz} \le 500$) y documentación automática OpenAPI. |
| `uvicorn` | **Servidor ASGI de ultra-baja latencia:** Provee la base para streaming de telemetría a 30–60 FPS vía WebSockets hacia la interfaz de usuario. |
| `pathlib.Path` | **Manejo agnóstico del sistema de archivos:** Garantiza que las rutas a los datasets cacheados (`data/banc/`) funcionen de manera idéntica en Windows (con backslashes) y en Linux/macOS. |
| `urllib.request` | **Descarga directa desde Google Cloud Storage:** Descarga de forma nativa los archivos compilados del bucket oficial `gs://lee-lab_brain-and-nerve-cord-fly-connectome/` sin obligar al usuario a instalar el SDK de Google Cloud o autenticar credenciales. |
| `json` | **Exportación e interoperabilidad:** Serialización de configuraciones de ensayo reproducibles, trazado de espigas y descarga de reportes estandarizados. |
| `time` / `time.perf_counter` | **Medición precisa del tiempo de cómputo (*compute ms*):** Monitoreo de latencias de simulación para balancear el pacing de la arena física y el motor biofísico. |

---

## 3. Modularidad y Conmutación de Conectoma (BANC vs FlyWire)

### En Código Python (`FlyAgent`):
```python
from moscabrain import FlyAgent

# 1. Instanciar agente en modo BANC (Whole-CNS: Cerebro + VNC)
fly_banc = FlyAgent(connectome_mode="banc")
print("Modo activo:", fly_banc.connectome_mode)

# 2. Instanciar agente en modo FlyWire (Brain-Only)
fly_brain = FlyAgent(connectome_mode="flywire_brain")

# 3. Conmutar dinámicamente en tiempo de ejecución:
fly_banc.set_connectome_mode("flywire_brain")
fly_banc.set_connectome_mode("banc")
```

### En el Servidor Principal (`server/app.py`):
El servidor dispone de endpoints dedicados para consultar y conmutar el modo de simulación global:
- **Consultar modo actual:**  
  `GET /api/connectome/mode`  
  *Respuesta:* `{"current_mode": "banc", "available_modes": [...], "banc_telemetry": {...}}`
- **Cambiar modo en caliente:**  
  `POST /api/connectome/mode` con JSON: `{"mode": "flywire_brain"}` o `{"mode": "banc"}`.

---

## 4. Referencia Detallada de Clases y Funciones

### 4.1. `BANCCircuitManager` (`moscabrain.connectome.banc_circuit`)

Gestor bioinformático de extracción, aislamiento y cacheo de subcircuitos biológicamente coherentes a partir de los datos crudos de BANC v888.

#### `__init__(data_dir: Optional[Path] = None)`
- **Entrada:** `data_dir` (opcional, ruta a la carpeta donde residen los archivos `.feather` de BANC). Por defecto: `<repo_root>/data/banc/`.
- **Salida:** Instancia de `BANCCircuitManager`.
- **Comportamiento:** Asegura la existencia del directorio de caché (`data/banc/circuits/`) y prepara la carga bajo demanda de la metadata.

#### `extract_giant_fiber_circuit(synapse_threshold: int = 3, force_recompute: bool = False) -> Dict[str, Any]`
- **Entrada:**
  - `synapse_threshold` (int, default=3): Número mínimo de sinapsis físicas para retener una conexión.
  - `force_recompute` (bool, default=False): Si es `True`, ignora el archivo JSON en caché y re-extrae desde los datos feather.
- **Salida:** `Dict[str, Any]` con la topología del circuito:
  - `circuit_id`: `"giant_fiber"`.
  - `nodes`: Lista de diccionarios de neuronas (ID, tipo celular, clase funcional, neurotransmisor predicho, neuromero, efector y posición en nm).
  - `edges`: Lista de conexiones con `pre`, `post`, y `count`.
  - `stats`: Conteo de neuronas totales (263), sinapsis totales (1.112) y motoneuronas (210).
- **Lógica biológica:** Aísla el par de neuronas descendentes `DNp01` (Izquierda: `720575941509145950`, Derecha: `720575941451068597`), sus dianas directas de salto y vuelo en el neuromero T2 (TTMn y PSI), interneuronas intrínsecas premotoras y motoneuronas reclutadas.

#### `extract_p9_circuit(synapse_threshold: int = 5, force_recompute: bool = False) -> Dict[str, Any]`
- **Entrada:** `synapse_threshold` (int, default=5), `force_recompute` (bool).
- **Salida:** `Dict[str, Any]` con el circuito de marcha P9 (398 neuronas, 301 motoneuronas de pata T1–T3).
- **Lógica biológica:** Extrae las neuronas descendentes promotoras de marcha hacia adelante `DNp09` (`720575941566493282`, `720575941433155799`) y sus rutas a motoneuronas flexoras y extensoras de pata.

---

### 4.2. `BANCLIFSimulator` (`moscabrain.connectome.banc_lif_simulator`)

Simulador biofísico *Leaky Integrate-and-Fire* transparente y determinista basado en Shiu et al. (Nature 2024).

#### `__init__(circuit_data: Dict[str, Any], params: Optional[Dict[str, Any]] = None)`
- **Entrada:**
  - `circuit_data`: Diccionario generado por `BANCCircuitManager`.
  - `params`: Diccionario de parámetros biofísicos para sobreescribir `DEFAULT_PHYSIOLOGY_PARAMS`.
- **Salida:** Instancia de `BANCLIFSimulator`.
- **Comportamiento:**
  - Construye la matriz de pesos con signo $W[post, pre]$:
    $$W_{ij} = \text{signo}(NT_j) \times N_{synapsis}(j \to i) \times w_{syn} \times \text{weight\_scale}$$
  - Mapea índices de neuronas descendentes estimuladas, interneuronas del VNC y motoneuronas diana.

#### `run_simulation(stim_rate: Optional[float] = None, bg_rate: Optional[float] = None, t_run: Optional[float] = None, seed: Optional[int] = None) -> Dict[str, Any]`
- **Entradas:**
  - `stim_rate` (float, opcional, Hz): Frecuencia del tren de estímulo Poisson inyectado a las neuronas descendentes.
  - `bg_rate` (float, opcional, Hz): Frecuencia del ruido Poisson de fondo que reciben todas las neuronas.
  - `t_run` (float, opcional, ms): Duración del ensayo (ej. 500 ms).
  - `seed` (int, opcional): Semilla del generador pseudoaleatorio para reproducibilidad.
- **Salida:** `Dict[str, Any]` con los resultados del ensayo:
  - `total_spikes`: Número total de potenciales de acción emitidos en la red.
  - `compute_time_ms`: Tiempo de ejecución de CPU en milisegundos.
  - `network_status`: Estado biológico (`"healthy"`, `"silent_network"`, `"runaway_excitation"`, o `"numerical_instability"`).
  - `population_rates_hz`: Diccionario con la tasa de disparo media en Hz para:
    - `descending_inputs`: Tasa en las neuronas descendentes estimuladas.
    - `vnc_interneurons`: Tasa en interneuronas torácicas.
    - `motor_neurons`: Tasa en las motoneuronas identificadas.
    - `network_overall`: Media global de la red.
  - `spikes`: Lista de eventos de espiga `{"t": float, "neuron_idx": int, "neuron_id": str, "cell_type": str, "super_class": str}`.
  - `traces`: Diccionario con `times` y `voltages` de neuronas representativas para graficar $V_m(t)$.
  - `motor_outputs`: Lista de motoneuronas ordenada por tasa de disparo decreciente, con ID, tipo celular, efector anatómico, neuromero y espigas emitidas.

---

### 4.3. Batería de Ensayos Reproducibles (`moscabrain.connectome.banc_experiment`)

#### `run_full_banc_evaluation(circuit_type: str = "giant_fiber", seed: int = 42) -> Dict[str, Any]`
- **Entrada:** `circuit_type` (`"giant_fiber"` o `"p9"`), `seed` (semilla reproducible).
- **Salida:** Diccionario completo con:
  - Curva de respuesta a dosis de estimulación ($0\text{ Hz}$ a $250\text{ Hz}$).
  - Análisis de sensibilidad a la escala de peso sináptico ($0.5\times$ a $2.0\times$).
  - Sensibilidad al umbral de corte de sinapsis ($1, 3, 5, 10$).
  - Comparativa motora Línea Base vs Estimulado.
  - Guarda automáticamente el reporte en `data/banc/results/<circuit_type>_experiment_report.json`.

---

## 5. Ejemplos Prácticos de Código (Guía para Desarrolladores)

### Ejemplo 1: Simulación del Circuito de Escape en 10 Líneas de Python
```python
from moscabrain.connectome import BANCCircuitManager, BANCLIFSimulator

# 1. Cargar circuito biológico de la Fibra Gigante
mgr = BANCCircuitManager()
circuit = mgr.extract_giant_fiber_circuit(synapse_threshold=3)

# 2. Inicializar simulador LIF
sim = BANCLIFSimulator(circuit)

# 3. Ejecutar simulación con 150 Hz de estimulación descendente
res = sim.run_simulation(stim_rate=150.0, t_run=500.0, seed=42)

# 4. Imprimir resultados motores
print(f"Estado de la red: {res['network_status']}")
print(f"Tasa motoneuronas: {res['population_rates_hz']['motor_neurons']} Hz")
print(f"Total espigas: {res['total_spikes']} en {res['compute_time_ms']} ms")

# 5. Listar las 3 motoneuronas más activas
for m in res['motor_outputs'][:3]:
    print(f"  Motoneurona: {m['cell_type']} ({m['body_part_effector']}) -> {m['firing_rate_hz']} Hz")
```

### Ejemplo 2: Comparación Línea Base vs Estimulación
```python
from moscabrain.connectome import BANCCircuitManager, run_comparison_experiment

mgr = BANCCircuitManager()
circuit = mgr.extract_giant_fiber_circuit()

# Ejecuta ensayo comparativo a múltiples frecuencias
eval_res = run_comparison_experiment(circuit, stim_frequencies=[0.0, 50.0, 100.0, 150.0, 250.0])

for f, metrics in eval_res['frequency_response_curve'].items():
    print(f"Estímulo {f} Hz -> Tasa Motora: {metrics['motor_rate_hz']} Hz (Delta: +{metrics['motor_delta_from_baseline_hz']} Hz)")
```

### Ejemplo 3: Agente Corporizado con Control BANC
```python
from moscabrain import FlyAgent

# Instanciar agente en modo conectoma completo (Cerebro + VNC)
fly = FlyAgent(connectome_mode="banc")

# Simular amenaza de colisión visual (looming visual)
threats = [{"x": 305.0, "y": 305.0, "radius": 20.0, "speed": 10.0}]
action = fly.step(threats=threats)

print("Estado motor:", action.state.name)
print("Salto de escape activado:", action.escape_jump)
print("Telemetría motoneuronas BANC:", fly.banc_telemetry)
```
