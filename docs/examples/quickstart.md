# Documentación Técnica: `examples/quickstart.py`

## 1. Propósito General del Módulo
El script de ejemplo `examples/quickstart.py` es la guía de inicio rápido y tutorial mínimo (*Hello World*) de la librería MoscaBrain.

Muestra en menos de 30 líneas de código cómo:
1. Instanciar el agente corporizado `FlyAgent`.
2. Personalizar los órganos visuales (amplitud panorámica FOV de $270^\circ$, 32 omatidios y sensibilidad aumentada).
3. Administrar una recompensa hedónica de dopamina (`fly.reward`).
4. Ejecutar un bucle de simulación sensoriomotora con una fuente de luz puntual y decodificar el comando de acción resultante (`forward_thrust`, `turn_yaw`, `state`).

---

## 2. Importaciones y Justificación

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from moscabrain import FlyAgent
```

### Justificación de Importaciones:
1. **`sys`, `pathlib.Path`**: Inclusión de la raíz del repositorio en `sys.path`.
2. **`moscabrain.FlyAgent`**: Interfaz principal del agente.

---

## 3. Estructura y Código Explicado

### Paso 1: Creación del Agente
```python
fly = FlyAgent()
```
Carga la topología conectómica y el motor biofísico de dinámica de membranas.

### Paso 2: Configuración del Sistema Visual
```python
fly.vision.configure(fov_horizontal=270, ommatidia_count=32, sensitivity=1.2)
```
Ajusta la cobertura angular panorámica del ojo compuesto y define 16 omatidios en el ojo izquierdo y 16 en el derecho.

### Paso 3: Inyección de Dopamina
```python
fly.reward(amount=1.0, reason="azucar_encontrada")
```
Activa las neuronas del clúster PAM facilitando la atracción motora.

### Paso 4: Bucle Sensoriomotor (10 Pasos)
```python
for step_i in range(1, 11):
    action = fly.step(light_sources=[{"x": 450, "y": 300, "intensity": 1.5}])
```
Pasa la posición de la luz en cada ciclo e imprime el empuje lineal, par de giro angular y decaimiento pasivo de dopamina.
