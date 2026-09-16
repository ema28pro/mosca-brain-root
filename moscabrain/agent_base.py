"""
MoscaBrain: Clase Base Abstracta (Interfaz) para Agentes Drosophila.
Define el contrato unificado y comportamiento común para FlyWireAgent y BANCAgent.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from .body.motor import ActionOutput


class DopamineFacade:
    """Fachada polimórfica que unifica el acceso a la dopamina."""

    def __init__(self, agent: "BaseFlyAgent"):
        self._agent = agent

    @property
    def current_level(self) -> float:
        return self._agent.dopamine_level

    @property
    def total_rewards(self) -> float:
        return self._agent.total_rewards

    @property
    def total_punishments(self) -> float:
        return self._agent.total_punishments

    def reward(self, amount: float = 1.0, reason: str = "recompensa"):
        return self._agent.reward(amount=amount, reason=reason)

    def punish(self, amount: float = 1.0, reason: str = "castigo"):
        return self._agent.punish(amount=amount, reason=reason)

    def aversion(self, amount: float = 1.0, reason: str = "aversion"):
        return self._agent.aversion(amount=amount, reason=reason)


class TopologyFacade:
    """Fachada polimórfica que unifica el acceso a métricas estructurales del conectoma."""

    def __init__(self, agent: "BaseFlyAgent"):
        self._agent = agent

    @property
    def total_neurons(self) -> int:
        return self._agent.total_neurons

    @property
    def total_synapses(self) -> int:
        return self._agent.total_synapses


class BaseFlyAgent(ABC):
    """
    Clase base abstracta para todos los agentes corporizados de Drosophila en MoscaBrain.
    Garantiza una interfaz unificada y polimórfica para:
    - FlyWireAgent (Cerebro cefálico aislado de 138k neuronas).
    - BANCAgent (Whole-CNS: Cerebro + Cordón Nervioso Ventral VNC).
    """

    def __init__(self, connectome_mode: str = "base"):
        self.connectome_mode: str = connectome_mode

        # Estado cinemático corporal en el entorno
        self.x: float = 300.0
        self.y: float = 300.0
        self.angle: float = 0.0
        self.speed: float = 0.0

        # Estado motor de alimentación (probóscide)
        self.is_feeding: bool = False
        self.feeding_counter: int = 0

    @property
    @abstractmethod
    def total_neurons(self) -> int:
        """Número total de neuronas del conectoma."""
        pass

    @property
    @abstractmethod
    def total_synapses(self) -> int:
        """Número total de sinapsis del conectoma."""
        pass

    @property
    @abstractmethod
    def dopamine_level(self) -> float:
        """Nivel actual de dopamina extracelular."""
        pass

    @property
    @abstractmethod
    def total_rewards(self) -> float:
        """Total acumulado de recompensas PAM recibidas."""
        pass

    @property
    @abstractmethod
    def total_punishments(self) -> float:
        """Total acumulado de castigos PPL1 recibidos."""
        pass

    @abstractmethod
    def reward(self, amount: float = 1.0, reason: str = "recompensa"):
        """Inyecta un pulso de dopamina / refuerzo apetitivo (PAM)."""
        pass

    @abstractmethod
    def punish(self, amount: float = 1.0, reason: str = "castigo"):
        """Inyecta una señal aversiva / castigo (PPL1)."""
        pass

    def aversion(self, amount: float = 1.0, reason: str = "aversion"):
        """Alias para castigo/estímulo aversivo."""
        return self.punish(amount=amount, reason=reason)

    def start_feeding(self):
        """Inicia el programa motor de alimentación y extensión de probóscide."""
        self.is_feeding = True
        self.speed = 0.0

    def stop_feeding(self):
        """Retrae la probóscide."""
        self.is_feeding = False
        self.feeding_counter = 0

    @property
    def dopamine(self) -> Any:
        """Fachada predeterminada de dopamina o subsistema asignado."""
        if hasattr(self, "_dopamine") and self._dopamine is not None:
            return self._dopamine
        return DopamineFacade(self)

    @dopamine.setter
    def dopamine(self, value: Any):
        self._dopamine = value

    @property
    def topology(self) -> Any:
        """Fachada predeterminada de topología o subsistema asignado."""
        if hasattr(self, "_topology") and self._topology is not None:
            return self._topology
        return TopologyFacade(self)

    @topology.setter
    def topology(self, value: Any):
        self._topology = value

    @abstractmethod
    def step(self, **kwargs) -> ActionOutput:
        """Avanza un paso de simulación."""
        pass

    @abstractmethod
    def get_telemetry(self) -> Dict[str, Any]:
        """Devuelve el estado completo del agente y telemetría."""
        pass
