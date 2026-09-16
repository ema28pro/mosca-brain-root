"""
MoscaBrain: Decodificador Motor y Cuerpo de la Mosca (Descending Neurons to Body).
Traduce el disparo de las neuronas descendientes (DNs) en velocidades de avance,
giro (yaw), extensión de probóscide para comer y reflejo balístico de escape.
"""

from dataclasses import dataclass
from enum import Enum
import numpy as np


class ActionState(str, Enum):
    IDLE = "IDLE (En reposo)"
    WALKING = "WALKING (Caminando hacia adelante)"
    TURNING_LEFT = "TURNING_LEFT (Girando a la izquierda)"
    TURNING_RIGHT = "TURNING_RIGHT (Girando a la derecha)"
    FEEDING = "FEEDING (Extendiendo probóscide para comer)"
    ESCAPE_JUMP = "ESCAPE_JUMP (¡Salto de escape balístico!)"
    GROOMING = "GROOMING (Limpiando antenas/alas)"


@dataclass
class ActionOutput:
    forward_thrust: float  # [0.0, 1.0]
    turn_yaw: float        # [-1.0, 1.0] (Negativo = Izq, Positivo = Der)
    proboscis_extended: bool
    escape_jump: bool
    grooming: bool
    state: ActionState
    wingbeat_hz: float     # Frecuencia de batido de alas (0 si camina, ~200 Hz si salta/vuela)

    def to_dict(self) -> dict:
        return {
            "forward_thrust": round(float(self.forward_thrust), 3),
            "turn_yaw": round(float(self.turn_yaw), 3),
            "proboscis_extended": self.proboscis_extended,
            "escape_jump": self.escape_jump,
            "grooming": self.grooming,
            "state": self.state.value,
            "wingbeat_hz": round(float(self.wingbeat_hz), 1),
        }

