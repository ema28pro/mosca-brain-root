# Índice General de Documentación Técnica de Python

Este directorio contiene la documentación técnica exhaustiva de cada archivo Python del proyecto **MoscaBrain**, detallando funciones, entradas, salidas, importaciones y lógica de clases.

---

## 1. Núcleo de la Librería (`moscabrain/`)

- [**`moscabrain/__init__.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/init.md)  
  Punto de entrada del paquete principal, exportaciones públicas y metadatos de versión.
- [**`moscabrain/agent.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/agent.md)  
  Agente corporizado con conectoma cerebral FlyWire (138k neuronas), factoría polimórfica `FlyAgent`, cinemática 2D y programas de alimentación.
- [**`moscabrain/agent_banc.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/agent_banc.md)  
  Agente corporizado con conectoma Whole-CNS (Cerebro + VNC) basado en BANC v888 y motoneuronas efectoras torácicas.
- [**`moscabrain/arena.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/arena.md)  
  Entorno de simulación virtual 2D con plumas químicas bilaterales, fuentes de luz, sombras amenazantes y físicas de probóscide.
- [**`moscabrain/body/motor.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/body_motor.md)  
  Decodificador neuromuscular de neuronas descendentes (P9, Giant Fiber, DNa, MN9), estados etológicos (`ActionState`) y salidas de acción (`ActionOutput`).
- [**`moscabrain/bridge/__init__.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/bridge_init.md)  
  Inicializador del paquete bridge y exportación de `GameBridge`.
- [**`moscabrain/bridge/controller.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/bridge_controller.md)  
  Puente de control entre videojuegos/emuladores externos y el conectoma, con mapeo de teclas y visión estéreo.
- [**`moscabrain/dopamine/system.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/dopamine_system.md)  
  Sistema de neuromodulación apetitiva (PAM) y aversiva (PPL1) con triggers condicionales automáticos.
- [**`moscabrain/olfaction/antennal_lobe.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/olfaction_antennal_lobe.md)  
  Lóbulo antenal con 16 glomérulos, quimiorrecepción natural y codificación simbólica para juegos (Blackjack y Tetris).
- [**`moscabrain/vision/compound_eye.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/vision_compound_eye.md)  
  Ojo compuesto panorámico (FOV hasta 270°), campos receptivos gaussianos y detección de amenazas en expansión (*looming*).
- [**`moscabrain/vision/hexagonal_eye.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/vision_hexagonal_eye.md)  
  Retina de empaquetamiento hexagonal continuo para muestreo de pantallas y ventanas de juego.

---

## 2. Subsistema de Conectoma y Biofísica (`moscabrain/connectome/`)

- [**`moscabrain/connectome/__init__.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/connectome_init.md)  
  Punto de entrada del submódulo conectómico y alias de compatibilidad.
- [**`moscabrain/connectome/circuits.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/connectome_circuits.md)  
  Carga y procesamiento de las 15M de sinapsis de FlyWire v783, matriz dispersa CSR y mapeo de poblaciones biológicas.
- [**`moscabrain/connectome/dynamics.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/connectome_dynamics.md)  
  Motor biofísico LIF de 138k neuronas, propagación sináptica $W \cdot \text{spikes}$, estados de arousal aversivo y telemetría biológica.
- [**`moscabrain/connectome/banc_circuit.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/connectome_banc_circuit.md)  
  Extractor y administrador de circuitos del dataset BANC v888 (Giant Fiber escape y P9 locomoción).
- [**`moscabrain/connectome/banc_lif_simulator.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/connectome_banc_lif_simulator.md)  
  Simulador LIF vectorizado de alta fidelidad con búfer de retardo axonal ($1.8\text{ ms}$) y parámetros fisiológicos de Shiu et al. (Nature 2024).
- [**`moscabrain/connectome/banc_experiment.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/moscabrain/connectome_banc_experiment.md)  
  Batería de evaluación experimental científica: sensibilidad de peso, umbrales sinápticos y reclutamiento motor.

---

## 3. Servidores Web y APIs (`server/` y `run.py`)

- [**`server/app.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/server/app.md)  
  Servidor web principal FastAPI: WebSocket `/ws` a 30 FPS, endpoints REST de la arena, Blackjack y entrega estática de React.
- [**`server/banc_api.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/server/banc_api.md)  
  API REST para simulación BANC y servidor autónomo en el puerto 8080 para la interfaz web dedicada.
- [**`server/tetris_server.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/server/tetris_server.md)  
  Servidor dedicado de inferencia de baja latencia en el puerto 8001 para control de Tetris vía WebSocket y REST.
- [**`run.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/run.md)  
  Lanzador principal con recarga controlada (`reload_dirs`) para prevenir el error `WinError 1450` en Windows.

---

## 4. Ejemplos y Tutoriales Prácticos (`examples/`)

- [**`examples/quickstart.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/examples/quickstart.md)  
  Guía rápida mínima de inicialización del agente, configuración sensorial y pasos de simulación.
- [**`examples/predator_escape.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/examples/predator_escape.md)  
  Demostración del circuito de escape balístico activado por *looming* y la Fibra Gigante.
- [**`examples/dopamine_conditioning.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/examples/dopamine_conditioning.md)  
  Condicionamiento clásico pavloviano apetitivo con dopamina en el cuerpo fungiforme.
- [**`examples/blackjack_21.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/examples/blackjack_21.md)  
  Partida de Blackjack guiada por codificación olfativa de cartas y modulación de neuronas MBON.
- [**`examples/play_game.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/examples/play_game.md)  
  Integración de videojuegos 2D mediante fotogramas y `GameBridge`.
- [**`examples/real_flywire_dataset.py`**](file:///c:/Users/Fixer/Desktop/Mosca/docs/examples/real_flywire_dataset.md)  
  Exploración y manipulación directa del dataset oficial Parquet de FlyWire con 15M de conexiones.
