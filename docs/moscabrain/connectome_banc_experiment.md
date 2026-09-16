# Documentación Técnica: `moscabrain/connectome/banc_experiment.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/connectome/banc_experiment.py` implementa una batería estandarizada y reproducible de experimentos biofísicos computacionales sobre los circuitos extraídos de BANC v888.

Permite cuantificar y comparar formalmente:
1. **Curva de Respuesta de Tasa de Estímulo vs. Línea Base**: Comportamiento espontáneo sin estimulación ($0\text{ Hz}$) frente a frecuencias crecientes de activación descendente ($25, 50, 75, 100, 150, 200, 250\text{ Hz}$).
2. **Sensibilidad al Escalado de Peso Sináptico**: Respuestas de la red con multiplicadores de conductancia $0.5\times, 1.0\times, 1.5\times, 2.0\times$.
3. **Sensibilidad al Umbral de Filtrado Sináptico**: Impacto de descartar contactos débiles con puntos de corte (*cutoffs*) de $1, 3, 5, 8, 10$ sinapsis.
4. **Desglose Celular del Reclutamiento Motor**: Identificación de las motoneuronas efectoras más excitadas, cálculo del incremento sobre la línea base ($\Delta\text{ Hz}$) y reporte explícito de limitaciones metodológicas y supuestos fisiológicos.

Los resultados se exportan como reportes JSON estructurados a `data/banc/results/`.

---

## 2. Importaciones y Justificación

```python
import json
import os
from pathlib import Path
from typing import Dict, List, Any
import numpy as np

from moscabrain.connectome.banc_circuit import BANCCircuitManager
from moscabrain.connectome.banc_lif_simulator import BANCLIFSimulator, DEFAULT_PHYSIOLOGY_PARAMS
```

### Justificación de Importaciones:
1. **`json`, `pathlib.Path`**: Persistencia y serialización de los reportes experimentales en el sistema de archivos.
2. **`typing` (`Dict`, `List`, `Any`)**: Tipado estático de diccionarios de métricas y colecciones celulares.
3. **`numpy` (`np`)**: Soporte numérico para redondeos y ordenamiento de arrays.
4. **`BANCCircuitManager`**: Proveedor de los subgrafos de Giant Fiber y P9 con metadatos anatómicos.
5. **`BANCLIFSimulator`, `DEFAULT_PHYSIOLOGY_PARAMS`**: Motor biofísico LIF parametrizado según la literatura electrofisiológica de insectos (Shiu et al., 2024).

---

## 3. Lógica y Estructura del Módulo

### Constantes de Rutas:
- `RESULTS_DIR`: Directorio de salida `data/banc/results/`.

---

## 4. Métodos y Funciones Detalladas

### `run_full_banc_evaluation(circuit_type="giant_fiber", seed=42) -> Dict[str, Any]`
- **Propósito**: Ejecuta el protocolo completo de evaluación sobre el circuito seleccionado y genera el informe científico de reclutamiento motor.
- **Entradas**:
  - `circuit_type` (*str*): `"giant_fiber"` (escape) o `"p9"` (marcha).
  - `seed` (*int*): Semilla pseudoaleatoria para reproducibilidad estricta de los trenes de Poisson (por defecto 42).
- **Fases del Experimento**:
  1. **Línea Base y Curva de Activación**:
     - Ejecuta simulación de control a $0\text{ Hz}$ para registrar el disparo espontáneo inicial de las motoneuronas.
     - Itera sobre frecuencias de estímulo $[0, 25, 50, 75, 100, 150, 200, 250]\text{ Hz}$.
     - Registra tasas de disparo poblacionales en neuronas descendentes, interneuronas del VNC y motoneuronas, junto con el delta respecto al control.
  2. **Sensibilidad al Peso Sináptico**:
     - Fija el estímulo en $150\text{ Hz}$ y varía `weight_scale` entre $0.5$ y $2.0$.
     - Verifica estabilidad de la red (detectando si ocurre hiperexcitabilidad patológica o silenciamiento).
  3. **Sensibilidad al Umbral Sináptico**:
     - Varía `synapse_cutoff` entre $1$ y $10$ sinapsis para evaluar la robustez de la topología conectómica.
  4. **Desglose de Motoneuronas**:
     - Compara cada motoneurona individualmente a $150\text{ Hz}$ contra su valor basal, ordenándolas de mayor a menor incremento ($\Delta\text{ Hz}$).
  5. **Declaración de Supuestos y Limitaciones**:
     - Incorpora en el reporte científico advertencias formales: la activación de motoneuronas establece el impulso fisiológico, pero el movimiento físico real requiere la biomecánica corporal del exoesqueleto y bucles propioceptivos de retroalimentación sensorial.
  6. **Serialización**:
     - Guarda el resultado en `data/banc/results/{circuit_type}_experiment_report.json`.
- **Salida**: Diccionario exhaustivo con metadatos del circuito, parámetros fisiológicos utilizados, curvas de sensibilidad y lista de motoneuronas reclutadas.
