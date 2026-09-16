"""
MoscaBrain: Framework intuitivo y biofísico para interactuar con el conectoma
digitalizado del cerebro de la mosca (Drosophila melanogaster - FlyWire).
"""

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

__version__ = "1.2.0"
__all__ = [
    "FlyAgent",
    "FlyWireAgent",
    "FlyWireBrainAgent",
    "BANCAgent",
    "SimulationArena",
    "FoodItem",
    "CompoundEye",
    "HexagonalCompoundEye",
    "VisionConfig",
    "AntennalLobe",
    "DopamineSystem",
    "ActionOutput",
    "ActionState",
    "FlyWireConnectomeTopology",
    "ConnectomeEngine",
    "BANCCircuitManager",
    "BANCLIFSimulator",
    "DEFAULT_PHYSIOLOGY_PARAMS",
    "run_full_banc_evaluation",
    "GameBridge",
]

