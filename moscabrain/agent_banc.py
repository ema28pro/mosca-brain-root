"""
BANCAgent: Agente con conectoma completo (Whole-CNS: Cerebro + Cordón Nervioso Ventral VNC).

Especializado en dinámicas sensoriomotoras descendentes hacia motoneuronas identificadas
(BANC v888, Bates, Phelps, Kim et al., Nature 2026).
No carga en memoria el motor cerebral aislado de FlyWire de 15M de sinapsis,
optimizando el consumo de memoria RAM y latencia.
"""

from typing import List, Dict, Optional, Any
import numpy as np

from .agent_base import BaseFlyAgent
from .connectome.banc_circuit import BANCCircuitManager
from .connectome.banc_lif_simulator import BANCLIFSimulator, DEFAULT_PHYSIOLOGY_PARAMS
from .body.motor import ActionOutput, ActionState


class BANCAgent(BaseFlyAgent):
    """
    Agente mosca corporizado con sistema nervioso central completo (Cerebro + VNC).
    Conecta neuronas descendentes con motoneuronas de las patas y alas.
    """

    def __init__(
        self,
        circuit_id: str = "sensorimotor",
        synapse_threshold: int = 3,
        physiology_params: Optional[Dict[str, Any]] = None,
        dt: float = 0.0002,  # 0.2 ms
    ):
        super().__init__(connectome_mode="banc")
        self.circuit_id = circuit_id
        self.dt = dt

        # 1. Cargar circuito BANC aislado
        self.circuit_mgr = BANCCircuitManager()
        if circuit_id == "sensorimotor":
            self.circuit = self.circuit_mgr.extract_sensorimotor_circuit(synapse_threshold=synapse_threshold)
        elif circuit_id == "giant_fiber":
            self.circuit = self.circuit_mgr.extract_giant_fiber_circuit(synapse_threshold=synapse_threshold)
        elif circuit_id == "p9":
            self.circuit = self.circuit_mgr.extract_p9_circuit(synapse_threshold=synapse_threshold)
        else:
            self.circuit = self.circuit_mgr.extract_sensorimotor_circuit(synapse_threshold=synapse_threshold)

        # 2. Inicializar simulador LIF especializado
        params = dict(DEFAULT_PHYSIOLOGY_PARAMS)
        params["dt"] = dt * 1000.0  # en ms
        if physiology_params:
            params.update(physiology_params)

        self.simulator = BANCLIFSimulator(self.circuit, params=params)

        # Estado de neuromodulación por dopamina
        self._dopamine_level: float = 0.0
        self._total_rewards: float = 0.0
        self._total_punishments: float = 0.0

        # Telemetría de motoneuronas BANC
        self.banc_telemetry: Dict[str, Any] = {
            "active_mode": "banc",
            "circuit_id": self.circuit_id,
            "motor_rate_hz": 0.0,
            "left_motor_rate_hz": 0.0,
            "right_motor_rate_hz": 0.0,
            "jump_motor_rate_hz": 0.0,
            "jump_motor_active": False,
            "top_active_motor_neuron": None,
            "total_spikes": 0,
            "recruited_motor_count": 0
        }

    @property
    def total_neurons(self) -> int:
        return len(self.circuit.get("nodes", [])) if hasattr(self, "circuit") and self.circuit else 0

    @property
    def total_synapses(self) -> int:
        return len(self.circuit.get("edges", [])) if hasattr(self, "circuit") and self.circuit else 0

    @property
    def dopamine_level(self) -> float:
        return self._dopamine_level

    @dopamine_level.setter
    def dopamine_level(self, val: float):
        self._dopamine_level = val

    @property
    def total_rewards(self) -> float:
        return self._total_rewards

    @total_rewards.setter
    def total_rewards(self, val: float):
        self._total_rewards = val

    @property
    def total_punishments(self) -> float:
        return self._total_punishments

    @total_punishments.setter
    def total_punishments(self, val: float):
        self._total_punishments = val

    def set_circuit(self, circuit_id: str, synapse_threshold: Optional[int] = None):
        """Cambia el circuito BANC activo entre 'sensorimotor', 'giant_fiber' y 'p9'."""
        if circuit_id == self.circuit_id:
            return
        self.circuit_id = circuit_id
        thresh = synapse_threshold or (3 if circuit_id in ("giant_fiber", "sensorimotor") else 5)
        if circuit_id == "sensorimotor":
            self.circuit = self.circuit_mgr.extract_sensorimotor_circuit(synapse_threshold=thresh)
        elif circuit_id == "giant_fiber":
            self.circuit = self.circuit_mgr.extract_giant_fiber_circuit(synapse_threshold=thresh)
        else:
            self.circuit = self.circuit_mgr.extract_p9_circuit(synapse_threshold=thresh)
        self.simulator = BANCLIFSimulator(self.circuit, params=self.simulator.params)
        self.banc_telemetry["circuit_id"] = self.circuit_id

    def set_connectome_mode(self, mode: str):
        """Actualiza el modo del agente."""
        self.connectome_mode = mode
        self.banc_telemetry["active_mode"] = mode

    def reward(self, amount: float = 1.0, reason: str = "recompensa"):
        self._dopamine_level = min(2.0, self._dopamine_level + amount * 0.2)
        self._total_rewards += amount

    def punish(self, amount: float = 1.0, reason: str = "castigo"):
        self._dopamine_level = max(-2.0, self._dopamine_level - amount * 0.2)
        self._total_punishments += amount

    def step(
        self,
        threats: Optional[List[Dict[str, Any]]] = None,
        forward_drive_hz: float = 0.0,
        lateral_drive_hz: float = 0.0,
        aversive_drive_hz: float = 0.0,
        trial_duration_ms: float = 40.0,
    ) -> ActionOutput:
        """
        Ejecuta un paso de simulación biofísica a través del conectoma BANC:
        1. Integra estímulos visuales direccionales y aversivos.
        2. Estimula neuronas descendentes correspondientes (DNp01 Giant Fiber / DNp09 locomotoras).
        3. Integra dinámicas LIF en el VNC hasta las motoneuronas torácicas.
        4. Decodifica la respuesta motora real (salto TTMn, vuelo DLMn, flexión/extensión de patas).
        """
        threats = threats or []
        has_threat = len(threats) > 0 or aversive_drive_hz > 10.0 or self._dopamine_level < -0.3

        # Si hay amenaza o aversión, inyectar alta frecuencia al circuito de escape (DNp01)
        base_drive = max(forward_drive_hz, abs(lateral_drive_hz))
        stim_rate = 180.0 if has_threat else max(20.0, base_drive)

        # Ejecutar simulación LIF
        sim_res = self.simulator.run_simulation(
            stim_rate=stim_rate,
            t_run=trial_duration_ms
        )

        motor_rate = sim_res["population_rates_hz"]["motor_neurons"]
        dn_rate = sim_res["population_rates_hz"]["descending_inputs"]
        total_spikes = sim_res["total_spikes"]

        # Evaluar motoneuronas por lado y tipo funcional
        motor_outputs = sim_res.get("motor_outputs", [])
        left_m = [m for m in motor_outputs if m.get("side") == "left"]
        right_m = [m for m in motor_outputs if m.get("side") == "right"]
        jump_m = [m for m in motor_outputs if "tergotrochanter" in m.get("cell_type", "").lower()]

        left_rate = float(np.mean([m["firing_rate_hz"] for m in left_m])) if left_m else 0.0
        right_rate = float(np.mean([m["firing_rate_hz"] for m in right_m])) if right_m else 0.0
        jump_rate = float(np.max([m["firing_rate_hz"] for m in jump_m])) if jump_m else 0.0

        jump_active = bool(jump_rate > 0.0 or has_threat)
        top_motor = motor_outputs[0]["cell_type"] if motor_outputs else None
        recruited = sum(1 for m in motor_outputs if m["firing_rate_hz"] > 0)

        # Actualizar telemetría BANC
        self.banc_telemetry = {
            "active_mode": "banc",
            "circuit_id": self.circuit_id,
            "motor_rate_hz": motor_rate,
            "left_motor_rate_hz": left_rate,
            "right_motor_rate_hz": right_rate,
            "jump_motor_rate_hz": jump_rate,
            "jump_motor_active": jump_active,
            "top_active_motor_neuron": top_motor,
            "total_spikes": total_spikes,
            "recruited_motor_count": recruited
        }

        # Generar acción física con dirección decodificada
        diff_mot = right_rate - left_rate if (right_rate + left_rate) > 0.01 else (lateral_drive_hz / 50.0)
        steer_yaw = float(np.clip(diff_mot, -1.0, 1.0))

        if jump_active or (has_threat and motor_rate > 0.1):
            action_state = ActionState.ESCAPE_JUMP
            fwd = 0.2
            yaw = steer_yaw * 1.5
            wbf = 210.0
            escape = True
        elif motor_rate > 0.2 or base_drive > 30.0:
            action_state = ActionState.WALKING
            fwd = min(1.0, max(0.2, motor_rate / 5.0))
            yaw = steer_yaw
            wbf = 0.0
            escape = False
        else:
            action_state = ActionState.IDLE
            fwd = 0.0
            yaw = 0.0
            wbf = 0.0
            escape = False

        action = ActionOutput(
            forward_thrust=fwd,
            turn_yaw=yaw,
            proboscis_extended=False,
            escape_jump=escape,
            grooming=False,
            state=action_state,
            wingbeat_hz=wbf,
        )

        # Actualizar física básica
        if action.escape_jump:
            self.speed = 120.0
        elif action.state == ActionState.WALKING:
            self.speed = fwd * 40.0
        else:
            self.speed *= 0.8

        rad = np.radians(self.angle)
        dt_s = trial_duration_ms / 1000.0
        self.x += float(np.cos(rad)) * self.speed * dt_s
        self.y += float(np.sin(rad)) * self.speed * dt_s

        return action

    def get_telemetry(self) -> Dict[str, Any]:
        """Devuelve el estado cinemático, dopaminérgico y electrofisiológico de motoneuronas BANC."""
        return {
            "position": {"x": round(self.x, 1), "y": round(self.y, 1), "angle": round(self.angle, 3)},
            "speed": round(self.speed, 2),
            "dopamine": {
                "current_level": round(float(self.dopamine_level), 3),
                "total_rewards": round(float(self.total_rewards), 2),
                "total_punishments": round(float(self.total_punishments), 2),
            },
            "banc": dict(self.banc_telemetry),
        }

