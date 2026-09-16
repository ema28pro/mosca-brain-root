# Documentación Técnica: `moscabrain/connectome/dynamics.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/connectome/dynamics.py` implementa el simulador neuronal `ConnectomeEngine`. Es el núcleo numérico de propagación sináptica que resuelve en tiempo real la electrofisiología de las **138.639 neuronas reales** y las **15.091.983 conexiones sinápticas** de FlyWire (v783).

Sus funciones primordiales incluyen:
- Integración temporal del potencial de membrana de tipo *Leaky Integrate-and-Fire* (LIF).
- Propagación matricial sináptica ultrarrápida mediante álgebra lineal dispersa ($W \cdot \text{spikes}$).
- Decaimiento exponencial de corrientes sinápticas y concentraciones de neurotransmisores.
- Modelado de **neuromodulación hedónica y aversiva**:
  - Dinámica de dopamina extracelular acoplada al clúster PAM (*Protocerebral Anterior Medial*).
  - Estado de sobresalto y alerta persistente (*Aversive Arousal*) desencadenado por el clúster PPL1 (*Protocerebral Posterior Lateral 1*).
- Integración bilateral fotorreceptora y olfativa (*tropotaxis Weathervane* / *Surge-and-Cast*) que modula directamente las neuronas descendentes de marcha P9 y viraje DNa01/DNa02.
- Decodificación motora y mecanismos de adaptación sensorial rápida (`reset_motor_bias`).

---

## 2. Importaciones y Justificación

```python
from typing import Dict, List, Optional, Tuple
import numpy as np
from scipy import sparse
from .circuits import FlyWireConnectomeTopology
```

### Justificación de Importaciones:
1. **`typing` (`Dict`, `List`, `Optional`, `Tuple`)**: Garantiza firmas de métodos estrictas para inyección de corrientes y telemetría.
2. **`numpy` (`np`)**: Ejecuta operaciones vectoriales en arrays contiguos `float32` para voltajes, deltas, picos booleanos y funciones de saturación (`np.clip`, `np.maximum`).
3. **`scipy.sparse`**: Provee el producto matriz-vector disperso `self.W.dot(spikes_f32)` que evalúa 15M de conexiones en milisegundos.
4. **`.circuits.FlyWireConnectomeTopology`**: Suministra la matriz $W$ y los índices de las poblaciones celulares catalogadas.

---

## 3. Parámetros Biofísicos y Variables de Estado

| Variable | Valor | Unidad | Descripción |
| :--- | :--- | :--- | :--- |
| `v_rest` | `-52.0` | mV | Potencial de reposo fisiológico en Drosophila (Shiu et al., 2024) |
| `v_threshold` | `-45.0` | mV | Umbral de emisión de potencial de acción |
| `v_reset` | `-52.0` | mV | Potencial de reinicio tras espiga |
| `tau_m` | `0.020` | s (20 ms) | Constante de tiempo de membrana pasiva |
| `tau_syn` | `0.005` | s (5 ms) | Constante de decaimiento sináptico |
| `w_scale` | `0.275` | escalar | Factor de escala de conductancia sináptica biológica |
| `dt` | `0.002` | s (2 ms) | Paso de integración temporal por tick |
| `syn_decay` | $\exp(-dt/\tau_{\text{syn}})$ | precalculado | Factor de decaimiento de corrientes por paso ($0.6703$) |
| `membrane_scale` | $dt/\tau_m$ | precalculado | Factor de integración pasiva por paso ($0.1$) |

### Arrays de Estado Vectorial ($N = 138639$):
- `V`: Vector de voltajes de membrana (`float32`).
- `spikes`: Vector booleano de disparo instantáneo (`bool`).
- `syn_currents`: Vector de corriente sináptica postsináptica acumulada (`float32`).
- `firing_rates`: Tasa de disparo promedio móvil (`float32`).
- `dopamine_level`: Nivel extracelular de dopamina apetitiva `[0.0, 3.0]`.
- `aversive_arousal`: Nivel de excitación y sobresalto por castigo `[0.0, 3.0]`.

---

## 4. Métodos y Funciones Detalladas

### `ConnectomeEngine.inject_input(neuron_indices: np.ndarray, currents: np.ndarray)`
- **Propósito**: Inyecta una corriente sensorial directa sobre un conjunto arbitrario de neuronas biológicas.
- **Entradas**: `neuron_indices` (*np.ndarray*), `currents` (*np.ndarray*).
- **Lógica**: Escala la corriente por $35.0$ y la suma a `syn_currents[neuron_indices]`.

---

### `ConnectomeEngine.trigger_dopamine(amount=1.0, is_reward=True)`
- **Propósito**: Ejecuta la neuromodulación biológica:
  - **Si `is_reward=True`**: Incrementa `dopamine_level`, atenúa el sobresalto `aversive_arousal`, despolariza las neuronas PAM y silencia PPL1.
  - **Si `is_reward=False` (Castigo / Aversión)**: Reduce la dopamina, dispara `aversive_arousal` ($+1.5 \times \text{amount}$), silencia PAM, hiperactiva el clúster PPL1 ($+45.0$), activa las MBON aversivas ($+35.0$) y despolariza la Fibra Gigante ($+20.0$).

---

### `ConnectomeEngine.inject_optic_input(left_vals: np.ndarray, right_vals: np.ndarray)`
- **Propósito**: Mapea la retina de los ojos compuestos al lóbulo óptico de FlyWire y a las neuronas motoras descendentes P9 y DNa.
- **Lógica**: Realiza interpolación lineal continua de la retina retinotópica sobre los índices `optic_left_indices` y `optic_right_indices`, e inyecta la media retiniana a las neuronas motoras de avance P9 y de viraje DNa.

---

### `ConnectomeEngine.inject_looming_input(looming_intensity: float)`
- **Propósito**: Inyecta corriente a las 104 neuronas LC4 (*Lobula Columnar 4*) cuando un objeto en el campo visual aumenta rápidamente de tamaño. Conectadas anatómicamente a la Fibra Gigante.

---

### `ConnectomeEngine.inject_olfactory_input(glomerular_activity, left_concentration, right_concentration)`
- **Propósito**: Implementa la **tropotaxis antenal bilateral** y la navegación *Weathervane*:
  1. Calcula el contraste interantenal:
     $$\text{contrast} = \frac{r_c - l_c}{\max(0.02, l_c + r_c)}$$
  2. Normaliza el contraste: $\text{contrast\_norm} = \text{clip}(\text{contrast} \cdot 10.0, -1.0, 1.0)$.
  3. **Frenado en Desalineación**: Si la mosca no está de frente a la pluma, reduce la velocidad de avance P9 para permitir que el cuerpo pivote sobre su eje sin pasar de largo el alimento.
  4. **Inhibición Recíproca Contralateral**: Al virar a la derecha, activa DNa derecho y silencia DNa izquierdo; y viceversa. Si está alineada, amortigua la rotación residual.

---

### `ConnectomeEngine.step() -> np.ndarray`
- **Propósito**: Ciclo fundamental de simulación (2 ms):
  1. Decaimiento pasivo de `dopamine_level` ($5\%$) y `aversive_arousal` ($2.5\%$).
  2. Si hay arousal aversivo activo, genera ráfagas estocásticas de viraje de emergencia en DNa.
  3. **Propagación Sináptica Dispersa**:
     $$\text{incoming} = W \cdot \text{spikes} \cdot w_{\text{scale}}$$
     $$\text{syn\_currents} = (\text{syn\_currents} + \text{incoming}) \cdot \text{syn\_decay}$$
  4. **Integración LIF**:
     $$\Delta V = \frac{dt}{\tau_m} \cdot (v_{\text{rest}} - V + \text{syn\_currents})$$
     $$V = \max(V + \Delta V, -85.0\text{ mV})$$
  5. **Detección de Espigas**:
     $$\text{spikes} = (V \ge v_{\text{threshold}})$$
     Para neuronas que dispararon, reinicia $V = v_{\text{reset}}$.
  6. Actualiza las tasas de disparo mediante media móvil: $\text{rates} = 0.65 \cdot \text{rates} + 0.35 \cdot \text{spikes}$.
- **Salida**: Vector booleano `spikes` de longitud $138639$.

---

### `ConnectomeEngine.get_motor_output() -> Tuple[float, float, bool]`
- **Propósito**: Decodifica las tasas de disparo en comandos de locomoción:
  - Empuje hacia adelante: $fwd = \text{clip}((P9_L + P9_R) \cdot 5.0 + 0.1, 0.0, 1.0)$.
  - Giro angular: $yaw = \text{clip}((P9_R - P9_L) \cdot 3.0 + (DNa_R - DNa_L) \cdot 2.8, -1.0, 1.0)$.
  - Salto de escape: Disparo de Giant Fiber o LC4 óptico intenso, salvo que esté suprimido por dopamina de alta recompensa.
- **Salida**: `(forward_thrust, turn_yaw, escape_jump)`.

---

### `ConnectomeEngine.reset_motor_bias()`
- **Propósito**: Elimina la histéresis sensorial tras consumir sacarosa o eliminar estímulos, reseteando las corrientes y tasas de $P9, DNa, MN9, PAM$ y llevando los voltajes hiperpolarizados de vuelta al reposo $v_{\text{rest}}$.

---

### `ConnectomeEngine.get_telemetry_snapshot() -> dict`
- **Propósito**: Compila un resumen exhaustivo del estado biofísico: tasas de disparo en tiempo real, conteos de espigas, niveles de dopamina y arousal, y actividad media de las 20 familias neuronales para el panel web.
