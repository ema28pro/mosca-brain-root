"""
Suite de pruebas para quimiorrecepción olfativa, plumas de olor bilaterales y quimiotaxis.
Verifica la orientación espacial hacia sacarosa y la activación de neuronas receptoras Or56a y Sugar GRNs.
"""

import pytest
import numpy as np
from moscabrain import FlyAgent, SimulationArena, FoodItem


def test_known_odors_profiles():
    """Verifica que los perfiles olfativos biológicos conocidos activen los glomérulos correctos."""
    fly = FlyAgent()
    
    # Vinagre de manzana
    act_vin = fly.olfaction.expose_odor("vinagre_manzana", concentration=1.0)
    assert act_vin[0] > 0.5
    
    # Humo aversivo
    act_smoke = fly.olfaction.expose_odor("humo_repelente", concentration=1.0)
    assert act_smoke[5] > 0.5
    
    # Sacarosa
    act_sugar = fly.olfaction.expose_odor("sacarosa_azucar", concentration=1.0)
    assert act_sugar[2] > 0.5


def test_bilateral_odor_steering_bias():
    """Verifica que una concentración asimétrica entre antenas incline el giro motor hacia el lado más fuerte."""
    fly = FlyAgent()
    topo = fly.topology
    
    # Estímulo con mayor concentración a la derecha
    fly.step(odor_signal={
        "name": "sacarosa_azucar",
        "concentration": 0.8,
        "left_concentration": 0.1,
        "right_concentration": 0.9,
    })
    
    # La corriente sináptica en P9 y DNa derechos debe ser superior a los izquierdos
    assert fly.engine.syn_currents[topo.p9_right_idx] >= fly.engine.syn_currents[topo.p9_left_idx]


def test_or56a_olfactory_receptor_excitation():
    """Verifica que la exposición olfativa inyecte corriente en las 39 neuronas Or56a de FlyWire."""
    fly = FlyAgent()
    topo = fly.topology
    assert len(topo.or56a_indices) == 39
    
    fly.step(odor_name="humo_repelente")
    or56a_currents = fly.engine.syn_currents[topo.or56a_indices]
    assert np.any(or56a_currents > 0.0)


def test_post_feeding_motor_and_mbon_reset():
    """Verifica que tras consumir sacarosa, MBONs y DN_STEER se normalicen sin sesgo de giro infinito."""
    arena = SimulationArena(width=800, height=520)
    arena.scenario_name = "test"
    arena.foods.clear()
    arena.lights.clear()
    arena.threats.clear()

    # Mosca colocada frente a la comida
    arena.agent.x = 200.0
    arena.agent.y = 200.0
    arena.agent.angle = 0.0
    arena.foods.append(FoodItem("food_test", 215.0, 200.0, radius=12.0))

    # Consumir la comida
    steps = 0
    while (arena.agent.is_feeding or len(arena.foods) > 0) and steps < 60:
        arena.step()
        steps += 1

    assert len(arena.foods) == 0, "La comida debe haberse consumido por completo"
    assert not arena.agent.is_feeding, "La probóscide debe retraerse tras comer"

    # Verificar reposo post-ingesta
    groups = arena.agent.engine.get_telemetry_snapshot()["groups"]
    assert groups["DN_STEER_R"]["firing_rate"] < 0.05
    assert groups["DN_STEER_L"]["firing_rate"] < 0.05
    assert groups["MBON_APPROACH"]["firing_rate"] < 0.05
    assert groups["MBON_AVOID"]["firing_rate"] < 0.05

    # Verificar que los pasos subsiguientes caminan rectos sin giros a la derecha
    for _ in range(10):
        act = arena.step()
        assert abs(act.turn_yaw) < 0.1
        assert act.state.name != "TURNING_RIGHT"
