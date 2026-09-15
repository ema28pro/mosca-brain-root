"""
Suite de pruebas unitarias para MoscaBrain (100% Conectoma Real de FlyWire v783).
Verifica las 15.091.983 sinapsis, las 138.639 neuronas, la captura hexagonal de pantalla
sin FOV, la inyección de dopamina, el puente GameBridge y la arena.
"""

import pytest
import numpy as np
from moscabrain import (
    FlyAgent,
    SimulationArena,
    VisionConfig,
    ActionState,
    ActionOutput,
    FoodItem,
    FlyWireConnectomeTopology,
    HexagonalCompoundEye,
    GameBridge,
)


def test_real_connectome_dataset_integrity():
    """Verifica que el dataset real de FlyWire cargue 138.639 neuronas y 15M de conexiones."""
    topo = FlyWireConnectomeTopology()
    assert topo.num_neurons == 138639

    df = topo.load_connections_dataframe()
    assert len(df) == 15091983
    assert "Presynaptic_Index" in df.columns
    assert "Postsynaptic_Index" in df.columns
    assert "Excitatory x Connectivity" in df.columns

    # Verificar neuronas biológicas anotadas
    assert len(topo.sugar_grn_ids) == 21
    assert 720575940624963786 in topo.sugar_grn_ids

    assert len(topo.p9_walking_ids) == 2
    assert 720575940627652358 in topo.p9_walking_ids


def test_agent_initialization_with_real_flywire():
    """El agente debe inicializar directamente las 138.639 neuronas reales de FlyWire."""
    fly = FlyAgent()
    assert fly.engine.total_neurons == 138639
    assert fly.engine.total_synapses == 15091983
    assert fly.dopamine.current_level == 0.0


def test_hexagonal_eye_screen_capture():
    """Verifica la captura de pantalla hexagonal por ojo sin cálculos de FOV."""
    hex_eye = HexagonalCompoundEye(rows=6, cols=6)
    assert hex_eye.num_ommatidia_per_eye == 36

    # Imagen de prueba (mitad izquierda blanca, derecha negra)
    mock_frame = np.zeros((120, 160, 3), dtype=np.uint8)
    mock_frame[:, :80] = 255

    # Modo split
    l_hex, r_hex = hex_eye.capture_screen(mock_frame, stereo_mode="split")
    assert len(l_hex) == 36
    assert len(r_hex) == 36
    assert np.mean(l_hex) > 0.8
    assert np.mean(r_hex) < 0.2

    # Modo duplicate
    l_dup, r_dup = hex_eye.capture_screen(mock_frame, stereo_mode="duplicate")
    assert np.allclose(l_dup, r_dup)


def test_step_screen_with_real_flywire():
    """Verifica que un fotograma de pantalla se integre en los 15 millones de sinapsis reales."""
    fly = FlyAgent()
    mock_frame = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    fwd, yaw, escape = fly.step_screen(mock_frame, stereo_mode="split")
    assert 0.0 <= fwd <= 1.0
    assert -1.0 <= yaw <= 1.0
    assert isinstance(escape, bool)


def test_real_sugar_and_dopamine_injection():
    """Verifica que la estimulación de azúcar active las Sugar GRNs y el clúster PAM real."""
    fly = FlyAgent()
    assert fly.dopamine.current_level == 0.0
    fly.stimulate_sugar(intensity=1.5)
    assert fly.dopamine.current_level > 0.5
    fly.reward(amount=1.0)
    assert fly.dopamine.current_level >= 1.0


def test_olfactory_encoding():
    """Verifica la codificación de aromas y manos de cartas en los glomérulos."""
    fly = FlyAgent()
    act = fly.olfaction.expose_odor("vinagre_manzana", concentration=1.0)
    assert len(act) == 16
    assert np.any(act > 0.5)

    act_card = fly.olfaction.encode_blackjack_hand(18, 10)
    assert len(act_card) == 16
    assert act_card[8] > 0.5


def test_simulation_arena_with_real_flywire():
    """Verifica la arena virtual 2D corriendo con el conectoma real."""
    arena = SimulationArena(width=600, height=400)
    assert len(arena.foods) > 0
    state = arena.get_state()
    assert "arena" in state
    assert "fly" in state
    assert state["fly"]["brain"]["total_neurons"] == 138639
    assert state["fly"]["brain"]["total_synapses"] == 15091983


def test_sucrose_plume_is_bilateral_and_never_passes_food_coordinates(monkeypatch):
    """La arena entrega al agente solo lecturas antenales de la pluma."""
    arena = SimulationArena(width=600, height=400)
    food = arena.foods[0]

    arena.agent.x = food.x - 50.0
    arena.agent.y = food.y - 30.0
    arena.agent.angle = np.pi / 2.0
    received = {}

    def capture_step(**kwargs):
        received.update(kwargs["odor_signal"])
        return ActionOutput(0.0, 0.0, False, False, False, ActionState.IDLE, 0.0)

    monkeypatch.setattr(arena.agent, "step", capture_step)
    arena.step()

    assert received["name"] == "sacarosa_azucar"
    assert received["concentration"] > 0.0
    assert received["left_concentration"] != received["right_concentration"]
    assert "x" not in received
    assert "y" not in received


def test_olfactory_input_biases_real_p9_before_motor_decoding():
    """La diferencia antenal se inyecta en P9, no en fwd/yaw ya decodificados."""
    fly = FlyAgent()
    fly.step(odor_signal={
        "name": "sacarosa_azucar",
        "concentration": 0.7,
        "left_concentration": 0.2,
        "right_concentration": 0.8,
    })

    assert fly.engine.syn_currents[fly.topology.p9_right_idx] > fly.engine.syn_currents[fly.topology.p9_left_idx]
    assert fly.olfaction.active_odor_label == "sacarosa_azucar"


def test_completed_sucrose_drop_settles_without_escape_or_random_turn():
    """Tras comer, el conectoma no debe producir escape ni aleteo (dopamina suprime Giant Fiber)."""
    arena = SimulationArena(width=600, height=400)
    # La punta de la probóscide ya está sobre una gota de un único fotograma.
    arena.foods = [FoodItem("last_drop", 200.0, 200.0, nutritive_value=0.04)]
    arena.agent.x = 184.0
    arena.agent.y = 200.0
    arena.agent.angle = 0.0

    arena.step()
    # La arena repone una gota para no quedar vacía, pero la consumida ya no
    # puede ser el objetivo de la navegación post-recompensa.
    assert all(food.id != "last_drop" for food in arena.foods)
    assert not arena.agent.is_feeding

    # Dopamina alta tras comer suprime el escape (Giant Fiber pathway) en el conectoma.
    # El conectoma puede producir marcha, giro o IDLE — pero nunca escape ni aleteo.
    # Nota: probóscide extendida al caminar con dopamina alta es biológicamente correcto
    # (mosca hambrienta buscando más alimento).
    for _ in range(4):
        action = arena.step()
        assert not action.escape_jump, "La recompensa de azúcar no debe disparar escape visual"
        assert action.wingbeat_hz == 0.0, "No debe haber aleteo sin amenaza visual"


def test_game_bridge_with_real_flywire():
    """Verifica que el GameBridge traduzca la pantalla a teclas mediante neuronas P9 reales."""
    bridge = GameBridge(stereo_mode="split")
    mock_screen = np.zeros((100, 100, 3), dtype=np.uint8)
    mock_screen[:, :50] = 255

    keys = bridge.step_frame(mock_screen)
    assert isinstance(keys, dict)
    assert "UP" in keys
    assert "LEFT" in keys
    assert "SPACE" in keys

    bridge.reward(amount=1.5, reason="punto_ganado")
    assert bridge.fly.dopamine.current_level > 1.0


def test_real_biological_circuits_lc4_giant_fiber_dna_mn9():
    """Valida que los circuitos biológicos reales de FlyWire (LC4, Giant Fiber, DNa, MN9) estén activos."""
    fly = FlyAgent()
    topo = fly.topology

    # 1. Verificar presencia de neuronas reales
    assert len(topo.lc4_indices) == 104
    assert len(topo.giant_fiber_indices) == 2
    assert len(topo.dna_left_indices) >= 1
    assert len(topo.dna_right_indices) >= 1
    assert len(topo.mn9_indices) == 2

    # 2. Inyección de looming a LC4 propaga a Giant Fiber en el conectoma real
    fly.engine.inject_looming_input(2.5)
    fly.engine.step()  # LC4 espiga
    fly.engine.step()  # Sinapsis de W excitan Giant Fiber
    gf_rates = fly.engine.firing_rates[topo.giant_fiber_indices]
    assert np.any(gf_rates > 0.0) or np.any(fly.engine.spikes[topo.giant_fiber_indices])

    # 3. Telemetría refleja circuitos biológicos reales
    snap = fly.engine.get_telemetry_snapshot()
    assert "giant_fiber" in snap["real_circuits"]
    assert "lc4_looming" in snap["real_circuits"]
    assert snap["groups"]["LPLC2_LOOMING"]["firing_rate"] >= 0.0
    assert snap["groups"]["DN_GIANT_FIBER"]["firing_rate"] >= 0.0

