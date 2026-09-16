# Documentación Técnica: `examples/dopamine_conditioning.py`

## 1. Propósito General del Módulo
El script de ejemplo `examples/dopamine_conditioning.py` implementa un protocolo clásico de **aprendizaje asociativo por condicionamiento pavloviano apetitivo** sobre el cuerpo fungiforme de la mosca (*Mushroom Body*).

En la neurobiología de *Drosophila*, las células de Kenyon (KC) codifican representaciones olfativas esparsas. Cuando un olor coincide temporalmente con la estimulación gustativa de azúcar, las neuronas dopaminérgicas PAM liberan dopamina en los compartimentos correspondientes del cuerpo fungiforme, modulando el peso sináptico de las neuronas de salida MBON (*Mushroom Body Output Neurons*).

El experimento compara:
1. **Línea base pre-entrenamiento**: Respuesta ante el estímulo condicionado (CS, olor a vinagre de manzana).
2. **Fase de adquisición asociativa**: Emparejamiento simultáneo de olor con pulsos de dopamina (`fly.reward`).
3. **Prueba de memoria asociativa**: Presentación exclusiva del olor sin recompensa para verificar el sesgo apetitivo inducido ($MBON_{\text{approach}}$).

---

## 2. Importaciones y Justificación

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from moscabrain import FlyAgent
```

### Justificación de Importaciones:
1. **`sys`, `pathlib.Path`**: Inclusión del directorio raíz en `sys.path` para garantizar ejecución independiente desde consola.
2. **`moscabrain.FlyAgent`**: Agente biológico que integra el conectoma de FlyWire.

---

## 3. Flujo Experimental Paso a Paso

### 1. Registro de Línea Base Pre-Entrenamiento
- Presenta el olor condicionado: `fly.step(odor_name="vinagre_manzana")`.
- Mide la actividad basal en los grupos neuronales:
  - `fly.engine.get_group_activity("MBON_APPROACH")`
  - `fly.engine.get_group_activity("MBON_AVOID")`

### 2. Fase de Entrenamiento (5 Ensayos de Emparejamiento)
- Para cada ensayo $1..5$:
  - Expone a la mosca al estímulo olfativo: `fly.step(odor_name="vinagre_manzana")`.
  - Inyecta un pulso concomitante de dopamina: `fly.reward(amount=1.2)`.
  - Imprime el nivel de dopamina extracelular alcanzado.

### 3. Prueba de Memoria Asociativa Post-Entrenamiento
- Presenta el olor `"vinagre_manzana"` en 3 pasos consecutivos sin inyectar dopamina adicional.
- Evalúa el incremento neto en la tasa de disparo de $MBON_{\text{approach}}$ y el comando motor resultante (`action.state`).
