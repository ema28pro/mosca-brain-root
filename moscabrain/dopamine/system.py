"""
MoscaBrain: Sistema de Dopamina y Triggers de Recompensa/Castigo.
Controla los clústeres dopaminérgicos PAM (recompensa por azúcar/apetitivo)
y PPL1 (aversivo/castigo), facilitando triggers directos o condicionales.
"""

from typing import Callable, List, Dict, Optional
import time


class DopamineSystem:
    """
    Gestiona la modulación dopaminérgica del cerebro de la mosca.
    Permite llamadas directas e inyección automática de dopamina basada en triggers.
    """

    def __init__(self, connectome_engine):
        self._engine = connectome_engine
        self.triggers: List[Dict] = []
        self.reward_history: List[Dict] = []
        self.total_rewards = 0.0
        self.total_punishments = 0.0

    def trigger(self, amount: float = 1.0, is_reward: bool = True, reason: str = "manual"):
        """
        Inyecta dopamina directamente en el conectoma.
        amount: intensidad de la liberación (0.1 a 2.0)
        is_reward: True para recompensa (PAM), False para aversión (PPL1)
        """
        self._engine.trigger_dopamine(amount=amount, is_reward=is_reward)
        if is_reward:
            self.total_rewards += amount
        else:
            self.total_punishments += amount

        event = {
            "timestamp": time.time(),
            "step": self._engine.step_count,
            "type": "REWARD_PAM" if is_reward else "PUNISH_PPL1",
            "amount": amount,
            "reason": reason,
        }
        self.reward_history.append(event)
        if len(self.reward_history) > 100:
            self.reward_history.pop(0)

    def reward(self, amount: float = 1.0, reason: str = "recompensa"):
        """Azúcar o satisfacción: activa el clúster PAM de dopamina."""
        self.trigger(amount=amount, is_reward=True, reason=reason)

    def punish(self, amount: float = 1.0, reason: str = "castigo"):
        """Estímulo aversivo: activa el clúster PPL1."""
        self.trigger(amount=amount, is_reward=False, reason=reason)

    def add_condition(self, condition_func: Callable[[], Optional[float]], reason: str = "trigger_auto"):
        """
        Registra una función condicional que se evalúa en cada paso.
        Si la función retorna un valor numérico > 0, dispara esa cantidad de dopamina.
        """
        self.triggers.append({"func": condition_func, "reason": reason})

    def evaluate_triggers(self):
        """Evalúa todos los triggers condicionales automáticos."""
        for trig in self.triggers:
            try:
                res = trig["func"]()
                if res is not None and res > 0.0:
                    self.reward(amount=float(res), reason=trig["reason"])
                elif res is not None and res < 0.0:
                    self.punish(amount=abs(float(res)), reason=trig["reason"])
            except Exception:
                pass

    @property
    def current_level(self) -> float:
        """Nivel actual de dopamina extracelular en el cerebro."""
        return float(self._engine.dopamine_level)
