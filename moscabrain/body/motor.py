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


class FlyMotorBody:
    """
    Decodifica la actividad de las neuronas descendientes del conectoma
    y aplica la cinemática al cuerpo de la mosca.
    """

    def __init__(self, connectome_engine):
        self._engine = connectome_engine
        self.fwd_activity = 0.0
        self.steer_l_activity = 0.0
        self.steer_r_activity = 0.0
        self.escape_activity = 0.0
        self.proboscis_activity = 0.0
        self.groom_activity = 0.0

    def decode_action(self) -> ActionOutput:
        """
        Lee las neuronas descendientes activas en este paso de simulación
        y genera el comando de acción física.
        """
        # Filtrado temporal suave para dinámicas de actuadores mecánicos (músculos de patas/alas)
        self.fwd_activity = self.fwd_activity * 0.7 + self._engine.get_group_activity("DN_FORWARD") * 0.3
        self.steer_l_activity = self.steer_l_activity * 0.7 + self._engine.get_group_activity("DN_STEER_L") * 0.3
        self.steer_r_activity = self.steer_r_activity * 0.7 + self._engine.get_group_activity("DN_STEER_R") * 0.3
        self.escape_activity = self.escape_activity * 0.5 + self._engine.get_group_activity("DN_GIANT_FIBER") * 0.5
        self.proboscis_activity = self.proboscis_activity * 0.7 + self._engine.get_group_activity("DN_PROBOSCIS") * 0.3
        self.groom_activity = self.groom_activity * 0.8 + self._engine.get_group_activity("DN_GROOMING") * 0.2

        gf_slice = self._engine.topology.get_group_slice("DN_GIANT_FIBER")
        gf_spikes = np.any(self._engine.spikes[gf_slice])
        gf_act = self._engine.get_group_activity("DN_GIANT_FIBER")

        # 1. ¿Reflejo de Escape por Fibra Gigante? (Prioridad de supervivencia: todo o nada)
        is_escape = gf_spikes or gf_act > 0.01 or self.escape_activity > 0.01
        if is_escape:
            return ActionOutput(
                forward_thrust=1.0,
                turn_yaw=np.random.choice([-0.8, 0.8]),  # Salto de escape aleatorizado
                proboscis_extended=False,
                escape_jump=True,
                grooming=False,
                state=ActionState.ESCAPE_JUMP,
                wingbeat_hz=210.0,
            )

        # 2. ¿Extensión de Probóscide para alimentarse? (Estímulo de azúcar / MBON_APPROACH)
        is_feeding = self.proboscis_activity > 0.12
        if is_feeding:
            return ActionOutput(
                forward_thrust=0.05,  # Se detiene o avanza muy despacio mientras come
                turn_yaw=0.0,
                proboscis_extended=True,
                escape_jump=False,
                grooming=False,
                state=ActionState.FEEDING,
                wingbeat_hz=0.0,
            )

        # 3. ¿Comportamiento de limpieza (Grooming)?
        if self.groom_activity > 0.2:
            return ActionOutput(
                forward_thrust=0.0,
                turn_yaw=0.0,
                proboscis_extended=False,
                escape_jump=False,
                grooming=True,
                state=ActionState.GROOMING,
                wingbeat_hz=0.0,
            )

        # 4. Marcha y navegación normal
        raw_thrust = float(np.clip(self.fwd_activity * 2.5 + 0.15, 0.0, 1.0))
        net_steer = float(np.clip((self.steer_r_activity - self.steer_l_activity) * 3.0, -1.0, 1.0))

        if abs(net_steer) > 0.25:
            current_state = ActionState.TURNING_RIGHT if net_steer > 0 else ActionState.TURNING_LEFT
        elif raw_thrust > 0.1:
            current_state = ActionState.WALKING
        else:
            current_state = ActionState.IDLE

        return ActionOutput(
            forward_thrust=raw_thrust,
            turn_yaw=net_steer,
            proboscis_extended=False,
            escape_jump=False,
            grooming=False,
            state=current_state,
            wingbeat_hz=0.0,
        )
