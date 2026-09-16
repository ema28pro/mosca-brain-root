# Documentación Técnica: `moscabrain/connectome/banc_lif_simulator.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/connectome/banc_lif_simulator.py` implementa el simulador biofísico de potenciales de acción **Leaky Integrate-and-Fire (LIF)** vectorizado y optimizado para los subcircuitos del conectoma BANC v888.

Se basa en el marco electrofisiológico y los parámetros empíricos descritos por Shiu et al. (*Nature* 2024):
- Ecuación de decaimiento del potencial de membrana pasivo y conductancias sinápticas.
- Búfer circular (*ring buffer*) para retrasos de conducción axonal y transmisión sináptica ($t_{\text{dly}} = 1.8\text{ ms}$).
- Período refractario absoluto ($t_{\text{rfc}} = 2.2\text{ ms}$).
- Signos de pesos sinápticos derivados de neurotransmisores identificados en el SNC de Drosophila (Acetilcolina excitatoria $+1$, GABA inhibitorio $-1$, Glutamato inhibitorio $-1$ vía canales GluCl-$\alpha$).
- Generador de ruido de fondo de Poisson y estimulación controlada de neuronas descendentes.

---

## 2. Importaciones y Justificación

```python
import numpy as np
import time
from typing import Dict, List, Optional, Any, Tuple
```

### Justificación de Importaciones:
1. **`numpy` (`np`)**: Vectorización masiva de las ecuaciones diferenciales del potencial de membrana $V$, conductancias $G$, temporizadores refractarios y matrices de peso bidimensionales $W[\text{post}, \text{pre}]$ de tipo `float32`.
2. **`time`**: Medición exacta de la latencia computacional en milisegundos (`compute_time_ms`).
3. **`typing` (`Dict`, `List`, `Optional`, `Any`, `Tuple`)**: Estructuración estricta de las salidas de trenes de picos, trazas de voltaje y diccionarios de telemetría.

---

## 3. Parámetros Fisiológicos Predeterminados (`DEFAULT_PHYSIOLOGY_PARAMS`)

| Parámetro | Valor | Unidad | Significado Biológico / Referencia |
| :--- | :--- | :--- | :--- |
| `v_0` | `-52.0` | mV | Potencial de membrana en reposo (Kakaria & de Bivort, 2017) |
| `v_rst` | `-52.0` | mV | Potencial de reinicio tras el disparo de un pico |
| `v_th` | `-45.0` | mV | Umbral de disparo de potencial de acción |
| `t_mbr` | `20.0` | ms | Constante de tiempo de membrana pasiva ($\tau_m = R_m \cdot C_m$) |
| `tau_syn` | `5.0` | ms | Constante de decaimiento de conductancia postsináptica |
| `t_rfc` | `2.2` | ms | Período refractario absoluto (Lazar et al.) |
| `t_dly` | `1.8` | ms | Retardo de conducción axonal y liberación vesicular sináptica |
| `w_syn` | `0.35` | mV | Amplitud de despolarización por sinapsis anatómica unitaria |
| `weight_scale` | `1.5` | escalar | Multiplicador de sensibilidad para pruebas fisiológicas |
| `synapse_cutoff` | `3` | entero | Número mínimo de sinapsis anatómicas requeridas |
| `dt` | `0.2` | ms | Paso temporal de integración numérica ($0.0002\text{ s}$) |
| `t_run` | `500.0` | ms | Duración estándar de un ensayo de simulación |
| `stim_rate` | `150.0` | Hz | Frecuencia de estimulación Poisson de neuronas descendentes |
| `stim_scale` | `45.0` | mV | Amplitud del EPSP inyectado por evento Poisson de estímulo |
| `bg_rate` | `20.0` | Hz | Tasa de ruido Poisson espontáneo de fondo |
| `bg_scale` | `2.5` | mV | Amplitud del EPSP por evento de ruido basal |

---

## 4. Lógica de Clases y Arquitectura

### Clase `BANCLIFSimulator`
Motor de ejecución de simulación biofísica para un circuito BANC cargado.

#### Atributos Principales:
- `circuit_data`: Grafo de nodos y aristas recibido del `BANCCircuitManager`.
- `params`: Diccionario de parámetros biofísicos.
- `num_neurons`: Cantidad total de neuronas en la red.
- `id_to_idx`, `idx_to_id`: Tablas hash bidireccionales entre Root IDs de 64 bits y posiciones matriciales.
- `stim_indices`: Índices de las neuronas descendentes estimuladas (DNp01 o DNp09).
- `motor_indices`: Índices de las motoneuronas del VNC.
- `interneuron_indices`: Índices de las interneuronas intermedias.
- `W`: Matriz densa $N \times N$ de pesos con signo $W[\text{post}, \text{pre}]$.

---

## 5. Métodos y Funciones Detalladas

### `BANCLIFSimulator._build_weight_matrix() -> np.ndarray`
- **Lógica**: Itera sobre las aristas del circuito. Si el conteo de sinapsis cumple `count >= synapse_cutoff`, obtiene el neurotransmisor presináptico:
  - Acetilcolina $\rightarrow +1.0$
  - GABA $\rightarrow -1.0$
  - Glutamato $\rightarrow -1.0$
  - Desconocido / Modulador $\rightarrow 0.0$
  Calcula el peso:
  $$W[\text{post}, \text{pre}] = \text{sign} \cdot \text{count} \cdot w_{\text{syn}} \cdot \text{weight\_scale}$$
- **Salida**: Matriz `np.ndarray` de dimensiones $(N, N)$ en `float32`.

---

### `BANCLIFSimulator.run_simulation(...) -> Dict[str, Any]`
- **Propósito**: Ejecuta la integración temporal paso a paso mediante integración de Euler exacta:
  1. **Inyección de Retardo Sináptico**: Extrae del búfer circular `delay_buffer[buffer_idx]` las conductancias sinápticas programadas en pasos anteriores.
  2. **Estímulo y Ruido Poisson**:
     $$P_{\text{evento}} = 1 - e^{-\lambda \cdot \Delta t}$$
     Inyecta despolarizaciones `stim_scale` en las DNs estimuladas y `bg_scale` en toda la población.
  3. **Integración de Membrana**:
     Para neuronas fuera del período refractario:
     $$V(t + \Delta t) = V(t) + \frac{\Delta t}{\tau_m} \cdot \left(v_0 - V(t) + G(t)\right)$$
     $$G(t + \Delta t) = G(t) - \frac{\Delta t}{\tau_{\text{syn}}} \cdot G(t)$$
     Las neuronas refractarias se mantienen ancladas a $v_{\text{rst}}$.
  4. **Emisión de Picos**:
     Si $V_i \ge v_{\text{th}}$:
     - Se registra el pico $(t, i)$.
     - Se reinicia el voltaje $V_i = v_{\text{rst}}$ y el temporizador refractario $t_{\text{rfc}}$.
     - Se calcula el vector postsináptico $\Delta G = \sum_j W_{:, j}$ y se acumula en la ranura futura del búfer circular según $t_{\text{dly}}$.
  5. **Comprobaciones de Salud de la Red**:
     Evalúa si la red se encuentra en estado `healthy`, `numerical_instability` (presencia de NaN/Inf), `runaway_excitation` ($>350\text{ Hz}$ media o $>500\text{ Hz}$ individual) o `silent_network` (0 picos).
- **Salida**: Diccionario que incluye `total_spikes`, `population_rates_hz` (descendentes, interneuronas, motoneuronas), lista de picos formateados, trazas de voltaje submuestreadas a 1 ms y desglose ordenado de motoneuronas activadas.

---

### `run_comparison_experiment(circuit_data, stim_frequencies, seed) -> Dict[str, Any]`
- **Propósito**: Función auxiliar de nivel superior para contrastar el estado basal ($0\text{ Hz}$) contra una serie de frecuencias de estímulo ($50, 100, 150, 250\text{ Hz}$).
- **Salida**: Diccionario con la curva de respuesta y lista de motoneuronas reclutadas ordenadas por $\Delta\text{ Hz}$.
