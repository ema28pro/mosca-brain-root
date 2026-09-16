# Documentación Técnica: `moscabrain/connectome/banc_circuit.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/connectome/banc_circuit.py` implementa la clase `BANCCircuitManager`, responsable de analizar, filtrar y extraer subgrafos biológicos de alta fidelidad desde los archivos de datos binarios (formato Apache Feather) del conectoma **BANC v888** (*Brain and Nerve Cord*, Bates, Phelps, Kim et al., *Nature* 2026).

Se especializa en extraer dos subcircuitos fundamentales:
1. **Circuito de Escape por Fibra Gigante (*Giant Fiber / DNp01*)**: Vía sensorimotora descendente desde el cerebro cefálico hasta el neuromero torácico T2 del VNC, conectando con las motoneuronas del tergotrocánter (`TTMn`, salto) y las interneuronas periféricas (`PSI`) que comandan las motoneuronas de vuelo dorsolongitudinales (`DLM`).
2. **Circuito de Marcha Hacia Adelante (*P9 / DNp09*)**: Proyección bilateral descendente hacia los neuropilos motores de las patas (neuromeros T1, T2 y T3) a través de interneuronas premotoras torácicas.

Garantiza la preservación estricta de identificadores de 64 bits (*Root IDs*) como cadenas de texto (`str`) para evitar pérdidas de precisión numérica.

---

## 2. Importaciones y Justificación

```python
import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
import pandas as pd
import numpy as np
```

### Justificación de Importaciones:
1. **`os`, `json`, `pathlib.Path`**: Manejo multiplataforma de rutas en disco y serialización/deserialización de grafos cacheados en formato JSON.
2. **`typing` (`Dict`, `List`, `Optional`, `Any`, `Set`)**: Declaración tipada de estructuras de grafos, nodos y aristas.
3. **`pandas` (`pd`)**: Lectura ultrarrápida de tablas Apache Feather (`banc_888_meta.feather` con metadatos neuronales y `banc_888_edgelist_simple_v3.feather` con millones de conexiones sinápticas) e indexación por `banc_888_id`.
4. **`numpy` (`np`)**: Operaciones numéricas auxiliares sobre coordenadas y conteos sinápticos.

---

## 3. Lógica de Clases y Arquitectura

### Clase `BANCCircuitManager`
Administrador de extracción y caché de circuitos biológicos.

#### Atributos de Configuración y Archivos:
- `data_dir`: Ruta al directorio de datos BANC (`data/banc/`).
- `cache_dir`: Carpeta donde se persisten los grafos procesados (`data/banc/circuits/`).
- `meta_file`: Archivo `banc_888_meta.feather` con anotaciones celulares (neurotransmisor predicho, superclase, neuropilo, coordenadas 3D en nanómetros).
- `edge_file`: Archivo `banc_888_edgelist_simple_v3.feather` con la lista de conexiones dirigidas `(pre, post, count)`.
- `_meta_df`: Caché en memoria del DataFrame de metadatos (carga diferida *lazy*).

---

## 4. Métodos y Funciones Detalladas

### `BANCCircuitManager._get_meta() -> pd.DataFrame`
- **Propósito**: Carga diferida del archivo Feather con metadatos de las 188k neuronas de BANC v888.
- **Salida**: DataFrame indexado por el identificador único `banc_888_id`. Lanza `FileNotFoundError` si el archivo no existe.

---

### `BANCCircuitManager.extract_giant_fiber_circuit(synapse_threshold=3, force_recompute=False) -> Dict[str, Any]`
- **Propósito**: Extrae el subgrafo completo del reflejo de escape.
- **Algoritmo de Extracción**:
  1. Si existe en caché `giant_fiber_thresh_{synapse_threshold}.json` y no se fuerza recálculo, lo lee directamente.
  2. Define los Root IDs biológicos de DNp01 en BANC:
     - Izquierda: `"720575941509145950"`
     - Derecha: `"720575941451068597"`
  3. **Salto 1 (Hop-1)**: Encuentra todas las dianas postsinápticas directas con peso $\ge \text{synapse\_threshold}$.
  4. Filtra interneuronas intrínsecas del VNC y motoneuronas.
  5. **Salto 2 (Hop-2)**: Encuentra las conexiones desde las interneuronas hacia motoneuronas efectoras torácicas (`super_class == "motor"`).
  6. Extrae el subgrafo inducido de todas las aristas internas y poda nodos aislados.
  7. Construye la estructura estructurada con metadatos y la guarda en disco.
- **Entradas**:
  - `synapse_threshold` (*int*): Umbral mínimo de sinapsis para filtrar ruido anatómico (por defecto 3).
  - `force_recompute` (*bool*): Bandera para ignorar la caché existente.
- **Salida**: Diccionario JSON con `circuit_id`, `stats`, `nodes` y `edges`.

---

### `BANCCircuitManager.extract_p9_circuit(synapse_threshold=5, force_recompute=False) -> Dict[str, Any]`
- **Propósito**: Extrae el subgrafo de locomoción hacia adelante mediado por DNp09.
- **Root IDs de DNp09**:
  - `"720575941566493282"`, `"720575941433155799"`.
- **Lógica**: Sigue las proyecciones descendentes bilaterales hacia los neuromeros torácicos T1, T2 y T3 del VNC, capturando redes premotoras y motoneuronas de extensión/flexión tibial de las seis patas.
- **Salida**: Diccionario JSON serializable del subcircuito P9.

---

### `BANCCircuitManager._build_circuit_payload(...) -> Dict[str, Any]`
- **Propósito**: Normaliza y empaqueta la información celular biológica:
  - Extrae coordenadas tridimensionales en nanómetros `[x_nm, y_nm, z_nm]`.
  - Normaliza predicciones de neurotransmisor (`acetylcholine`, `gaba`, `glutamate`, `dopamine`, etc.) y puntaje de confianza.
  - Asigna banderas booleanas `is_stimulated_input` y `is_motor_output`.
  - Añade metadatos de procedencia (*provenance* de Nature 2026).
