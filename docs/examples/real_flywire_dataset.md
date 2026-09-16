# Documentación Técnica: `examples/real_flywire_dataset.py`

## 1. Propósito General del Módulo
El script de ejemplo `examples/real_flywire_dataset.py` proporciona una guía de inspección y exploración directa sobre los datos masivos del conectoma del consorcio **FlyWire (FAFB v783)**.

Demuestra:
1. Cómo cargar de forma eficiente las tablas columnares Parquet (`2025_Connectivity_783.parquet`) con más de **15 millones de sinapsis** y **138.639 neuronas**.
2. Cómo filtrar sinapsis con signo excitatorio ($+$) e inhibitorio ($-$).
3. Cómo inspeccionar Root IDs biológicos reales de 64 bits para neuronas gustativas de azúcar (*Sugar GRNs*) y neuronas descendentes de marcha P9.
4. Cómo consultar los pares pre-sinápticos y post-sinápticos en el DataFrame.
5. Cómo ensamblar la matriz de adyacencia dispersa `csr_matrix` y medir su consumo real de memoria RAM en megabytes.

---

## 2. Importaciones y Justificación

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from moscabrain import FlyWireConnectomeTopology
```

### Justificación de Importaciones:
1. **`sys`, `pathlib.Path`**: Inserción de la raíz en el path de Python.
2. **`moscabrain.FlyWireConnectomeTopology`**: Clase conectómica responsable de leer los archivos binarios de `eons_fly_brain/data/`.

---

## 3. Funciones y Flujo de Inspección

### `main()`
- **Flujo de Ejecución**:
  1. Instancia `real = FlyWireConnectomeTopology()`.
  2. Carga la tabla de conexiones con `real.load_connections_dataframe()` e imprime estadísticas globales:
     - Total de neuronas: $138.639$.
     - Total de conexiones sinápticas: $15.091.983$.
     - Desglose de sinapsis excitatorias frente a inhibitorias según la columna `Excitatory x Connectivity`.
  3. Muestra los Root IDs biológicos de las neuronas gustativas de probóscide y de las neuronas de marcha descendente P9 izquierda (`720575940627652358`) y derecha (`720575940635872101`).
  4. Realiza un filtrado de las primeras 5 sinapsis presinápticas que se originan en las neuronas de azúcar hacia sus dianas postsinápticas.
  5. Invoca `real.get_sparse_weight_matrix()` para construir la matriz dispersa `csr_matrix` ($138639 \times 138639$) e imprime su tamaño en memoria RAM (típicamente $\approx 172.7\text{ MB}$).
