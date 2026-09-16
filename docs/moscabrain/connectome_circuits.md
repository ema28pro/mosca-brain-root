# Documentación Técnica: `moscabrain/connectome/circuits.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/connectome/circuits.py` implementa la clase `FlyWireConnectomeTopology`, la cual carga y organiza la topología cerebral completa de *Drosophila melanogaster* a partir de los datos oficiales del consorcio **FlyWire (FAFB v783 / Nature 2024)**:
- Carga las **138.639 neuronas reales** y sus Root IDs biológicos desde `2025_Completeness_783.csv`.
- Mapea las **15.091.983 conexiones sinápticas biológicas** desde `2025_Connectivity_783.parquet`.
- Construye la matriz de adyacencia dispersa $W$ ($138639 \times 138639$) en formato comprimido CSR (*Compressed Sparse Row*) con signos de excitación/inhibición reales.
- Indexa poblaciones celulares funcionalmente críticas identificadas en la literatura: neuronas gustativas de azúcar (*Sugar GRNs*), neuronas de marcha P9, detectores de amenaza visual LC4 (*looming*), neuronas de escape *Giant Fiber*, neuronas descendentes de dirección DNa01/DNa02, motoneuronas de alimentación MN9, neuronas de acicalamiento aDN1, receptores olfativos Or56a, neuronas dopaminérgicas PAM (recompensa) y PPL1 (aversión), y neuronas de salida del cuerpo fungiforme (MBONs).

---

## 2. Importaciones y Justificación

```python
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
import pickle
import numpy as np
import pandas as pd
from scipy import sparse
```

### Justificación de Importaciones:
1. **`pathlib.Path`**: Manejo seguro y multiplataforma de las rutas hacia los archivos binarios de `eons_fly_brain/data/`.
2. **`typing` (`Dict`, `List`, `Optional`, `Tuple`, `Set`)**: Tipado estático para mapeos de IDs de 64 bits a índices contiguos `[0, 138638]`.
3. **`pickle`**: Deserialización del diccionario de anotaciones celulares de la zona subesofágica (`sez_neurons.pickle`).
4. **`numpy` (`np`)**: Creación de arrays de índices contiguos en memoria `int32` para indizado rápido sin copias innecesarias.
5. **`pandas` (`pd`)**: Lectura de archivos columnares Parquet (`pyarrow`) y CSV con tiempos de carga óptimos.
6. **`scipy.sparse`**: Estructura de matriz dispersa `csr_matrix` indispensable para almacenar 15M de elementos no nulos en una matriz de $1.92 \times 10^{10}$ entradas sin agotar la memoria RAM.

---

## 3. Lógica de Clases y Arquitectura

### Clase `FlyWireConnectomeTopology`

#### Atributos de Identificación y Topología:
- `num_neurons`: Constante `138639`.
- `flyid2index`: Diccionario que mapea `Root ID (int64) -> Índice contiguo [0..138638]`.
- `index2flyid`: Diccionario inverso `Índice contiguo -> Root ID`.
- `sugar_grn_indices`: Índices de las 21 neuronas receptoras gustativas de sacarosa en la probóscide.
- `p9_left_idx`, `p9_right_idx`: Índices de las neuronas descendentes de marcha P9 izquierda (`720575940627652358`) y derecha (`720575940635872101`).
- `lc4_indices`: Índices de las 104 neuronas columelares LC4 que disparan ante estímulos de aproximación o sombras amenazantes (*looming*).
- `giant_fiber_indices`: Índices de las 2 neuronas gigantes de escape (`720575940622838154` y `720575940632499757`).
- `dna_left_indices`, `dna_right_indices`: Neuronas descendentes DNa01 y DNa02 que modulan los giros sacádicos y la tropotaxis.
- `mn9_indices`: Motoneuronas del labellum implicadas en el reflejo de extensión de probóscide.
- `adn1_indices`: Neuronas de acicalamiento de antenas y cabeza.
- `or56a_indices`: 39 receptores olfativos antenales de geosmina/alimento.
- `pam_dopamine_indices`: Neuronas dopaminérgicas apetitivas conectadas postsinápticamente a las *Sugar GRNs*.
- `ppl1_dopamine_indices`: Neuronas dopaminérgicas aversivas.
- `mbon_approach_indices` / `mbon_avoid_indices`: Neuronas de salida del cuerpo fungiforme moduladas por la dopamina.

---

## 4. Métodos y Funciones Detalladas

### `FlyWireConnectomeTopology._load_metadata()`
- **Lógica**:
  1. Lee `2025_Completeness_783.csv` y genera los diccionarios de conversión `flyid2index` e `index2flyid`.
  2. Si existe `sez_neurons.pickle`, deserializa anotaciones de tipos neuronales.
  3. Convierte las listas de Root IDs biológicos de la literatura en arrays de numpy `int32`.
  4. Divide las neuronas LC4 en mitades simétricas izquierda y derecha para la visión fotorreceptora binocular.

---

### `FlyWireConnectomeTopology.load_connections_dataframe() -> pd.DataFrame`
- **Propósito**: Carga diferida del archivo Parquet con las 15M de conexiones.
- **Salida**: DataFrame con columnas `Presynaptic_Index`, `Postsynaptic_Index` y `Excitatory x Connectivity`. Lanza `FileNotFoundError` si el archivo no está presente.

---

### `FlyWireConnectomeTopology.get_sparse_weight_matrix() -> sparse.csr_matrix`
- **Propósito**: Ensambla y cachea la matriz sináptica $W$ de $138639 \times 138639$.
- **Lógica de Conexión y Descubrimiento Heurístico**:
  1. Extrae los arrays `rows` (postsinápticos), `cols` (presinápticos) y `weights` (pesos con signo).
  2. Inicializa la matriz `csr_matrix((weights, (rows, cols)), shape=(138639, 138639))`.
  3. **Descubrimiento de PAM**: Realiza una multiplicación dispersa sobre las columnas de `sugar_grn_indices` y selecciona las 32 neuronas postsinápticas con mayor fuerza de entrada convergente.
  4. **Descubrimiento de MBONs Apetitivas**: Multiplica sobre las neuronas PAM descubiertas para aislar las 24 dianas descendentes con mayor sinapsis.
  5. **Descubrimiento de PPL1 y MBONs Aversivas**: Aísla las poblaciones aversivas asociadas al lóbulo vertical del cuerpo fungiforme.
- **Salida**: Objeto `scipy.sparse.csr_matrix` en formato `float32`.
