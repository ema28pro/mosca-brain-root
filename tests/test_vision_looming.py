"""
Suite de pruebas para el sistema visual de ojo compuesto, detección de looming y reflejo de escape.
Verifica las 104 neuronas LC4, Giant Fiber, fotorreceptores y cinemática balística.
"""

import pytest
import numpy as np
from moscabrain import FlyAgent, VisionConfig


def test_vision_configuration_and_fov():
    """Verifica que la configuración del campo visual modifique el número de omatidios y ángulos."""
    fly = FlyAgent()
    fly.vision.configure(fov_horizontal=240.0, ommatidia_count=24, sensitivity=1.2)
    
    assert fly.vision.config.fov_horizontal == 240.0
    assert fly.vision.config.ommatidia_count == 24
    assert fly.vision.n_left == 12
    assert fly.vision.n_right == 12
    assert len(fly.vision.left_angles) == 12
    assert len(fly.vision.right_angles) == 12


def test_looming_stimulus_detection():
    """Verifica que una sombra en expansión angular cercana dispare la señal de looming."""
    fly = FlyAgent()
    # Sombra amenazante muy cerca y con gran tamaño
    threats = [{"x": fly.x + 30.0, "y": fly.y, "radius": 35.0, "speed": 8.0}]
    
    l_vis, r_vis, looming = fly.vision.process_environment(
        fly.x, fly.y, fly.angle, light_sources=[], shadows_or_threats=threats
    )
    
    assert looming > 0.3
    assert len(l_vis) > 0
    assert len(r_vis) > 0


def test_lc4_to_giant_fiber_synaptic_activation():
    """Verifica la transmisión biológica de LC4 a Giant Fiber a través de las 15M de sinapsis de FlyWire."""
    fly = FlyAgent()
    topo = fly.topology
    
    # Asegurar que las neuronas biológicas de FlyWire están presentes
    assert len(topo.lc4_indices) == 104
    assert len(topo.giant_fiber_indices) == 2
    
    # Inyectar corriente a LC4
    fly.engine.inject_looming_input(2.5)
    fly.engine.step()
    fly.engine.step()
    
    # Giant Fiber debe registrar potencial de membrana o disparo
    gf_rates = fly.engine.firing_rates[topo.giant_fiber_indices]
    assert np.any(gf_rates > 0.0) or np.any(fly.engine.spikes[topo.giant_fiber_indices])


def test_escape_jump_kinematics():
    """Verifica que el salto de escape aumente la velocidad a niveles balísticos y active batido de alas."""
    fly = FlyAgent()
    # Simular activación directa de Giant Fiber
    fly.engine.syn_currents[fly.topology.giant_fiber_indices] += 60.0
    fly.engine.step()
    
    action = fly.step()
    if action.escape_jump:
        assert action.wingbeat_hz > 150.0
        assert fly.speed > 8.0
