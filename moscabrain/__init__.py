"""
MoscaBrain: Framework intuitivo y biofísico para interactuar con el conectoma
digitalizado del cerebro de la mosca (Drosophila melanogaster - FlyWire).
"""

from .agent import FlyAgent
from .arena import SimulationArena, FoodItem
from .vision.compound_eye import CompoundEye, VisionConfig
from .vision.hexagonal_eye import HexagonalCompoundEye
from .olfaction.antennal_lobe import AntennalLobe
from .dopamine.system import DopamineSystem
from .body.motor import ActionOutput, ActionState
from .connectome.circuits import FlyWireConnectomeTopology
from .connectome.dynamics import ConnectomeEngine
from .bridge.controller import GameBridge

__version__ = "1.0.0"
__all__ = [
    "FlyAgent",
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
    "GameBridge",
]
