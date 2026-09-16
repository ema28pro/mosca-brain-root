# Documentación Técnica: `moscabrain/__init__.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/__init__.py` define el paquete raíz de la librería `moscabrain`. Expone la interfaz pública unificada de programación (API de alto nivel), permitiendo importar directamente las clases y funciones esenciales sin necesidad de navegar por los submódulos internos.

Define la versión del paquete (`__version__ = "1.2.0"`) y la lista de exportación explícita `__all__`.

---

## 2. Importaciones y Justificación

```python
from .agent import FlyAgent, FlyWireAgent, FlyWireBrainAgent
from .agent_banc import BANCAgent
from .arena import SimulationArena, FoodItem
from .vision.compound_eye import CompoundEye, VisionConfig
from .vision.hexagonal_eye import HexagonalCompoundEye
from .olfaction.antennal_lobe import AntennalLobe
from .dopamine.system import DopamineSystem
from .body.motor import ActionOutput, ActionState
from .connectome.circuits import FlyWireConnectomeTopology
from .connectome.dynamics import ConnectomeEngine
from .connectome.banc_circuit import BANCCircuitManager
from .connectome.banc_lif_simulator import BANCLIFSimulator, DEFAULT_PHYSIOLOGY_PARAMS
from .connectome.banc_experiment import run_full_banc_evaluation
from .bridge.controller import GameBridge
```

### Justificación de Importaciones:
- **Agentes**: `FlyAgent` (Factoría polimórfica), `FlyWireAgent` / `FlyWireBrainAgent` (cerebro cefálico de 138k neuronas), `BANCAgent` (Sistema Whole-CNS cerebro + VNC).
- **Entorno**: `SimulationArena` (mundo 2D con luces, plumas de olor y depredadores) y `FoodItem` (gotas de sacarosa).
- **Sensores**: `CompoundEye` y `VisionConfig` (retina angular panorámica), `HexagonalCompoundEye` (captura por celosía hexagonal directa de pantalla), `AntennalLobe` (quimiorrecepción y codificación simbólica por glomérulos).
- **Neuromodulación y Motor**: `DopamineSystem` (ejes PAM y PPL1), `ActionOutput` y `ActionState` (comandos de locomoción).
- **Conectómica y Simulación Biofísica**: `FlyWireConnectomeTopology` (15M de sinapsis de FlyWire v783), `ConnectomeEngine` (simulador biofísico cefálico), `BANCCircuitManager` (extractor de circuitos de BANC v888), `BANCLIFSimulator` y `DEFAULT_PHYSIOLOGY_PARAMS` (modelo Leaky Integrate-and-Fire con retraso axonal), `run_full_banc_evaluation` (batería de pruebas científicas reproducibles).
- **Integraciones**: `GameBridge` (conector para videojuegos externos y emuladores).

---

## 3. Lista de Símbolos Exportados (`__all__`)
Permite la importación limpia mediante comodín o inspección automática de herramientas:
```python
__all__ = [
    "FlyAgent", "FlyWireAgent", "FlyWireBrainAgent", "BANCAgent",
    "SimulationArena", "FoodItem", "CompoundEye", "HexagonalCompoundEye",
    "VisionConfig", "AntennalLobe", "DopamineSystem", "ActionOutput",
    "ActionState", "FlyWireConnectomeTopology", "ConnectomeEngine",
    "BANCCircuitManager", "BANCLIFSimulator", "DEFAULT_PHYSIOLOGY_PARAMS",
    "run_full_banc_evaluation", "GameBridge",
]
```
