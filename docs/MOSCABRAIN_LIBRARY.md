# Documentación Técnica de la Librería MoscaBrain

**MoscaBrain** (`moscabrain`) es una biblioteca en Python para Inteligencia Artificial Corporizada (*Embodied AI*) y Neurociencia Computacional que modela y simula el cerebro adulto completo de la mosca de la fruta (*Drosophila melanogaster*). 

La biblioteca utiliza la topología conectómica oficial del consorcio **FlyWire** (v783, Nature 2024), integrando **138.639 neuronas catalogadas** y **15.091.983 conexiones sinápticas biológicas**, vinculadas a órganos sensoriales virtuales (ojos compuestos, lóbulo antenal) y actuadores motores corporizados.

---

## 1. Arquitectura General del Sistema

```
                    ┌────────────────────────────────────────────────┐
                    │               ÓRGANOS SENSORIALES              │
                    └───────────────────────┬────────────────────────┘
                                            │
           ┌────────────────────────────────┼────────────────────────────────┐
           ▼                                ▼                                ▼
  [ CompoundEye / HexEye ]        [ AntennalLobe (Olfato) ]        [ Gustación (Azúcar) ]
   - Omatidios Retinotópicos       - 16 Canales Glomerulares        - Sugar GRNs en SEZ
   - FOV / Detección Looming       - Quimiorrecepción y Símbolos
           │                                │                                │
           └────────────────────────────────┼────────────────────────────────┘
                                            ▼
                    ┌────────────────────────────────────────────────┐
                    │            CONECTOME ENGINE (LIF)              │
                    │        138.639 Neuronas · 15.09M Sinapsis      │
                    │     (Matriz Sparse CSR con dinámica V / I_syn) │
                    └───────────────────────┬────────────────────────┘
                                            │
           ┌────────────────────────────────┴────────────────────────────────┐
           ▼                                                                 ▼
[ Neuromodulación Dopaminérgica ]                              [ Vías Motoras Descendentes (DNs) ]
  - Clúster PAM (Recompensa)                                    - P9 (Locomoción y Empuje Fwd)
  - Clúster PPL1 (Aversión)                                     - DNa01 / DNa02 (Viraje / Yaw)
                                                                - Giant Fiber (Salto de Escape)
                                                                - MN9 (Probóscide / Alimentación)
                                                                             │
                                                                             ▼
                                                                [ Cinemática y Entorno ]
                                                                 - SimulationArena / GameBridge
```

---

## 2. Módulos y Clases de la Biblioteca

### 2.1. `moscabrain.agent.FlyAgent`
Es la clase orquestadora central. Encapsula los órganos sensoriales, el motor de dinámicas neuronales, el sistema de dopamina y la cinemática corporal en el espacio 2D.

#### Atributos Principales:
- `topology`: Instancia de `FlyWireConnectomeTopology` con las anotaciones y matriz sináptica.
- `engine`: Instancia de `ConnectomeEngine` que ejecuta las ecuaciones biofísicas LIF.
- `vision`: `CompoundEye` tradicional con campo visual angular (FOV).
- `hex_vision`: `HexagonalCompoundEye` para captura directa de imágenes de pantalla o videojuegos.
- `olfaction`: `AntennalLobe` para procesamiento glomerular de aromas.
- `dopamine`: `DopamineSystem` para neuromodulación PAM/PPL1.
- `x`, `y`, `angle`, `speed`: Variables cinemáticas del cuerpo de la mosca.
- `is_feeding`: Booleano que indica si la probóscide está extendida consumiendo alimento.

#### Métodos Clave:
- `step(light_sources=None, threats=None, odor_signal=None, odor_name=None, symbol=None, substeps=1) -> ActionOutput`:
  Avanza un ciclo completo: lee el entorno, calcula la activación de omatidios y antenas, inyecta corrientes a las neuronas correspondientes, avanza el conectoma `substeps` pasos y decodifica el movimiento corporal.
- `step_screen(screen_frame, stereo_mode="split", substeps=5) -> Tuple[float, float, bool]`:
  Alimenta una matriz de píxeles (`np.ndarray`) directamente a los ojos compuestos y retorna `(forward_thrust, turn_yaw, escape_jump)`.
- `reward(amount=1.0, reason="recompensa")`:
  Inyecta dopamina estimulando el clúster PAM real.
- `punish(amount=1.0, reason="castigo")`:
  Aplica una señal aversiva activando el clúster PPL1.
- `start_feeding()` / `stop_feeding()`:
  Controla el programa motor de alimentación bloqueando o liberando la locomoción.
- `get_telemetry() -> dict`:
  Retorna una instantánea serializable del estado cinemático, sensorial y de espigas neuronales.

---

### 2.2. `moscabrain.connectome`

#### `FlyWireConnectomeTopology` (`circuits.py`)
Responsable de cargar y estructurar los datos conectómicos reales de FlyWire v783 almacenados en `eons_fly_brain/data/`:
- `2025_Connectivity_783.parquet`: 15.091.983 conexiones sinápticas dirigidas con sus respectivos pesos sinápticos biológicos (número de sitios de contacto presinápticos/postsinápticos).
- `2025_Completeness_783.csv`: Catálogo oficial de las 138.639 neuronas con sus Root IDs de 64 bits.
- `sez_neurons.pickle`: Clasificación de subtipos celulares en la zona subesofágica (SEZ) y neuronas motoras.

Mapea y categoriza poblaciones neuronales críticas:
- **Sugar GRNs**: 21 neuronas receptoras gustativas de sacarosa.
- **P9**: Par bilateral (`p9_left_idx`, `p9_right_idx`) de neuronas descendentes que gobiernan el avance de marcha.
- **LC4**: 104 neuronas visuales de proyección (*Lobula Columnar 4*) especializadas en detección de sombras en expansión (*looming*).
- **Giant Fiber**: Neuronas gigantes de escape balístico (*Giant_Fiber_1*, *Giant_Fiber_2*).
- **DNa01 / DNa02**: Neuronas descendentes que inducen viraje asimétrico en las patas.
- **MN9**: Motoneuronas que proyectan hacia los músculos de la probóscide.
- **PAM / PPL1**: Poblaciones dopaminérgicas apetitivas y aversivas.

#### `ConnectomeEngine` (`dynamics.py`)
Simulador biofísico basado en el modelo *Leaky Integrate-and-Fire* (LIF):

$$\tau_m \frac{dV_i}{dt} = -(V_i - V_{rest}) + I_{syn, i}$$

$$I_{syn} (t + dt) = I_{syn}(t) \cdot e^{-dt / \tau_{syn}} + W \cdot \text{spikes}(t) \cdot w_{scale}$$

Constantes electrofisiológicas calibradas:
- $V_{rest} = -52.0 \text{ mV}$ (Potencial de reposo)
- $V_{threshold} = -45.0 \text{ mV}$ (Umbral de disparo)
- $V_{reset} = -52.0 \text{ mV}$ (Potencial de reinicio tras espiga)
- $\tau_m = 20 \text{ ms}$ (Constante de tiempo de membrana)
- $\tau_{syn} = 5 \text{ ms}$ (Constante de decaimiento sináptico)
- $dt = 2 \text{ ms}$ (Paso de integración temporal)

El producto $W \cdot \text{spikes}$ se calcula mediante multiplicación dispersa matriz-vector (`scipy.sparse.csr_matrix.dot`).

---

### 2.3. `moscabrain.vision`

#### `CompoundEye` (`compound_eye.py`)
Modela un ojo compuesto panorámico:
- Parámetros: `fov_horizontal` (por defecto 270°), `ommatidia_count` (por defecto 32), `sensitivity`, `noise`.
- Calcula la dirección azimutal de cada omatidio y evalúa campos receptivos gaussianos frente a fuentes de luz (`light_sources`).
- Evalúa el estímulo *looming* mediante el ángulo subtendido $\theta = 2 \arctan(r / d)$ y su derivada temporal (tasa de expansión aparente).

#### `HexagonalCompoundEye` (`hexagonal_eye.py`)
Muestreador hexagonal de imágenes en rejilla 2D:
- Dispone los omatidios en filas y columnas alternadas emulando el empaquetamiento hexagonal de la retina biológica.
- Soporta modos:
  - `split`: La mitad izquierda de la imagen excita el ojo izquierdo y la mitad derecha el ojo derecho.
  - `duplicate`: La escena completa se proyecta a ambos ojos.

---

### 2.4. `moscabrain.olfaction.AntennalLobe` (`antennal_lobe.py`)
Simula el lóbulo antenal con un espacio de 16 glomérulos:
- **Perfiles Químicos Conocidos**: Firmas glomerulares biológicas de vinagre de manzana, sacarosa, plátano, humo repelente, feromonas y etanol.
- **Codificación Arbitraria / Hash**: Convierte cadenas de texto en firmas dispersas mediante funciones hash deterministas.
- **Codificación Simbólica**:
  - `encode_blackjack_hand(player_total, dealer_upcard)`: Proyecta la mano de blackjack en glomérulos específicos para toma de decisiones con el Mushroom Body.
  - `encode_tetris_piece(piece_type)`: Asigna olores químicos distintos a cada tetrominó.

---

### 2.5. `moscabrain.dopamine.DopamineSystem` (`system.py`)
Controla la concentración de dopamina extracelular:
- Modula el clúster PAM (asociado a refuerzo positivo/azúcar) y el clúster PPL1 (aversivo/castigo).
- Incluye decaimiento temporal exponencial de la dopamina libre.
- Permite registrar condiciones automáticas (`add_condition(func, reason)`) que se evalúan en cada paso.

---

### 2.6. `moscabrain.body.motor` (`motor.py`)
Decodificador neuromuscular:
- Lee las tasas de disparo de `DN_FORWARD`, `DN_STEER_L`, `DN_STEER_R`, `DN_GIANT_FIBER`, `DN_PROBOSCIS` y `DN_GROOMING`.
- Retorna un `ActionOutput` con:
  - `forward_thrust`: Empuje normalizado $[0.0, 1.0]$.
  - `turn_yaw`: Viraje angular $[-1.0, 1.0]$ (izq/der).
  - `proboscis_extended`: Booleano de alimentación.
  - `escape_jump`: Booleano de reflejo de salto.
  - `wingbeat_hz`: Frecuencia de batido alar (~210 Hz en vuelo/escape).
  - `state`: Enumeración `ActionState` (`IDLE`, `WALKING`, `TURNING_LEFT`, `TURNING_RIGHT`, `FEEDING`, `ESCAPE_JUMP`, `GROOMING`).

---

### 2.7. `moscabrain.arena.SimulationArena` (`arena.py`)
Entorno bidimensional para pruebas corporizadas:
- Gestiona gotas de alimento (`FoodItem`), emisores de luz (`LightSource`) y sombras móviles (`ThreatShadow`).
- Modela plumas de gradiente químico con concentración decreciente según la distancia a la gota:

$$C(d) = \frac{C_0}{1 + (d / r_{decay})^2}$$

- Calcula lecturas independientes para la antena izquierda y la antena derecha según la separación física entre ellas (triangulación quimiosensorial).
- Escenarios integrados: `alimento_dopamina`, `fototaxis_luz`, `escape_depredador`, `olfato_quimico`.

---

### 2.8. `moscabrain.bridge.GameBridge` (`controller.py`)
Conector universal para que el conectoma juegue a videojuegos externos (Pygame, Gymnasium, emuladores):
- Recibe un frame de imagen vía `step_frame(game_frame)`.
- Mapea las neuronas P9 y la Fibra Gigante a un diccionario de teclas de teclado (`UP`, `DOWN`, `LEFT`, `RIGHT`, `SPACE`, `ENTER`).
- Provee métodos directos para premiar (`bridge.reward()`) o castigar (`bridge.punish()`) según el puntaje del juego.

---

## 3. Ejemplos de Uso en Python Puro

### Ejemplo 1: Quimiotaxis y Consumo de Sacarosa
```python
from moscabrain import SimulationArena

arena = SimulationArena(width=800, height=600)
arena.load_scenario("alimento_dopamina")

for step in range(500):
    action = arena.step()
    agent = arena.agent

    if action.proboscis_extended:
        print(f"Paso {step}: ¡Alimentándose! Probóscide extendida en ({agent.x:.1f}, {agent.y:.1f})")
    elif step % 50 == 0:
        print(f"Paso {step}: Estado={action.state.name}, Pos=({agent.x:.1f}, {agent.y:.1f}), Yaw={action.turn_yaw:.2f}")
```

### Ejemplo 2: Integración de Videojuego con GameBridge
```python
import numpy as np
from moscabrain import GameBridge

bridge = GameBridge(stereo_mode="split")
bridge.bind_key("FORWARD", "W")
bridge.bind_key("STEER_LEFT", "A")
bridge.bind_key("STEER_RIGHT", "D")
bridge.bind_key("JUMP_ESCAPE", "SPACE")

# Bucle ficticio de juego (ej. resolución 640x480)
for frame_idx in range(60):
    pantalla_juego = np.zeros((480, 640, 3), dtype=np.uint8)
    # Dibujar un objeto en la mitad derecha
    pantalla_juego[200:280, 450:530] = 255

    teclas = bridge.step_frame(pantalla_juego, substeps=3)

    if teclas["W"]:
        print("La mosca avanza hacia adelante")
    if teclas["D"]:
        print("La mosca gira hacia la derecha")
```

---

## 4. Diagnóstico Crítico: Puntos Débiles y Áreas de Mejora

A continuación se detallan las limitaciones estructurales identificadas en la biblioteca y las líneas de trabajo recomendadas para futuras versiones.

### 4.1. Rendimiento y Cómputo del Conectoma Completo (138K Neuronas en CPU)
* **Punto Débil**: La multiplicación de la matriz dispersa CSR de $138.639 \times 138.639$ con más de 15 millones de sinapsis (`self.W.dot(spikes)`) se ejecuta en CPU mediante SciPy. En equipos estándar, cada sub-paso consume entre 15 y 35 milisegundos. Ejecutar 5 sub-pasos por frame compromete la capacidad de sostener 60 FPS en tiempo real sin pausas.
* **Propuesta de Mejora**:
  1. **Aceleración por GPU (CUDA / PyTorch / CuPy / JAX)**: Migrar el cálculo de dinámicas a tensores dispersos en GPU (`torch.sparse_csr_tensor`), logrando aceleraciones estimadas de entre $10\times$ y $40\times$.
  2. **Modo de Circuito Reducido (Core Subgraph Extraction)**: Permitir extraer un subgrafo funcional activo con las ~8.000 a 12.000 neuronas clave (lóbulos ópticos, lóbulos antenales, complejo central, mushroom body y neuronas descendentes), reduciendo el costo computacional en un 90% para dispositivos de bajo consumo.

### 4.2. Acoplamiento Sensoriomotor Directo vs. Emergencia Conectómica Pura
* **Punto Débil**: En `dynamics.py` (`inject_olfactory_input` y `inject_optic_input`), para garantizar que la mosca gire hacia la comida o la luz sin perderse, se inyectan corrientes directamente a las neuronas descendentes P9 y DNa (ej. `p9_left_idx`, `dna_left_indices`). Aunque esto produce un comportamiento cinemático robusto, actúa como un *atajo heurístico* que elude parcialmente las vías de procesamiento recurrente del cerebro (Antennal Lobe $\to$ Projection Neurons $\to$ Mushroom Body / Lateral Horn $\to$ MBONs $\to$ DNs).
* **Propuesta de Mejora**:
  - Calibrar y optimizar los pesos de las vías intermedias mediante algoritmos genéticos o destilación de políticas para que la fototaxis y la quimiotaxis surjan de forma 100% emergente a través de la red neuronal biológica, eliminando las inyecciones forzadas a los efectores motores.

### 4.3. Ausencia de Plasticidad Sináptica Duradera (Falta de STDP / LTP / LTD)
* **Punto Débil**: El sistema actual de dopamina modula transitoriamente la excitabilidad de las neuronas (`syn_currents[pam_indices] += ...`), pero **no altera de forma permanente los pesos de la matriz sináptica $W$**. En consecuencia, la mosca no "recuerda" aprendizajes entre sesiones; cuando el nivel de dopamina decae, el conectoma regresa a su estado original sin condicionamiento pavloviano u operante persistente.
* **Propuesta de Mejora**:
  - Implementar una regla de aprendizaje biológico de tres factores (STDP dopaminérgica) en las sinapsis entre las Células de Kenyon (KC) y las neuronas de salida del Mushroom Body (MBONs):
    
$$\Delta W_{ij} = \eta \cdot \text{EligibilityTrace}(i, j) \cdot [\text{Dopamina} - \text{Baseline}]$$

  - Incorporar métodos para guardar y cargar los pesos modificados: `fly.save_weights("learned_weights.npz")`.

### 4.4. Cinemática de Masa Puntual 2D vs. Biomecánica Real de Drosophila
* **Punto Débil**: El cuerpo del agente en `_update_physics` se modela como una partícula 2D con orientación $\theta$. No se modela la cinemática articular de las 6 patas (trípode alterno de marcha de *Drosophila*), la fricción de contacto tarsal con el sustrato, ni las fuerzas aerodinámicas tridimensionales de las alas (sustentación y arrastre por vórtice de borde de ataque).
* **Propuesta de Mejora**:
  - Crear un adaptador hacia simuladores de física multicuerpo rígida como **MuJoCo** o **NeuroMechFly**, permitiendo que las neuronas motoras controlen articulaciones de coxas, fémures y tibias en un modelo anatómico 3D de la mosca.

### 4.5. Visión Monocromática y Ausencia de Luz Polarizada (Dorsal Rim Area)
* **Punto Débil**: El sistema visual procesa únicamente intensidades lumínicas escalares en blanco y negro. No emula las diferentes sensibilidades espectrales de los fotorreceptores de Drosophila (R1-R6 para banda ancha, R7-R8 para UV y verde), ni la detección de luz polarizada en el margen dorsal del ojo (*Dorsal Rim Area*, DRA), esencial biológicamente para que la brújula central (CX EPG) mantenga el rumbo azimutal respecto al sol.
* **Propuesta de Mejora**:
  - Incorporar canales espectrales diferenciados (UV y Verde) y un vector de polarización $E$-vector que alimente directamente a las neuronas del Complejo Central (*Compass EPG*).

### 4.6. Persistencia del Estado Completo del Agente (Checkpoints)
* **Punto Débil**: No existe un mecanismo para congelar y restaurar el estado dinámico instantáneo de las 138.639 neuronas (potenciales de membrana $V$, corrientes sinápticas $I_{syn}$, estados de disparo y concentraciones de neurotransmisores). Si se interrumpe la ejecución, la simulación debe comenzar desde cero.
* **Propuesta de Mejora**:
  - Desarrollar utilidades de serialización binaria ultrarrápida (usando formatos como Safetensors, HDF5 o Zarr) para pausar, guardar y reanudar cerebros en ejecución: `fly.save_checkpoint("checkpoint_step_1000.h5")`.

### 4.7. Pruebas Automatizadas de Larga Duración en CI/CD
* **Punto Débil**: El conjunto de pruebas unitarias incluye benchmarks de rendimiento que simulan miles de pasos sobre las 15M sinapsis, lo cual puede demorar varios minutos si se ejecuta `pytest` completo en CPU.
* **Propuesta de Mejora**:
  - Clasificar las pruebas mediante marcadores de Pytest (`@pytest.mark.slow`, `@pytest.mark.benchmark`) para permitir la ejecución inmediata de pruebas unitarias (`pytest -m "not slow"`) en menos de 5 segundos.
