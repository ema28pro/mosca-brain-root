# Documentación Técnica: `examples/predator_escape.py`

## 1. Propósito General del Módulo
El script de ejemplo `examples/predator_escape.py` pone a prueba el circuito neural biológico más rápido del cerebro de la mosca: el **reflejo de salto y despegue de escape mediado por la Fibra Gigante (*Giant Fiber / DNp01*)**.

Compara dos situaciones experimentales:
1. **Ambiente Seguro (Control)**: Ausencia de estímulos amenazantes, verificando que la mosca permanezca en reposo o marcha normal sin batido alar ($0\text{ Hz}$).
2. **Aproximación de Depredador (*Looming*)**: Un objeto oscuro de radio grande aproximándose velozmente hacia la mosca, verificando la activación de los fotorreceptores, la transducción a las interneuronas LC4, el disparo de la Fibra Gigante, el salto balístico de escape (`ESCAPE_JUMP`) y el encendido inmediato del batido de alas a alta frecuencia ($210\text{ Hz}$).

---

## 2. Importaciones y Justificación

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from moscabrain import FlyAgent
```

### Justificación de Importaciones:
1. **`sys`, `pathlib.Path`**: Configuración de `sys.path` para ejecución directa.
2. **`moscabrain.FlyAgent`**: Agente biológico corporizado con visión y conectoma.

---

## 3. Protocolo Experimental Paso a Paso

### 1. Inicialización y Configuración Visual
- Instancia `fly = FlyAgent()`.
- Ajusta el campo visual panorámico y el umbral de detección de amenaza:
  `fly.vision.configure(fov_horizontal=270, looming_threshold=0.5)`.

### 2. Fase 1: Entorno Libre de Peligro
- Ejecuta `action_safe = fly.step()`.
- Verifica que el estado no sea de escape y que `wingbeat_hz == 0.0`.

### 3. Fase 2: Inyección de Sombra Amenazante
- Define una amenaza cercana en rápida aproximación:
  `threatening_shadow = [{"x": fly.x + 35, "y": fly.y + 20, "radius": 30.0, "speed": 12.0}]`.
- Ejecuta `action_threat = fly.step(threats=threatening_shadow)`.
- Consulta la señal calculada por los omatidios (`fly.vision.looming_signal`) y el nivel de activación en el conectoma (`fly.engine.get_group_activity("DN_GIANT_FIBER")`).
- Confirma que `action_threat.escape_jump == True`, `action_threat.state == ActionState.ESCAPE_JUMP` y `action_threat.wingbeat_hz == 210.0`.
