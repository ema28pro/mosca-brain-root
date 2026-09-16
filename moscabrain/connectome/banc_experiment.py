"""
Reproducible Experiment Runner for BANC Connectome Simulation.

Compares:
1. Unstimulated baseline vs Multi-frequency descending stimulation (0 - 250 Hz).
2. Sensitivity to weight scaling (0.5x, 1.0x, 1.5x, 2.0x).
3. Sensitivity to connection filtering (synapse count cutoffs: 1, 3, 5, 10).
4. Network stability, spike timing distributions, and motor neuron recruitment.

Outputs formatted summaries and serializes reproducible results to JSON.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any
import numpy as np

from moscabrain.connectome.banc_circuit import BANCCircuitManager
from moscabrain.connectome.banc_lif_simulator import BANCLIFSimulator, DEFAULT_PHYSIOLOGY_PARAMS

RESULTS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "banc" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def run_full_banc_evaluation(
    circuit_type: str = "giant_fiber",
    seed: int = 42
) -> Dict[str, Any]:
    """Runs the complete experiment battery required by the BANC specification."""
    mgr = BANCCircuitManager()
    if circuit_type == "giant_fiber":
        circuit = mgr.extract_giant_fiber_circuit(synapse_threshold=3)
    elif circuit_type == "p9":
        circuit = mgr.extract_p9_circuit(synapse_threshold=5)
    else:
        raise ValueError(f"Unknown circuit type: {circuit_type}")

    print(f"=== Running Full BANC Evaluation on {circuit['circuit_name']} ===")

    # 1. Baseline vs Stimulation Rate Response Curve
    stim_rates = [0.0, 25.0, 50.0, 75.0, 100.0, 150.0, 200.0, 250.0]
    rate_curve = []

    base_sim = BANCLIFSimulator(circuit)
    base_res = base_sim.run_simulation(stim_rate=0.0, seed=seed)
    baseline_motor_rate = base_res["population_rates_hz"]["motor_neurons"]

    for r in stim_rates:
        sim = BANCLIFSimulator(circuit)
        res = sim.run_simulation(stim_rate=r, seed=seed)
        m_rate = res["population_rates_hz"]["motor_neurons"]
        dn_rate = res["population_rates_hz"]["descending_inputs"]
        vnc_rate = res["population_rates_hz"]["vnc_interneurons"]
        rate_curve.append({
            "stim_rate_hz": r,
            "descending_rate_hz": dn_rate,
            "vnc_interneuron_rate_hz": vnc_rate,
            "motor_rate_hz": m_rate,
            "motor_delta_from_baseline_hz": round(m_rate - baseline_motor_rate, 2),
            "total_spikes": res["total_spikes"],
            "network_status": res["network_status"]
        })

    # 2. Sensitivity to Weight Scaling (at stim_rate = 150 Hz)
    weight_scales = [0.5, 1.0, 1.5, 2.0]
    weight_sensitivity = []
    for ws in weight_scales:
        sim = BANCLIFSimulator(circuit, params={"weight_scale": ws})
        res = sim.run_simulation(stim_rate=150.0, seed=seed)
        weight_sensitivity.append({
            "weight_scale": ws,
            "descending_rate_hz": res["population_rates_hz"]["descending_inputs"],
            "vnc_interneuron_rate_hz": res["population_rates_hz"]["vnc_interneurons"],
            "motor_rate_hz": res["population_rates_hz"]["motor_neurons"],
            "total_spikes": res["total_spikes"],
            "network_status": res["network_status"]
        })

    # 3. Sensitivity to Connection Filtering (Synapse Cutoff at stim_rate = 150 Hz)
    cutoffs = [1, 3, 5, 8, 10]
    cutoff_sensitivity = []
    for co in cutoffs:
        sim = BANCLIFSimulator(circuit, params={"synapse_cutoff": co})
        res = sim.run_simulation(stim_rate=150.0, seed=seed)
        cutoff_sensitivity.append({
            "synapse_cutoff": co,
            "descending_rate_hz": res["population_rates_hz"]["descending_inputs"],
            "vnc_interneuron_rate_hz": res["population_rates_hz"]["vnc_interneurons"],
            "motor_rate_hz": res["population_rates_hz"]["motor_neurons"],
            "total_spikes": res["total_spikes"],
            "network_status": res["network_status"]
        })

    # 4. Detailed Motor Output Breakdown (150 Hz Stimulated vs Baseline)
    stim_150_sim = BANCLIFSimulator(circuit)
    stim_150_res = stim_150_sim.run_simulation(stim_rate=150.0, seed=seed)

    base_map = {m["id"]: m["firing_rate_hz"] for m in base_res["motor_outputs"]}
    motor_comparisons = []
    for m in stim_150_res["motor_outputs"]:
        nid = m["id"]
        b_rate = base_map.get(nid, 0.0)
        s_rate = m["firing_rate_hz"]
        delta = round(s_rate - b_rate, 2)
        motor_comparisons.append({
            "id": nid,
            "cell_type": m["cell_type"],
            "body_part_effector": m["body_part_effector"],
            "neuromere": m["neuromere"],
            "side": m["side"],
            "baseline_rate_hz": b_rate,
            "stimulated_rate_hz": s_rate,
            "delta_rate_hz": delta
        })
    motor_comparisons.sort(key=lambda x: x["delta_rate_hz"], reverse=True)

    payload = {
        "experiment_name": f"BANC Sensorimotor Simulation - {circuit['circuit_name']}",
        "circuit_id": circuit["circuit_id"],
        "circuit_metadata": {
            "name": circuit["circuit_name"],
            "total_neurons": circuit["stats"]["total_neurons"],
            "total_edges": circuit["stats"]["total_edges"],
            "total_synapses": circuit["stats"]["total_synapses"],
            "stimulated_neurons_count": circuit["stats"]["stimulated_neurons_count"],
            "motor_neurons_count": circuit["stats"]["motor_neurons_count"],
            "interneurons_count": circuit["stats"]["interneurons_count"],
            "provenance": circuit["provenance"]
        },
        "simulation_parameters": {
            "v_0_mV": DEFAULT_PHYSIOLOGY_PARAMS["v_0"],
            "v_rst_mV": DEFAULT_PHYSIOLOGY_PARAMS["v_rst"],
            "v_th_mV": DEFAULT_PHYSIOLOGY_PARAMS["v_th"],
            "t_mbr_ms": DEFAULT_PHYSIOLOGY_PARAMS["t_mbr"],
            "tau_syn_ms": DEFAULT_PHYSIOLOGY_PARAMS["tau_syn"],
            "t_rfc_ms": DEFAULT_PHYSIOLOGY_PARAMS["t_rfc"],
            "t_dly_ms": DEFAULT_PHYSIOLOGY_PARAMS["t_dly"],
            "w_syn_mV": DEFAULT_PHYSIOLOGY_PARAMS["w_syn"],
            "weight_scale": DEFAULT_PHYSIOLOGY_PARAMS["weight_scale"],
            "seed": seed,
            "dt_ms": DEFAULT_PHYSIOLOGY_PARAMS["dt"],
            "duration_ms": DEFAULT_PHYSIOLOGY_PARAMS["t_run"]
        },
        "results": {
            "baseline_summary": base_res["population_rates_hz"],
            "stimulation_rate_curve": rate_curve,
            "weight_scale_sensitivity": weight_sensitivity,
            "synapse_cutoff_sensitivity": cutoff_sensitivity,
            "top_recruited_motor_neurons": motor_comparisons[:30],
            "total_motor_neurons_recruited": sum(1 for m in motor_comparisons if m["delta_rate_hz"] > 0.0)
        },
        "limitations_and_assumptions": [
            "Physiological recruitment of motor neurons does NOT constitute overt physical movement (flight/walking requires biomechanical muscle, body and sensory feedback loops).",
            "Neurotransmitter predictions (Eckstein et al.) indicate putative transmitter presence, but postsynaptic receptor subtypes (e.g. nicotinic vs muscarinic, GluCl vs AMPA-like) are assumed based on standard insect CNS physiology (Shiu et al. 2024).",
            "Synaptic weights are scaled linearly with anatomical synapse counts (0.35 mV / synapse), reflecting physical contact density rather than measured quantal content.",
            "Truncated network boundary omits upstream sensory inputs and reciprocal feedback from non-modeled regions."
        ]
    }

    report_path = RESULTS_DIR / f"{circuit_type}_experiment_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Experiment complete! Report saved to {report_path}")
    return payload


if __name__ == "__main__":
    gf_results = run_full_banc_evaluation("giant_fiber")
    p9_results = run_full_banc_evaluation("p9")
