# Documentación Técnica: `moscabrain/dopamine/system.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/dopamine/system.py` implementa la clase `DopamineSystem`, que actúa como la capa de control de alto nivel para la neuromodulación del conectoma. 

Modela dos ejes conductuales antagónicos biológicos en *Drosophila melanogaster*:
1. **Recompensa Apetitiva (*PAM Cluster*)**: Se activa ante el azúcar (sacarosa), aprendizaje condicionado positivo y eventos de éxito motor.
2. **Aversión y Castigo (*PPL1 Cluster*)**: Se activa ante estímulos aversivos (descargas, calor, colisiones o fallos en tareas).

Ofrece soporte para inyección directa de pulsos, historial de eventos recientes y evaluación automática de **triggers condicionales** que permiten implementar paradigmas de condicionamiento clásico y operante.

---

## 2. Importaciones y Justificación

```python
from typing import Callable, List, Dict, Optional
import time
```

### Justificación de Importaciones:
1. **`typing` (`Callable`, `List`, `Dict`, `Optional`)**: Define firmas de callbacks condicionales `Callable[[], Optional[float]]` y listas de eventos de recompensa.
2. **`time`**: Marca temporal en segundos UNIX (`time.time()`) para registrar la cronología exacta de los estímulos de dopamina.

---

## 3. Lógica de Clases y Arquitectura

### Clase `DopamineSystem`

#### Atributos Principales:
- `_engine`: Referencia al motor biofísico `ConnectomeEngine`.
- `triggers`: Lista de funciones de condición registradas que devuelven magnitudes de recompensa o castigo en cada paso.
- `reward_history`: Búfer circular que almacena los últimos 100 eventos de neuromodulación con marca temporal, paso de simulación, tipo (`REWARD_PAM` o `PUNISH_PPL1`), magnitud y motivo (`reason`).
- `total_rewards`: Acumulador escalar de la cantidad total de recompensa inyectada.
- `total_punishments`: Acumulador escalar del castigo total inyectado.

---

## 4. Métodos y Funciones Detalladas

### `DopamineSystem.trigger(amount=1.0, is_reward=True, reason="manual")`
- **Propósito**: Ejecuta la inyección inmediata de neuromodulador en el conectoma.
- **Entradas**:
  - `amount` (*float*): Intensidad del pulso de dopamina (rango sugerido $[0.1, 2.0]$).
  - `is_reward` (*bool*): `True` para activar PAM (recompensa); `False` para activar PPL1 (castigo).
  - `reason` (*str*): Etiqueta descriptiva del evento (ej. `"sacarosa_devorada"`, `"blackjack_win"`, `"colision"`).
- **Lógica**: Notifica a `_engine.trigger_dopamine(amount, is_reward)`, suma al acumulador respectivo y añade el evento al historial podando los más antiguos si excede 100 registros.

---

### `DopamineSystem.reward(amount=1.0, reason="recompensa")`
- **Propósito**: Azúcar o satisfacción: activa el clúster PAM de dopamina llamando a `trigger(amount, is_reward=True, reason=reason)`.

---

### `DopamineSystem.punish(amount=1.0, reason="castigo")` / `aversion(...)`
- **Propósito**: Estímulo aversivo: activa el clúster PPL1 llamando a `trigger(amount, is_reward=False, reason=reason)`.

---

### `DopamineSystem.add_condition(condition_func: Callable[[], Optional[float]], reason="trigger_auto")`
- **Propósito**: Registra un sensor o función heurística que se evalúa de manera autónoma en cada ciclo de la mosca.
- **Entradas**: `condition_func` (función sin argumentos que retorna `float` o `None`), `reason` (*str*).

---

### `DopamineSystem.evaluate_triggers()`
- **Propósito**: Itera sobre todas las funciones registradas en `triggers`:
  - Si retorna un valor positivo $> 0.0$: ejecuta `reward(amount=res)`.
  - Si retorna un valor negativo $< 0.0$: ejecuta `punish(amount=abs(res))`.
  - Captura excepciones internas silenciosamente para no interrumpir el bucle de simulación.

---

### `DopamineSystem.current_level -> float` (Propiedad)
- **Salida**: Nivel escalar actual de dopamina extracelular en el conectoma (`_engine.dopamine_level`).
