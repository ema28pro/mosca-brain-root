"""
Automated unit and integration tests for BANC Drosophila connectome simulation.
"""

import pytest
import numpy as np
from moscabrain.connectome.banc_circuit import BANCCircuitManager
from moscabrain.connectome.banc_lif_simulator import BANCLIFSimulator, run_comparison_experiment


@pytest.fixture(scope="module")
def circuit_manager():
    return BANCCircuitManager()


@pytest.fixture(scope="module")
def gf_circuit(circuit_manager):
    return circuit_manager.extract_giant_fiber_circuit(synapse_threshold=3)


def test_banc_circuit_structure(gf_circuit):
    """Test that BANC circuit preserves root IDs losslessly and contains expected cell types."""
    assert gf_circuit["circuit_id"] == "giant_fiber"
    assert "provenance" in gf_circuit
    assert gf_circuit["provenance"]["materialization"] == "v888"

    nodes = gf_circuit["nodes"]
    assert len(nodes) > 50

    # Verify ID format (64-bit root IDs preserved as strings)
    for n in nodes:
        assert isinstance(n["id"], str)
        assert len(n["id"]) > 10
        assert "super_class" in n
        assert "position_nm" in n
        assert len(n["position_nm"]) == 3

    # Check for stimulated DNs (DNp01)
    stim_nodes = [n for n in nodes if n["is_stimulated_input"]]
    assert len(stim_nodes) >= 2
    for sn in stim_nodes:
        assert "DNp01" in sn["cell_type"]

    # Check for motor outputs (TTMn, DLM)
    motor_nodes = [n for n in nodes if n["is_motor_output"]]
    assert len(motor_nodes) > 10


def test_lif_simulation_deterministic(gf_circuit):
    """Verify that same seed produces identical spike trains."""
    sim = BANCLIFSimulator(gf_circuit)

    res1 = sim.run_simulation(stim_rate=150.0, seed=42, t_run=200.0)
    res2 = sim.run_simulation(stim_rate=150.0, seed=42, t_run=200.0)

    assert res1["total_spikes"] == res2["total_spikes"]
    assert res1["population_rates_hz"] == res2["population_rates_hz"]
    assert res1["network_status"] == "healthy"


def test_baseline_vs_stimulation_recruitment(gf_circuit):
    """Verify that descending stimulation recruits motor neurons above baseline."""
    sim = BANCLIFSimulator(gf_circuit)

    res_baseline = sim.run_simulation(stim_rate=0.0, seed=42, t_run=300.0)
    res_stim = sim.run_simulation(stim_rate=150.0, seed=42, t_run=300.0)

    base_motor_rate = res_baseline["population_rates_hz"]["motor_neurons"]
    stim_motor_rate = res_stim["population_rates_hz"]["motor_neurons"]

    assert stim_motor_rate >= base_motor_rate
    assert res_stim["population_rates_hz"]["descending_inputs"] > 100.0


def test_numerical_stability(gf_circuit):
    """Ensure no NaN or Inf occurs under high stimulation."""
    sim = BANCLIFSimulator(gf_circuit, params={"weight_scale": 2.5})
    res = sim.run_simulation(stim_rate=300.0, seed=123, t_run=200.0)

    assert res["network_status"] != "numerical_instability"
    for k, v_trace in res["traces"]["voltages"].items():
        assert not np.isnan(v_trace).any()
        assert not np.isinf(v_trace).any()


def test_flyagent_connectome_mode_switching():
    """Verify FlyAgent initializes in BANC mode and can switch dynamically."""
    from moscabrain.agent import FlyAgent

    fly = FlyAgent(connectome_mode="banc")
    assert fly.connectome_mode == "banc"
    assert "active_mode" in fly.banc_telemetry
    assert fly.banc_telemetry["active_mode"] == "banc"

    # Switch to flywire_brain
    fly.set_connectome_mode("flywire_brain")
    assert fly.connectome_mode == "flywire_brain"
    assert fly.banc_telemetry["active_mode"] == "flywire_brain"

    # Switch back to banc
    fly.set_connectome_mode("banc")
    assert fly.connectome_mode == "banc"

    # Step with looming stimulus in BANC mode
    threat = [{"x": 305.0, "y": 305.0, "radius": 15.0, "speed": 10.0}]
    action = fly.step(threats=threat)
    assert action is not None
    assert "motor_rate_hz" in fly.banc_telemetry
