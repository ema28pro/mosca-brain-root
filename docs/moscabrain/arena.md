# Documentación Técnica: `moscabrain/arena.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/arena.py` implementa el entorno virtual 2D (`SimulationArena`) donde la mosca interactúa con estímulos físicos y químicos. Simula:
- Plumas de concentración química de olores (como sacarosa o vinagre) evaluadas localmente por las dos antenas de la mosca.
- Fuentes lumínicas orientadas a la fototaxis.
- Sombras de depredadores en movimiento o controlables interactivamente que desencadenan la respuesta de *looming* y salto de escape.
- Física de colisiones contra paredes reflectantes y contacto biológico del aparato bucal (probóscide y *labellum*) con gotas de sacarosa para alimentación y recompensa de dopamina.

---

## 2. Importaciones y Justificación

```python
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import numpy as np
from .agent import FlyAgent
from .body.motor import ActionOutput
```

### Justificación de Importaciones:
1. **`dataclasses` (`dataclass`, `field`)**: Permite declarar entidades de datos concisas y tipadas (`FoodItem`, `LightSource`, `ThreatShadow`).
2. **`typing` (`List`, `Dict`, `Optional`)**: Anotación de tipos para listas de entidades y diccionarios de estado de la arena.
3. **`numpy` (`np`)**: Empleado para cálculos de distancias euclidianas (`np.hypot`), ángulos hacia objetivos (`np.arctan2`), funciones de dispersión de plumas olfativas cuadráticas y acotamiento de límites (`np.clip`).
4. **`.agent.FlyAgent`**: Factoría de instanciación del agente que conecta el conectoma subyacente.
5. **`.body.motor.ActionOutput`**: Tipo de retorno de la acción física en cada paso de simulación.

---

## 3. Lógica de Clases y Estructuras de Datos

### 3.1 Clases de Datos (Entidades de la Arena)
- **`FoodItem`**:
  - `id` (*str*): Identificador único de la gota.
  - `x`, `y` (*float*): Coordenadas en la arena.
  - `radius` (*float*): Radio visual y de detección (por defecto 12.0 px).
  - `nutritive_value` (*float*): Valor energético restante (inicia en 1.0 y se reduce progresivamente mientras la mosca come).
- **`LightSource`**:
  - `id` (*str*), `x`, `y` (*float*).
  - `intensity` (*float*): Intensidad lumínica.
  - `color` (*str*): Color hexadecimal (ej. `#ffe066`).
- **`ThreatShadow`**:
  - `id` (*str*), `x`, `y` (*float*), `radius` (*float*), `speed` (*float*), `vx`, `vy` (*float*): Vector de velocidad para sombras en movimiento continuo o interactivas.

---

### 3.2 Clase `SimulationArena`
Contenedor principal del mundo físico y sensoriomotor.

#### Atributos Clave:
- `width`, `height`: Dimensiones en píxeles (por defecto 800x600).
- `agent`: Instancia de `FlyAgent` ubicada inicialmente en el centro `(width/2, height/2)`.
- `foods`, `lights`, `threats`: Listas dinámicas de estímulos activos.
- `scenario_name`: Escenario activo (`"alimento_dopamina"`, `"escape_depredador"`, `"fototaxis_luz"`, `"olfato_quimico"`, `"exploracion_libre"`).
- `PROBOSCIS_REACH = 16.0`: Distancia anterior en píxeles desde el centro corporal donde se ubica el *labellum* de la probóscide.

---

## 4. Métodos y Funciones Detalladas

### `SimulationArena.load_scenario(scenario_name: str)`
- **Propósito**: Restablece el entorno y carga la configuración de estímulos para experimentos predeterminados.
- **Entradas**: `scenario_name` (*str*).
- **Escenarios Soportados**:
  - `"alimento_dopamina"`: 3 gotas de sacarosa para aprendizaje apetitivo.
  - `"escape_depredador"`: Sombra amenazante con luz ambiental tenue.
  - `"fototaxis_luz"`: Fuente puntual intensa para evaluar orientación fototáctica.
  - `"olfato_quimico"`: Pluma de aroma a vinagre de manzana.

---

### `SimulationArena.step() -> ActionOutput`
- **Propósito**: Avanza un tick completo de la simulación del mundo.
- **Lógica Paso a Paso**:
  1. **Cinemática de Amenazas**: Actualiza posiciones de sombras con velocidad `vx, vy` y rebota en bordes.
  2. **Gradiente Olfativo Antenal**:
     - Calcula la posición anatómica de las dos antenas:
       $$\text{cabeza} = (x + 8\cos\theta, y + 8\sin\theta)$$
       $$\text{antena izquierda/derecha} = \text{cabeza} \pm (\sin\theta \cdot 6.5, -\cos\theta \cdot 6.5)$$
     - Evalúa la concentración de la pluma cuadrática según la distancia euclidiana:
       $$C(d) = \left[\max\left(0, 1 - \frac{d}{240}\right)\right]^2$$
     - Pasa las concentraciones independientes izquierda y derecha al agente para quimiotaxis biológica (*tropotaxis bilateral*).
  3. **Paso del Conectoma**: Ejecuta `agent.step(...)`.
  4. **Paredes Reflectantes**: Si la mosca toca un borde con margen de 15 px, se proyecta el ángulo de rebote $(\pi - \theta$ o $-\theta)$.
  5. **Contacto Bucal y Alimentación**:
     - Evalúa si la probóscide o la cabeza alcanzan físicamente una gota de sacarosa.
     - Si hay contacto: detiene la marcha (`start_feeding()`), estimula neuronas gustativas (*Sugar GRNs*) y reduce `nutritive_value`.
     - Si la gota se consume por completo, inyecta un pulso fuerte de dopamina (`reward(1.5, reason="sacarosa_devorada")`) y la remueve de la arena.
- **Salida**: Objeto `ActionOutput` con la acción resultante.

---

### `SimulationArena.get_state() -> dict`
- **Propósito**: Genera el estado serializable para WebSocket y REST en FastAPI.
- **Salida**: Diccionario que incluye dimensiones de la arena, lista de comida, luces, amenazas, telemetría completa de la mosca (`agent.get_telemetry()`) y diagnósticos detallados (contraste antenal, error angular hacia la comida más cercana, tasas de disparo de $P9$ y $DNa$).

---

### `SimulationArena.remove_item(...) -> bool` y `move_item(...) -> bool`
- **Propósito**: Métodos de manipulación en tiempo real desde la interfaz web (arrastrar y soltar con el ratón o borrar con doble clic/teclado).
- **Entradas**: `item_type` (`"food"`, `"light"`, `"threat"`, `"fly"`), coordenadas `x, y`, identificador opcional `item_id`, y radio de tolerancia.
- **Salida**: `True` si el elemento fue encontrado y modificado; `False` en caso contrario.
