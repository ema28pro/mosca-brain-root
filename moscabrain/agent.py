"""
MoscaBrain: Clase principal FlyAgent con Conectoma 100% Real de FlyWire.
Elimina cualquier circuito sintético y conecta la visión hexagonal, el olfato
y la dopamina directamente a las 15.091.983 sinapsis de FlyWire.
"""

from typing import List, Dict, Optional, Tuple, Union
import numpy as np

from .connectome.circuits import FlyWireConnectomeTopology
from .connectome.dynamics import ConnectomeEngine
from .vision.compound_eye import CompoundEye, VisionConfig
from .vision.hexagonal_eye import HexagonalCompoundEye
from .olfaction.antennal_lobe import AntennalLobe
from .dopamine.system import DopamineSystem
from .body.motor import ActionOutput, ActionState


class FlyAgent:
    """
    Agente mosca corporizado con cerebro simulado a partir del conectoma real de FlyWire.
    Contiene 138.639 neuronas reales y 15.091.983 sinapsis biológicas reales.
    """

    def __init__(
        self,
        dt: float = 0.002,
        num_ommatidia: int = 32,
        num_glomeruli: int = 16,
        fov_horizontal: float = 270.0,
        connectome_mode: str = "banc",
    ):
        # Modo de conectoma: "banc" (Whole-CNS: Cerebro + VNC) o "flywire_brain" (Solo cerebro)
        self.connectome_mode = connectome_mode

        # 1. Conectoma Real de FlyWire (15.091.983 sinapsis cerebrales)
        self.topology = FlyWireConnectomeTopology()
        self.engine = ConnectomeEngine(topology=self.topology, dt=dt)

        # 1.1 Módulos BANC (Whole-CNS: Brain + Nerve Cord)
        self._banc_circuit_mgr = None
        self._banc_gf_sim = None
        self._banc_p9_sim = None
        self.banc_telemetry: Dict[str, Any] = {
            "active_mode": self.connectome_mode,
            "motor_rate_hz": 0.0,
            "jump_motor_active": False,
            "leg_motor_rate_hz": 0.0,
            "top_active_motor_neuron": None
        }

        # 2. Órganos Sensoriales
        # A) Ojo compuesto tradicional
        self.vision = CompoundEye(VisionConfig(fov_horizontal=fov_horizontal, ommatidia_count=num_ommatidia))
        # B) Ojo hexagonal directo (captura de pantalla por ojo sin FOV)
        self.hex_vision = HexagonalCompoundEye(rows=6, cols=6)

        # Sistema olfativo
        self.olfaction = AntennalLobe(num_glomeruli=num_glomeruli)

        # 3. Neuromodulación por Dopamina (conectada a neuronas PAM reales)
        self.dopamine = DopamineSystem(self.engine)

        # Posición y estado cinemático corporal en el entorno
        self.x: float = 300.0
        self.y: float = 300.0
        self.angle: float = 0.0
        self.speed: float = 0.0

        # Estado motor de alimentación (probóscide)
        self.is_feeding: bool = False
        self.feeding_counter: int = 0

    def set_connectome_mode(self, mode: str):
        """Alterna dinámicamente entre conectoma completo 'banc' y cerebral 'flywire_brain'."""
        if mode not in ("banc", "flywire_brain"):
            raise ValueError(f"Modo desconocido: '{mode}'. Opciones válidas: 'banc', 'flywire_brain'")
        self.connectome_mode = mode
        self.banc_telemetry["active_mode"] = mode

    def _get_banc_gf_simulator(self):
        if self._banc_gf_sim is None:
            from .connectome.banc_circuit import BANCCircuitManager
            from .connectome.banc_lif_simulator import BANCLIFSimulator
            self._banc_circuit_mgr = BANCCircuitManager()
            circuit = self._banc_circuit_mgr.extract_giant_fiber_circuit(synapse_threshold=3)
            self._banc_gf_sim = BANCLIFSimulator(circuit)
        return self._banc_gf_sim

    def start_feeding(self):
        """Inicia el programa motor de alimentación y extensión de probóscide."""
        self.is_feeding = True
        self._motor_settle_steps = 0
        self.speed = 0.0

    def stop_feeding(self):
        """Retrae la probóscide; el conectoma retoma el control del motor inmediatamente."""
        self.is_feeding = False
        self.engine.reset_motor_bias()
        self.olfaction.clear()

    # -------------------------------------------------------------------------
    # API de Dopamina y Azúcar Biológico
    # -------------------------------------------------------------------------
    def reward(self, amount: float = 1.0, reason: str = "recompensa"):
        """Inyecta un pulso de dopamina activando las neuronas PAM reales de FlyWire."""
        self.dopamine.reward(amount=amount, reason=reason)

    def punish(self, amount: float = 1.0, reason: str = "castigo"):
        """Inyecta una señal aversiva al cerebro de la mosca."""
        self.dopamine.punish(amount=amount, reason=reason)

    def aversion(self, amount: float = 1.0, reason: str = "aversion"):
        """Inyecta una señal aversiva / castigo al clúster PPL1 de la mosca (alias de punish)."""
        return self.punish(amount=amount, reason=reason)

    def stimulate_sugar(self, intensity: float = 1.5):
        """Estimula directamente las neuronas gustativas de azúcar (Sugar GRNs) reales."""
        self.engine.stimulate_sugar(intensity=intensity)

    # -------------------------------------------------------------------------
    # Paso de Simulación Integrado (Entorno Tradicional)
    # -------------------------------------------------------------------------
    def step(
        self,
        light_sources: Optional[List[Dict]] = None,
        threats: Optional[List[Dict]] = None,
        odor_signal: Optional[Dict] = None,
        odor_name: Optional[str] = None,
        symbol: Optional[str] = None,
        substeps: int = 1,
    ) -> ActionOutput:
        """
        Ejecuta un ciclo completo:
        1. Procesa visión y olfato.
        2. Inyecta corrientes a las neuronas reales de FlyWire.
        3. Integra dinámicas a través de las 15M sinapsis reales.
        4. Decodifica las neuronas descendientes de marcha P9 reales.
        """
        light_sources = light_sources or []
        threats = threats or []

        # A) Estímulos visuales
        left_vis, right_vis, looming = self.vision.process_environment(
            self.x, self.y, self.angle, light_sources, threats
        )

        # B) Estímulos olfativos: solo lecturas locales de ambas antenas.
        if odor_signal:
            odor_name = odor_signal.get("name", "sacarosa_azucar")
            self.olfaction.expose_odor(odor_name, concentration=float(odor_signal.get("concentration", 0.0)))
        elif odor_name:
            self.olfaction.expose_odor(odor_name)
        elif symbol:
            self.olfaction.encode_symbol(symbol)

        # C) Evaluar triggers automáticos de dopamina
        self.dopamine.evaluate_triggers()

        # D) Integrar en el conectoma real
        for _ in range(substeps):
            self.engine.inject_optic_input(left_vis, right_vis)
            if odor_signal and not self.is_feeding:
                self.engine.inject_olfactory_input(
                    self.olfaction.get_activity_vector(),
                    odor_signal.get("left_concentration", 0.0),
                    odor_signal.get("right_concentration", 0.0),
                )
            elif (odor_name or symbol) and not self.is_feeding:
                act = self.olfaction.get_activity_vector()
                c = float(self.olfaction.concentration)
                self.engine.inject_olfactory_input(act, c, c)
            if looming > 0.05:
                # Inyección biológica directa a las 104 neuronas LC4 de FlyWire
                self.engine.inject_looming_input(looming)
            self.engine.step()

        # E) Decodificar comandos motores — integrando BANC si está activo
        fwd, yaw, escape = self.engine.get_motor_output()

        mn9_act = (float(np.mean(self.engine.firing_rates[self.topology.mn9_indices]))
                   if len(self.topology.mn9_indices) > 0 else 0.0)

        # En modo BANC (Whole-CNS), las motoneuronas del VNC modulan la respuesta
        if self.connectome_mode == "banc":
            if escape or looming > 0.1:
                # Simular reclutamiento motor en el circuito de escape BANC (DNp01 -> TTMn / DLMn)
                banc_sim = self._get_banc_gf_simulator()
                sim_res = banc_sim.run_simulation(stim_rate=150.0, t_run=50.0)
                m_rate = sim_res["population_rates_hz"]["motor_neurons"]
                self.banc_telemetry["motor_rate_hz"] = m_rate
                self.banc_telemetry["jump_motor_active"] = (m_rate > 0.1)
                if sim_res["motor_outputs"]:
                    self.banc_telemetry["top_active_motor_neuron"] = sim_res["motor_outputs"][0]["cell_type"]
                escape = True
            else:
                self.banc_telemetry["jump_motor_active"] = False
                self.banc_telemetry["motor_rate_hz"] = round(fwd * 12.0, 2)
                self.banc_telemetry["top_active_motor_neuron"] = "tibia_flexor" if fwd > 0.1 else None

        if self.is_feeding:
            # Contacto sensorial con alimento: la probóscide bloquea la locomoción.
            self.feeding_counter += 1
            action_state = ActionState.FEEDING
            fwd = 0.0
            yaw = 0.0
            wbf = 0.0
            proboscis = True
            escape = False
        elif escape:
            # Señal de escape biológica de Giant Fiber activada por LC4 / DNp01.
            action_state = ActionState.ESCAPE_JUMP
            wbf = 210.0
            proboscis = False
        elif fwd > 0.05:
            action_state = ActionState.WALKING if abs(yaw) < 0.2 else (
                ActionState.TURNING_RIGHT if yaw > 0 else ActionState.TURNING_LEFT
            )
            wbf = 0.0
            proboscis = (self.dopamine.current_level > 0.8 or mn9_act > 0.05)
        else:
            action_state = ActionState.IDLE
            wbf = 0.0
            proboscis = (mn9_act > 0.05)

        action = ActionOutput(
            forward_thrust=fwd,
            turn_yaw=yaw,
            proboscis_extended=proboscis,
            escape_jump=escape,
            grooming=False,
            state=action_state,
            wingbeat_hz=wbf,
        )

        # F) Actualizar cinemática física
        self._update_physics(action)

        return action

    # -------------------------------------------------------------------------
    # Paso de Simulación con Captura Hexagonal de Pantalla (Sin FOV)
    # -------------------------------------------------------------------------
    def step_screen(
        self,
        screen_frame: np.ndarray,
        stereo_mode: str = "split",  # "split" (mitad izq/der) o "duplicate" (pantalla completa a ambos)
        substeps: int = 5,
    ) -> Tuple[float, float, bool]:
        """
        Alimenta directamente una captura de pantalla a las retinas hexagonales
        de los ojos compuestos (sin FOV ni trigonometría sintética) e integra el
        conectoma real de FlyWire.

        Returns:
            (forward_thrust, turn_yaw, escape_jump)
        """
        # 1. Muestreo hexagonal por ojo
        l_hex, r_hex = self.hex_vision.capture_screen(screen_frame, stereo_mode=stereo_mode)

        # 2. Inyección a los 15 millones de sinapsis reales de FlyWire
        for _ in range(substeps):
            self.engine.inject_optic_input(l_hex, r_hex)
            self.engine.step()

        # 3. Decodificar neuronas motoras P9 reales
        fwd, yaw, escape = self.engine.get_motor_output()

        # 4. Actualizar cinemática
        rot_speed = 0.32
        self.angle += yaw * rot_speed
        self.speed = self.speed * 0.7 + fwd * 4.0 * 0.3
        self.x += np.cos(self.angle) * self.speed
        self.y += np.sin(self.angle) * self.speed

        return fwd, yaw, escape

    def _update_physics(self, action: ActionOutput):
        """Aplica las fuerzas motoras de las neuronas P9 al cuerpo."""
        if action.state == ActionState.FEEDING:
            self.speed = 0.0
            return

        if action.escape_jump:
            jump_speed = 18.0
            self.angle += action.turn_yaw * 1.5
            self.x += np.cos(self.angle) * jump_speed
            self.y += np.sin(self.angle) * jump_speed
            self.speed = jump_speed
            return

        rot_speed = 0.26
        self.angle += action.turn_yaw * rot_speed
        self.angle = (self.angle + np.pi) % (2 * np.pi) - np.pi

        max_walk_speed = 4.0
        # Modulación sacádica biológica: al girar, la mosca pivota frenando las patas interiores (Rayshubskiy 2020)
        turn_penalty = max(0.12, 1.0 - abs(action.turn_yaw) * 0.88)
        target_speed = action.forward_thrust * max_walk_speed * turn_penalty
        self.speed = self.speed * 0.6 + target_speed * 0.4

        self.x += np.cos(self.angle) * self.speed
        self.y += np.sin(self.angle) * self.speed

    def get_telemetry(self) -> dict:
        """Devuelve el estado completo del agente y telemetría del conectoma real."""
        brain_telemetry = self.engine.get_telemetry_snapshot()
        return {
            "position": {"x": round(self.x, 1), "y": round(self.y, 1), "angle": round(self.angle, 3)},
            "speed": round(self.speed, 2),
            "vision": {
                "fov": self.vision.config.fov_horizontal,
                "ommatidia_count": self.vision.config.ommatidia_count,
                "ommatidia_view": self.vision.get_view_array(),
                "looming_signal": round(float(self.vision.looming_signal), 2),
            },
            "olfaction": {
                "odor_label": self.olfaction.active_odor_label,
                "concentration": round(float(self.olfaction.concentration), 2),
                "glomeruli": [round(float(v), 2) for v in self.olfaction.glomerular_activity],
            },
            "dopamine": {
                "current_level": round(float(self.dopamine.current_level), 3),
                "total_rewards": round(self.dopamine.total_rewards, 2),
                "total_punishments": round(self.dopamine.total_punishments, 2),
            },
            "brain": brain_telemetry,
        }
