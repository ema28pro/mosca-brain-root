# 🪰 MoscaBrain (mosca-brain-root)

[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/)
[![Connectome](https://img.shields.io/badge/FlyWire-138k%20Neurons%20%7C%2015M%20Synapses-cyan.svg)](https://flywire.ai/)
[![Dynamics](https://img.shields.io/badge/Bio--Dynamics-LIF%20%2B%20Dopamine%20STDP-emerald.svg)](https://github.com/ema28pro/mosca-brain-root)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**MoscaBrain** es un framework biofísico y biblioteca de Inteligencia Artificial Corporizada (*Embodied AI*) que simula el conectoma completo del cerebro adulto de la mosca de la fruta (*Drosophila melanogaster*), reconstruido a partir del dataset biológico real de **FlyWire** (138.639 neuronas y 15.091.983 sinapsis biológicas).

Permite conectar órganos sensoriales reales (visión retinotópica por omatidios hexagonales, quimiorrecepción en el lóbulo antenal y gustación de azúcar) con neuromodulación por dopamina y decodificación motora hacia videojuegos, simuladores físicos y robótica.

---

## 🔬 Arquitectura Biofísica

```
                      ┌────────────────────────────────────────┐
                      │             ÓRGANOS SENSORIALES        │
                      └───────────────────┬────────────────────┘
                                          │
            ┌─────────────────────────────┼────────────────────────────┐
            ▼                             ▼                            ▼
  [ Ojo Compuesto Hexagonal ]   [ Lóbulo Antenal (Olfato) ]   [ Neuronas Gustativas ]
    Muestreo Retinotópico        16 Canales Glomerulares       Sugar GRNs (Sacarosa)
    Left Eye / Right Eye         (Perfiles de Quimiorrecepción)
            │                             │                            │
            └─────────────────────────────┼────────────────────────────┘
                                          ▼
                      ┌────────────────────────────────────────┐
                      │        CONECTOMA FLYWIRE v783          │
                      │   138.639 Neuronas · 15.09M Sinapsis   │
                      │  (Lobula, Medulla, MB, Central Complex)│
                      └───────────────────┬────────────────────┘
                                          │
            ┌─────────────────────────────┴────────────────────────────┐
            ▼                                                          ▼
  [ Neuromodulación por Dopamina ]                               [ Vías Motoras Descendentes ]
    - Clúster PAM (Recompensa Apetitiva)                          - P9 (Marcha hacia adelante y giro)
    - Clúster PPL1 (Aversión / Castigo)                          - Fibra Gigante (Salto de escape)
```

---

## 🚀 Características Principales

1. **Conectoma Biológico 100% Real (FlyWire)**:
   - Modela las dinámicas de membrana celular mediante ecuaciones *Leaky Integrate-and-Fire* (LIF) a través de las 15M de conexiones reales.
2. **Visión Retinotópica Dual (HexagonalCompoundEye)**:
   - Muestreo directo en red hexagonal (*Left eye* y *Right eye*), reproduciendo la lente y distribución de omatidios de *Drosophila*.
3. **Quimiorrecepción y Olfato (AntennalLobe)**:
   - 16 canales glomerulares biológicos capaces de mapear sustancias naturales (vinagre, sacarosa, etanol, feromonas) y firmas simbólicas de estados de juego.
4. **Neuromodulación y Plasticidad (DopamineSystem)**:
   - Inyección de dopamina en clústeres dopaminérgicos apetitivos (PAM) y aversivos (PPL1), facilitando aprendizaje reforzado bio-inspirado y modulación sináptica (STDP).
5. **Controlador para Videojuegos y Entornos (GameBridge)**:
   - Interfaz genérica para conectar la mosca a cualquier entorno o videojuego (Tetris, Doom, Mario, entornos Gymnasium/Gym), mapeando las espigas de las neuronas descendentes P9 a teclas o comandos de acción.
6. **Simulación Sensorimotora BANC (Nature 2026)**:
   - Conectoma continuo Cerebro + Cordón Nervioso Ventral (VNC) con 188k neuronas.
   - Permite estimular neuronas descendentes identificadas (Fibra Gigante DNp01, Marcha P9/DNp09) y medir espigas en motoneuronas identificadas de patas y alas en tiempo real.
   - Interfaz interactiva local con raster plot, curvas de reclutamiento y trazado 3D de coordenadas reales: `http://localhost:8000/banc/`.
   - Consulta la [Guía Completa de Simulación BANC](docs/BANC_SIMULATION_GUIDE.md).

---

## 📚 Referencias Científicas y Repositorios

### Conectoma BANC (Brain and Nerve Cord):
- **Paper:** Bates, Phelps, Kim, Yang et al. (2026). *The connectome of an adult Drosophila brain and nerve cord*. **Nature**. [DOI: 10.1038/s41586-026-10735-w](https://doi.org/10.1038/s41586-026-10735-w) | [Nature Article](https://www.nature.com/articles/s41586-026-10735-w)
- **Repositorio de Datos y Tutorial:** [sjcabs/fly_connectome_data_tutorial](https://github.com/sjcabs/fly_connectome_data_tutorial)
- **Documentación del dataset:** [banc_data.md](https://github.com/sjcabs/fly_connectome_data_tutorial/blob/main/data/dataset_documentation/banc_data.md)
- **Herramientas Python BANC:** [the-BANC-fly-connectome](https://github.com/jasper-tms/the-BANC-fly-connectome)
- **Herramientas R (bancr):** [natverse.org/bancr](https://natverse.org/bancr/)
- **Bucket de Datos (Google Cloud):** `gs://lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888/`

### Modelo de Dinámicas LIF (Shiu et al.):
- **Paper:** Shiu, Stern, Hermundstad et al. (2024). *A leaky integrate-and-fire computational model based on the connectome of the entire adult Drosophila brain reveals insights into sensorimotor processing*. **Nature**, 634, 153–161. [DOI: 10.1038/s41586-024-07763-9](https://doi.org/10.1038/s41586-024-07763-9) | [Nature Article](https://www.nature.com/articles/s41586-024-07763-9)
- **Repositorio Original Shiu:** [philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model)
- **Emulación Multi-backend Eon Systems:** [eonsystemspbc/fly-brain](https://github.com/eonsystemspbc/fly-brain) *(incluido en `eons_fly_brain/`)*

---

## 📦 Instalación

### Desde el repositorio:

```bash
git clone https://github.com/ema28pro/mosca-brain-root.git
cd mosca-brain-root
pip install -e .
```

### Requisitos:
- Python 3.8+
- `numpy`, `scipy`, `fastapi`, `uvicorn`, `websockets`

---

## 💡 Inicio Rápido (Quickstart)

### 1. Simulación Básica del Agente Biofísico

```python
from moscabrain import FlyAgent

# Instanciar agente corporizado con conectoma FlyWire
fly = FlyAgent(dt=0.002)

# Exponer a un aroma químico en sus antenas
fly.olfaction.expose_odor("sacarosa_azucar", concentration=1.2)

# Estimular visión (ej. fuente de luz cercana)
lights = [{"x": 350.0, "y": 300.0, "intensity": 1.5}]
action = fly.step(light_sources=lights)

print(f"Estado de Acción: {action.state.name}")
print(f"Empuje hacia adelante: {action.forward_thrust:.3f}, Giro (Yaw): {action.turn_yaw:.3f}")

# Recompensar con dopamina (PAM)
fly.reward(amount=1.0, reason="contacto_azucar")
print(f"Dopamina extracelular: {fly.dopamine.current_level:.2f} DA")
```

---

### 2. Conectar la Mosca a un Videojuego con `GameBridge`

```python
import numpy as np
from moscabrain import GameBridge

# Crear el puente con visión estéreo dividida (Left/Right eye)
bridge = GameBridge(stereo_mode="split")

# En el bucle de tu juego o entorno (Gym, Pygame, Canvas):
# frame = captura de pantalla en formato numpy (H, W, 3)
keys = bridge.step_frame(game_frame, odor_stimulus="mentol")

if keys["UP"]:
    player.move_forward()
if keys["LEFT"]:
    player.steer_left()
if keys["RIGHT"]:
    player.steer_right()

# Feedback dopaminérgico
if score_increased:
    bridge.reward(amount=1.0, reason="punto_ganado")
if player_crashed:
    bridge.punish(amount=1.5, reason="colision")
```

---

## 🌐 Datasets Biológicos y Enlaces Oficiales

MoscaBrain integra y contrasta los principales atlas conectómicos del consorcio internacional:

| Dataset | Sujeto | Alcance Anatómico | Neuronas | Referencia / Enlace |
| :--- | :--- | :--- | :--- | :--- |
| **FlyWire (FAFB v783)** | Hembra adulta | Solo Cerebro | 138.639 | [FlyWire Codex](https://codex.flywire.ai/) · [Nature 2024](https://doi.org/10.1038/s41586-024-07558-y) |
| **BANC (v888)** | Hembra adulta | Cerebro + VNC continuo | 188.208 | [Tutorial BANC](https://github.com/sjcabs/fly_connectome_data_tutorial) · [Nature 2026](https://doi.org/10.1038/s41586-026-10735-w) |
| **Google / Janelia MANC & Male CNS** | Macho adulto | VNC + Cerebro Macho | ~166.700 | [Google Connectomics](https://research.google/teams/applied-science/connectomics/) · [neuPrint MANC](https://neuprint.janelia.org/?dataset=manc:v1.0) |

### 🔗 Enlaces al Conectoma del Macho de Google:
- 🏢 **Google Research Applied Sciences (Connectomics):**  
  [https://research.google/teams/applied-science/connectomics/](https://research.google/teams/applied-science/connectomics/)
- 📰 **Anuncio y Publicación Oficial de Google Research:**  
  [Google Research Blog: Releasing the Male Adult Nerve Cord (MANC) Connectome](https://research.google/blog/releasing-the-male-adult-nerve-cord-connectome/)
- 🔬 **Explorador Interactivo neuPrint (Janelia / Google):**  
  [Janelia neuPrint Explorer (manc:v1.0)](https://neuprint.janelia.org/?dataset=manc:v1.0)
- 🖥️ **Visor 3D Neuroglancer de Google:**  
  [https://github.com/google/neuroglancer](https://github.com/google/neuroglancer)
- 📄 **Artículos Científicos de Referencia:**  
  - *Takemura, S. et al. (2023). A connectome of the male Drosophila ventral nerve cord.* [bioRxiv: 10.1101/2023.06.05.543757](https://doi.org/10.1101/2023.06.05.543757)
  - *Berg, S., Marin, E. et al. (2025/2026). Whole-animal connectome of a male fruit fly (Drosophila melanogaster).* [Cell / bioRxiv](https://doi.org/10.1101/2023.12.06.570454)

> [!NOTE]
> **¿Por qué el macho tiene ~166.7k neuronas y la hembra BANC ~188.2k?**  
> El macho adulto tiene ojos ligeramente menores en cantidad de omatidios y carece de los ganglios neuroméricos abdominales que inervan el ovipositor en los segmentos A1–A8 de la hembra, lo que explica la diferencia dimórfica de ~21.500 neuronas entre ambos conectomas.

---

## 📂 Estructura del Proyecto


```
mosca-brain-root/
├── moscabrain/                # Paquete principal de la biblioteca
│   ├── agent.py               # Clase central FlyAgent
│   ├── arena.py               # Entorno y arena física 2D de simulación
│   ├── connectome/            # Dinámica neural LIF y topología FlyWire
│   │   ├── circuits.py        # Topología y anotaciones neuronales (P9, Sugar GRNs, etc.)
│   │   └── dynamics.py        # Motor de integración de sinapsis
│   ├── vision/                # Órganos visuales
│   │   ├── compound_eye.py    # Ojo compuesto tradicional con FOV
│   │   └── hexagonal_eye.py   # Muestreo hexagonal retinotópico de Drosophila
│   ├── olfaction/             # Órganos olfativos
│   │   └── antennal_lobe.py   # Lóbulo antenal y mapa de 16 glomérulos
│   ├── dopamine/              # Sistema neuromodulador
│   │   └── system.py          # Clústeres PAM y PPL1 con historial y triggers
│   ├── bridge/                # Conectores externos
│   │   └── controller.py      # GameBridge para videojuegos y entornos
│   └── body/                  # Cinemática corporal y decodificación motora
├── server/                    # Servidor FastAPI WebSocket para streaming en tiempo real
├── tests/                     # Suite de pruebas unitarias (Pytest)
├── setup.py                   # Configuración del paquete para pip
└── README.md                  # Documentación principal
```

---

## 🧪 Ejecutar Pruebas

```bash
python -m pytest tests/test_moscabrain.py
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
Dataset del conectoma basado en el consorcio internacional [FlyWire](https://flywire.ai/).
