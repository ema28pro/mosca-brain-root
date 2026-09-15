"""
Suite de pruebas para el juego de 21 / Blackjack biofísico mediado por conectoma y dopamina.
Verifica la codificación olfativa de cartas, toma de decisiones con MBONs y modulación dopaminérgica.
"""

import pytest
import numpy as np
from moscabrain import FlyAgent


def test_blackjack_card_olfactory_encoding():
    """Verifica que las cartas y mano se codifiquen correctamente en los canales glomerulares."""
    fly = FlyAgent()
    
    # Mano de 18 puntos con Croupier mostrando un 10
    act = fly.olfaction.encode_blackjack_hand(player_total=18, dealer_upcard=10)
    assert len(act) == 16
    
    # El canal 8 (18 - 10) debe tener la máxima activación para el puntaje
    assert act[8] >= 0.8
    # El canal del dealer (12 + (10 % 4)) = 14 debe estar activo
    assert act[14] >= 0.6


def test_blackjack_connectome_decision_step():
    """Verifica que el conectoma integre la mano y genere actividades MBON de aproximación/cautela."""
    fly = FlyAgent()
    fly.olfaction.encode_blackjack_hand(player_total=14, dealer_upcard=7)
    
    # Ejecutar paso con la señal de la carta
    action = fly.step()
    assert action is not None
    
    # Consultar actividades de los circuitos MBON reales
    app = fly.engine.get_group_activity("MBON_APPROACH")
    avd = fly.engine.get_group_activity("MBON_AVOID")
    assert 0.0 <= app <= 1.0
    assert 0.0 <= avd <= 1.0


def test_blackjack_reward_and_punishment_learning():
    """Verifica que las victorias aumenten la dopamina en neuronas PAM y las derrotas la reduzcan."""
    fly = FlyAgent()
    initial_da = fly.dopamine.current_level
    
    # Victoria: +1.5 dopamina
    fly.reward(amount=1.5, reason="blackjack_win")
    assert fly.dopamine.current_level > initial_da
    assert fly.dopamine.current_level >= 1.5
    
    # Castigo por perder
    fly.punish(amount=0.8, reason="blackjack_bust")
    # Dopamina debe reducirse tras castigo
    assert fly.dopamine.current_level < 1.5


def test_blackjack_multiround_consistency():
    """Verifica que el agente pueda jugar múltiples rondas consecutivas sin degradación de estado."""
    fly = FlyAgent()
    for total in [12, 16, 20]:
        fly.olfaction.encode_blackjack_hand(total, 9)
        fly.step()
        assert fly.engine.step_count > 0
        assert not np.isnan(fly.engine.firing_rates).any()
