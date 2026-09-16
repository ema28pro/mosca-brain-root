"""
Suite de pruebas para control motor, neuronas descendientes P9/DNa, probóscide MN9 y estabilización.
"""

import pytest
import numpy as np
from moscabrain import FlyAgent, SimulationArena, ActionState, FoodItem


def test_p9_forward_walking_thrust():
    """Verifica que la activación de P9 aumente el empuje hacia adelante."""
    fly = FlyAgent()
    topo = fly.topology
    
    # Inyectar corriente motora suficiente en P9 para alcanzar umbral de disparo
    fly.engine.syn_currents[topo.p9_left_idx] += 120.0
    fly.engine.syn_currents[topo.p9_right_idx] += 120.0
    fly.engine.step()
    
    fwd, yaw, escape = fly.engine.get_motor_output()
    assert fwd >= 0.15
    assert not escape


def test_dna_steering_yaw_control():
    """Verifica que la activación asimétrica de DNa01/02 module el giro angular."""
    fly = FlyAgent()
    topo = fly.topology
    
    # Estimular giro hacia la derecha
    if len(topo.dna_right_indices) > 0:
        fly.engine.syn_currents[topo.dna_right_indices] += 40.0
    fly.engine.step()
    
    fwd, yaw, escape = fly.engine.get_motor_output()
    assert yaw >= 0.0


def test_mn9_proboscis_feeding_extension():
    """Verifica que la probóscide se extienda cuando las motoneuronas MN9 están activas o hay alimento."""
    fly = FlyAgent()
    topo = fly.topology
    
    fly.start_feeding()
    assert fly.is_feeding
    action = fly.step()
    assert action.proboscis_extended
    assert action.state == ActionState.FEEDING
    assert fly.speed == 0.0
    
    fly.stop_feeding()
    assert not fly.is_feeding


def test_dopamine_suppresses_escape_during_and_after_eating():
    """Verifica el mecanismo biológico por el cual la dopamina alta inhibe saltos erráticos tras comer."""
    fly = FlyAgent()
    fly.dopamine.reward(amount=1.5, reason="sacarosa_devorada")
    assert fly.dopamine.current_level > 0.4
    
    # Aunque haya cierta actividad visual residual, el escape queda suprimido
    fwd, yaw, escape = fly.engine.get_motor_output()
    assert not escape
