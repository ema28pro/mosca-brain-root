# Documentación Técnica: `moscabrain/vision/compound_eye.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/vision/compound_eye.py` implementa la clase `CompoundEye` y su estructura de configuración `VisionConfig`, responsables de modelar el sistema visual facetado de *Drosophila melanogaster*.

Emula:
- La distribución retinotópica angular de los omatidios en los ojos izquierdo y derecho a lo largo de un **campo de visión panorámico (FOV)** de hasta $270^\circ$.
- Campos receptivos gaussianos con atenuación lumínica inversamente proporcional a la distancia.
- Detección biológica de estímulos de aproximación o sombras amenazantes (*looming*) mediante el cálculo de la tasa de expansión angular aparente ($d\theta/dt$) para activar neuronas LC4/LPLC2.

---

## 2. Importaciones y Justificación

```python
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict
import numpy as np
```

### Justificación de Importaciones:
1. **`dataclasses.dataclass`**: Modela el objeto de configuración `VisionConfig`.
2. **`typing` (`List`, `Tuple`, `Optional`, `Dict`)**: Anotaciones estáticas para vectores de señales retinianas y diccionarios de estímulos luminosos/sombras.
3. **`numpy` (`np`)**: Soporte computacional para trigonometría de proyecciones angulares (`np.radians`, `np.arctan2`), funciones exponenciales gaussianas (`np.exp`), remuestreo de bloques de imagen y ruido gaussiano fotónico (`np.random.normal`).

---

## 3. Lógica de Clases y Configuración

### 3.1 Clase `VisionConfig`
- `fov_horizontal` (*float*): Ángulo horizontal total de visión en grados (por defecto $270.0^\circ$).
- `ommatidia_count` (*int*): Número total de facetas omatidiales simuladas (32 por defecto; 16 por ojo).
- `sensitivity` (*float*): Ganancia de fotorrecepción (por defecto $1.0$).
- `looming_threshold` (*float*): Umbral de expansión angular para disparar alerta ($0.6$).
- `noise` (*float*): Desviación estándar del ruido fotónico en los fotorreceptores ($0.02$).

---

### 3.2 Clase `CompoundEye`

#### Atributos de Estado:
- `n_left`, `n_right`: Conteo de facetas por hemisferio cefálico.
- `left_angles`, `right_angles`: Vectores con los ángulos azimutales relativos de cada lente omatidial respecto a la cabeza $[-\theta_{\text{max}}, 0]$ y $[0, +\theta_{\text{max}}]$.
- `left_intensities`, `right_intensities`: Vectores `np.ndarray` con la excitación continua de cada fotorreceptor.
- `looming_signal`: Magnitud escalar de la señal de amenaza expansiva.

---

## 4. Métodos y Funciones Detalladas

### `CompoundEye.configure(fov_horizontal=None, ommatidia_count=None, sensitivity=None, looming_threshold=None)`
- **Propósito**: Permite modificar en tiempo de ejecución los parámetros visuales (por ejemplo, desde el panel web de control o la API REST). Recalcula automáticamente la partición angular de los omatidios.

---

### `CompoundEye._compute_ommatidia_angles()`
- **Propósito**: Distribuye linealmente los ejes ópticos de cada omatidio:
  - Ojo izquierdo: desde $-\text{half\_fov}$ hasta $0$.
  - Ojo derecho: desde $0$ hasta $+\text{half\_fov}$.

---

### `CompoundEye.process_environment(fly_x, fly_y, fly_angle, light_sources, shadows_or_threats) -> Tuple[np.ndarray, np.ndarray, float]`
- **Propósito**: Renderiza la escena visible de la arena 2D hacia la retina de la mosca.
- **Lógica Paso a Paso**:
  1. **Fuentes de Luz (Fototaxis)**:
     - Calcula la distancia $d$ y ángulo relativo $\theta_{\text{rel}}$ hacia cada bombilla/fuente lumínica.
     - Aplica atenuación espacial: $A(d) = \frac{I}{0.02 d + 1.0}$.
     - Activa cada omatidio mediante un campo receptivo gaussiano centrado en su ángulo óptico $\theta_i$:
       $$S_i = \exp\left(-0.5 \cdot \left(\frac{\Delta\theta_i}{0.25}\right)^2\right) \cdot A(d)$$
  2. **Detección de Sombras en Expansión (*Looming / LC4*)**:
     - Para cada amenaza de radio $r$ y distancia $d$:
       - Ángulo subtendido: $\theta_{\text{sub}} = 2 \cdot \arctan(r / d)$.
       - Tasa de expansión aparente: $E = \frac{r \cdot v}{d^2 + 1.0}$.
       - Si $\theta_{\text{sub}} > 0.4$ y $d < 120$: genera intensidad de *looming*: $\text{clip}(5.0 \cdot E + 0.8 \cdot \theta_{\text{sub}}, 0, 2.0)$.
  3. **Adición de Ruido y Saturación**:
     - Agrega ruido blanco gaussiano $\mathcal{N}(0, \sigma_{\text{ruido}})$ y escala por `sensitivity`.
- **Salida**: `(left_intensities, right_intensities, looming_signal)`.

---

### `CompoundEye.get_view_array() -> List[float]`
- **Salida**: Lista de números flotantes concatenando las intensidades del ojo izquierdo y derecho para visualización en el canvas web.
