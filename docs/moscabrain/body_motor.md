# Documentación Técnica: `moscabrain/body/motor.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/body/motor.py` define el decodificador motor (*Descending Neurons to Body decoder*) y las estructuras de estado cinemático de la mosca. Traduce las tasas de disparo continuas y picos discretos de los grupos de **neuronas descendentes (DNs)** en comandos físicos actuables:
- Impulso de propulsión hacia adelante (`forward_thrust`).
- Par de giro y orientación angular (`turn_yaw`).
- Reflejo balístico de salto de escape mediado por la Fibra Gigante (*Giant Fiber*).
- Extensión del aparato bucal (probóscide) para alimentación.
- Comportamientos motores de acicalamiento (*grooming*) y reposo (*idle*).

---

## 2. Importaciones y Justificación

```python
from dataclasses import dataclass
from enum import Enum
import numpy as np
```

### Justificación de Importaciones:
1. **`dataclasses.dataclass`**: Modela el contenedor de salida `ActionOutput` de manera inmutable, limpia y eficiente.
2. **`enum.Enum`**: Define los estados discretos del repertorio conductual de la mosca (`ActionState`).
3. **`numpy` (`np`)**: Proporciona funciones de filtrado y acotamiento numérico (`np.clip`), aleatorización de saltos (`np.random.choice`) y operaciones booleanas vectorizadas sobre picos sinápticos (`np.any`).

---

## 3. Lógica de Clases y Estructuras

### 3.1 Enumeración `ActionState`
Representa el estado etológico en el que se encuentra la mosca:
- `IDLE`: Reposo motor estático.
- `WALKING`: Marcha hacia adelante con coordinación de patas trípode.
- `TURNING_LEFT` / `TURNING_RIGHT`: Viraje asimétrico a la izquierda o derecha.
- `FEEDING`: Inmovilización y extensión de probóscide ante sacarosa.
- `ESCAPE_JUMP`: Despegue balístico de supervivencia con salto y aleteo violento a 210 Hz.
- `GROOMING`: Comportamiento de limpieza de antenas u ojos.

---

### 3.2 Clase `ActionOutput`
Representa el paquete de control cinemático resultante:
- `forward_thrust` (*float*): Rango $[0.0, 1.0]$.
- `turn_yaw` (*float*): Rango $[-1.0, 1.0]$ (negativo = izquierda, positivo = derecha).
- `proboscis_extended` (*bool*): Bandera de alimentación.
- `escape_jump` (*bool*): Bandera de salto de escape.
- `grooming` (*bool*): Bandera de acicalamiento.
- `state` (*ActionState*): Estado etológico discretizado.
- `wingbeat_hz` (*float*): Frecuencia de batido alar en Hertz ($0.0\text{ Hz}$ en marcha; $\sim 210\text{ Hz}$ en vuelo o escape).

#### Métodos:
- `to_dict() -> dict`: Serializa todos los campos en tipos primitivos de Python con redondeo para su transmisión por WebSocket y endpoints REST.

---

### 3.3 Clase `FlyMotorBody`
Implementa el filtro pasa-bajos neuromuscular que suaviza las oscilaciones neuronales de alta frecuencia, simulando la inercia biomecánica de los músculos de las patas y alas.

#### Atributos de Suavizado:
- `fwd_activity`: Actividad acumulada de avance.
- `steer_l_activity`, `steer_r_activity`: Actividad acumulada de dirección izquierda/derecha.
- `escape_activity`: Actividad acumulada de escape.
- `proboscis_activity`: Actividad de probóscide.
- `groom_activity`: Actividad de acicalamiento.

---

## 4. Métodos y Funciones Detalladas

### `FlyMotorBody.__init__(connectome_engine)`
- **Entradas**: `connectome_engine` (instancia de `ConnectomeEngine`).
- Inicializa los acumuladores de inercia muscular en cero.

---

### `FlyMotorBody.decode_action() -> ActionOutput`
- **Propósito**: Ejecuta la cascada jerárquica de toma de decisiones etológicas según prioridades biológicas de supervivencia:
  1. **Filtrado Temporal Neuromuscular**:
     $$A_{\text{músculo}}(t) = 0.7 \cdot A_{\text{músculo}}(t-1) + 0.3 \cdot \text{disparo\_neuronal}(t)$$
  2. **Prioridad 1: Reflejo de Escape (Giant Fiber)**:
     - Si hay picos en `DN_GIANT_FIBER` o la actividad excede $0.01$, se activa inmediatamente `ESCAPE_JUMP`. Retorna empuje máximo $1.0$, giro aleatorio $\pm 0.8$, y frecuencia de alas de $210\text{ Hz}$.
  3. **Prioridad 2: Alimentación (DN_PROBOSCIS)**:
     - Si `proboscis_activity > 0.12`, entra en `FEEDING`, frenando a $0.05$ de empuje y desplegando la probóscide.
  4. **Prioridad 3: Acicalamiento (DN_GROOMING)**:
     - Si `groom_activity > 0.2`, activa `GROOMING` en posición estática.
  5. **Prioridad 4: Marcha y Navegación Normal**:
     - Calcula el empuje neto:
       $$\text{thrust} = \text{clip}(2.5 \cdot A_{\text{fwd}} + 0.15, 0.0, 1.0)$$
     - Calcula la dirección neta por diferencia bilateral:
       $$\text{steer} = \text{clip}(3.0 \cdot (A_{\text{steer\_r}} - A_{\text{steer\_l}}), -1.0, 1.0)$$
- **Salida**: Objeto `ActionOutput` con la acción resultante.
