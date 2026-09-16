# Documentación Técnica: `moscabrain/olfaction/antennal_lobe.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/olfaction/antennal_lobe.py` implementa la clase `AntennalLobe`, encargada de modelar el sistema quimiosensorial olfativo de *Drosophila melanogaster*.

Proporciona dos capacidades clave:
1. **Quimiorrecepción Natural**: Simula la exposición a volátiles biológicos reconocidos por la mosca (sacarosa, vinagre de manzana, plátano, humo repelente, feromonas sexuales, etanol) mediante firmas de activación glomerular en el lóbulo antenal.
2. **Codificación Simbólica Artificial**: Permite proyectar estados simbólicos abstractos de juegos sobre los glomérulos olfativos (por ejemplo, piezas de Tetris $I, O, T, S, Z, J, L$ o combinaciones de manos de Blackjack/21: total del jugador vs. carta visible del croupier).

---

## 2. Importaciones y Justificación

```python
from typing import Dict, List, Optional
import numpy as np
```

### Justificación de Importaciones:
1. **`typing` (`Dict`, `List`, `Optional`)**: Define tipos para el diccionario de firmas químicas y parámetros opcionales.
2. **`numpy` (`np`)**: Representa los vectores de disparo glomerular `np.ndarray` en `float32`, realiza operaciones de interpolación/padding (`np.pad`), truncado (`np.clip`) y generación pseudoaleatoria determinista para olores no catalogados.

---

## 3. Lógica de Clases y Estructuras

### Clase `AntennalLobe`

#### Constante `KNOWN_ODORS`:
Diccionario con las firmas de afinidad glomerular precalibradas para 16 glomérulos:
- `"vinagre_manzana"`: Olor atractor acético con predominancia en los primeros glomérulos.
- `"sacarosa_azucar"`: Marcador dulce con activación de glomérulos 2 y 3.
- `"platano_fruta"`, `"humo_repelente"`, `"feromona_pareja"`, `"alcohol_etanol"`.
- Perfiles monoméricos para Tetris: `"tetris_mentol_I"`, `"tetris_sacarosa_O"`, etc.

#### Atributos de Estado:
- `num_glomeruli`: Cantidad de canales glomerulares (16 por defecto).
- `glomerular_activity`: Vector `np.ndarray` de tamaño `num_glomeruli` con valores en el rango $[0.0, 2.0]$.
- `active_odor_label`: Nombre o etiqueta del olor actualmente activo (`"aire_limpio"` en reposo).
- `concentration`: Concentración ambiental del químico.
- `symbol_mapping`: Tabla hash dinámica `Dict[str, int]` para asociar símbolos abstractos a canales glomerulares únicos.

---

## 4. Métodos y Funciones Detalladas

### `AntennalLobe.expose_odor(odor_name: str, concentration: float = 1.0) -> np.ndarray`
- **Propósito**: Expone las antenas a un olor por su nombre.
- **Entradas**:
  - `odor_name` (*str*): Nombre del compuesto.
  - `concentration` (*float*): Intensidad (acotada a $[0.0, 2.0]$).
- **Lógica**:
  - Si el olor está en `KNOWN_ODORS`: ajusta la dimensión del perfil a `num_glomeruli` (recortando o haciendo padding con ceros) y multiplica por `concentration`.
  - Si el olor es nuevo: genera un hash determinista a partir de la suma de caracteres ASCII del nombre (`seed = sum(ord(c) for c in odor_name)`) y produce un patrón glomerular esparso (*sparse pattern*, activando solo valores $> 0.6$).
- **Salida**: Vector `np.ndarray` con la actividad glomerular resultante.

---

### `AntennalLobe.encode_symbol(symbol: str, channel: Optional[int] = None, intensity: float = 1.0) -> np.ndarray`
- **Propósito**: Mapea un concepto abstracto a una firma olfativa biológicamente verosímil.
- **Lógica**: Activa el canal asignado con intensidad $1.0$ y añade excitación cruzada difusa del $20\%$ ($0.2$) a los glomérulos vecinos adyacentes $(\text{channel} \pm 1)$, emulando la dispersión lateral por interneuronas locales.
- **Salida**: Vector `np.ndarray` de actividad.

---

### `AntennalLobe.encode_blackjack_hand(player_total: int, dealer_upcard: int) -> np.ndarray`
- **Propósito**: Codificación dual para el juego de Blackjack:
  - Canales 0 al 11: Codifican el puntaje de la mano del jugador (rango 10 a 21) con amplitud $0.9$.
  - Canales 12 al 15: Codifican la carta visible del repartidor con amplitud $0.7$.
- **Salida**: Vector `np.ndarray` glomerular.

---

### `AntennalLobe.encode_tetris_piece(piece_type: str, intensity: float = 1.0) -> np.ndarray`
- **Propósito**: Mapea las 7 piezas clásicas del Tetris a fragancias sintéticas precalibradas:
  - $I \rightarrow$ Mentol
  - $O \rightarrow$ Sacarosa
  - $T \rightarrow$ Lavanda
  - $S \rightarrow$ Cítrico
  - $Z \rightarrow$ Humo
  - $J \rightarrow$ Plátano
  - $L \rightarrow$ Naranja

---

### `AntennalLobe.clear()`
- **Propósito**: Restablece el vector glomerular a ceros, fija la etiqueta en `"aire_limpio"` y la concentración en $0.0$.

---

### `AntennalLobe.get_activity_vector() -> np.ndarray`
- **Salida**: Copia independiente en memoria del vector de actividad glomerular actual.
