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

## 4. Decodificación Cinemática y Física
La decodificación motora se realiza directamente en el conectoma a través de `self.engine.get_motor_output()` y `self._update_physics()` en `FlyWireAgent` y `BANCAgent`, asegurando latencia mínima sin capas intermedias obsoletas.

