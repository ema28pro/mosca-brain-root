# Documentación Técnica: `examples/blackjack_21.py`

## 1. Propósito General del Módulo
El script de ejemplo `examples/blackjack_21.py` demuestra cómo utilizar el sistema olfativo del conectoma de FlyWire para **codificación simbólica abstracta** y toma de decisiones biofísica en un juego de cartas (Blackjack / 21).

Ilustra:
- Cómo convertir variables discretas del juego (la puntuación de la mano de la mosca y la carta descubierta del repartidor) en patrones glomerulares en el lóbulo antenal.
- La lectura de la intención de riesgo frente a cautela a través de la competencia entre neuronas de salida del cuerpo fungiforme: $MBON_{\text{approach}}$ (apetitivo, impulsa a pedir carta) vs. $MBON_{\text{avoid}}$ (aversivo, impulsa a plantarse).
- El bucle de retroalimentación por condicionamiento dopaminérgico: recompensar las victorias activando el clúster PAM y castigar las derrotas/excesos activando PPL1.

---

## 2. Importaciones y Justificación

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import random
import time
from moscabrain import FlyAgent
```

### Justificación de Importaciones:
1. **`sys`, `pathlib.Path`**: Inserción dinámica de la raíz del proyecto en `sys.path` para permitir la ejecución directa del script (`python examples/blackjack_21.py`) sin requerir instalación previa del paquete en el entorno virtual.
2. **`random`**: Selección de cartas al azar de la baraja $[2..11]$ y pequeña variabilidad estocástica en la decisión motora.
3. **`time`**: Mediciones y pausas de consola.
4. **`moscabrain.FlyAgent`**: Agente biológico completo.

---

## 3. Funciones Detalladas

### `deal_card() -> int`
- **Propósito**: Extrae una carta al azar de una baraja estándar de Blackjack con valores entre 2 y 11 (los ases valen 11 por defecto y las figuras valen 10).
- **Salida**: Entero representativo del valor de la carta.

---

### `play_blackjack_round(fly: FlyAgent, round_num: int)`
- **Propósito**: Ejecuta una mano individual de Blackjack:
  1. **Reparto**: Reparte 2 cartas a la mosca y 2 cartas al croupier.
  2. **Toma de Decisiones Neuronal**:
     - Mientras la mosca tenga $<21$ puntos:
       - Codifica la mano en los glomérulos: `fly.olfaction.encode_blackjack_hand(fly_score, dealer_hand[0])`.
       - Ejecuta un paso del conectoma: `fly.step()`.
       - Consulta la actividad de $MBON_{\text{approach}}$ y $MBON_{\text{avoid}}$.
       - Si $MBON_{\text{approach}} - MBON_{\text{avoid}} > 0$: decide `"PEDIR CARTA"`. Si no: decide `"PLANTARSE"`.
  3. **Turno del Croupier**: Pide cartas obligatoriamente hasta alcanzar al menos 17 puntos si la mosca no se pasó.
  4. **Modulación por Dopamina**:
     - Si la mosca se pasa de 21: `fly.punish(1.0, reason="derrota_exceso")`.
     - Si la mosca gana: `fly.reward(1.5, reason="victoria_blackjack")`.
     - Si el croupier gana: `fly.punish(0.6, reason="derrota_menor")`.
     - Si empatan: no hay inyección de dopamina.
- **Entradas**: `fly` (*FlyAgent*), `round_num` (*int*).

---

### `main()`
- **Propósito**: Función de entrada que inicializa una instancia de `FlyAgent`, ejecuta 5 rondas consecutivas para observar la evolución de la dopamina e imprime el total acumulado al finalizar.
