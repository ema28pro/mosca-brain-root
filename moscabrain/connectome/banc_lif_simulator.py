"""
BANC Leaky Integrate-and-Fire (LIF) Computational Simulator.

Constrained by female Drosophila connectome data (BANC v888).
Draws on the bio-realistic LIF equations and parameters from Shiu et al. (Nature 2024):
- Membrane potential decay: dv/dt = (v_0 - v + g) / t_mbr
- Synaptic conductance decay: dg/dt = -g / tau_syn
- Synaptic delay ring-buffer (t_dly = 1.8 ms)
- Absolute refractory period (t_rfc = 2.2 ms)
- Neurotransmitter signed weights (Acetylcholine = +1, GABA = -1, Glutamate = -1 in Drosophila CNS)
- Configurable background Poisson drive and stimulation protocol
"""

import numpy as np
import time
from typing import Dict, List, Optional, Any, Tuple


DEFAULT_PHYSIOLOGY_PARAMS = {
    # Biophysical potentials (mV)
    "v_0": -52.0,            # Resting membrane potential (Kakaria & de Bivort 2017)
    "v_rst": -52.0,          # Post-spike reset potential
    "v_th": -45.0,           # Action potential threshold

    # Time constants (ms)
    "t_mbr": 20.0,           # Membrane time constant (R_m * C_m)
    "tau_syn": 5.0,          # Synaptic conductance decay time constant (Jurgensen et al.)
    "t_rfc": 2.2,            # Absolute refractory period (Lazar et al.)
    "t_dly": 1.8,            # Conduction and synaptic transmission delay (Paul et al.)

    # Synaptic scale (mV per synapse)
    "w_syn": 0.35,           # Baseline weight per physical synapse count
    "weight_scale": 1.5,     # Global multiplier for sensitivity analyses
    "synapse_cutoff": 3,     # Minimum synapse count to include an edge

    # Neurotransmitter effect signs in Drosophila CNS
    "nt_mapping": {
        "acetylcholine": 1.0,    # Excitatory (nicotinic AChRs)
        "gaba": -1.0,            # Inhibitory (Rdl ionotropic chloride channels)
        "glutamate": -1.0,       # Inhibitory in Drosophila CNS (GluCl-alpha chloride channels)
        "histamine": -1.0,       # Inhibitory (HisCl histamine-gated chloride channels)
        "dopamine": 0.0,         # Modulatory (slow GPCRs; zero in fast ionotropic LIF)
        "octopamine": 0.0,       # Modulatory
        "serotonin": 0.0,        # Modulatory
        "tyramine": 0.0,         # Modulatory
        "unknown": 0.0           # Default fallback for missing or low-confidence calls
    },

    # Simulation setup
    "dt": 0.2,               # Time step (ms) = 0.0002 s
    "t_run": 500.0,          # Trial duration (ms)

    # Stimulation and noise
    "stim_rate": 150.0,      # Poisson rate on stimulated descending neurons (Hz)
    "stim_scale": 45.0,      # Injected EPSP amplitude (mV) driving descending inputs (Shiu f_poi style)
    "bg_rate": 20.0,         # Background Poisson noise rate on all neurons (Hz)
    "bg_scale": 2.5,         # Background EPSP amplitude (mV) per noise event
    "seed": 42               # Deterministic seed for reproducibility
}


class BANCLIFSimulator:
    """
    High-performance, transparent vectorized LIF simulator for BANC connectome circuits.
    """

    def __init__(self, circuit_data: Dict[str, Any], params: Optional[Dict[str, Any]] = None):
        self.circuit_data = circuit_data
        self.params = dict(DEFAULT_PHYSIOLOGY_PARAMS)
        if params:
            self.params.update(params)

        self.nodes = circuit_data["nodes"]
        self.edges = circuit_data["edges"]
        self.num_neurons = len(self.nodes)

        # Index mappings
        self.id_to_idx: Dict[str, int] = {node["id"]: i for i, node in enumerate(self.nodes)}
        self.idx_to_id: Dict[int, str] = {i: node["id"] for i, node in enumerate(self.nodes)}

        # Identify stimulated descending neurons and motor neurons
        self.stim_indices = [
            i for i, n in enumerate(self.nodes) if n.get("is_stimulated_input", False)
        ]
        self.motor_indices = [
            i for i, n in enumerate(self.nodes) if n.get("is_motor_output", False)
        ]
        self.interneuron_indices = [
            i for i in range(self.num_neurons)
            if i not in self.stim_indices and i not in self.motor_indices
        ]

        self.W = self._build_weight_matrix()

    def _build_weight_matrix(self) -> np.ndarray:
        """Construct the signed weight matrix W[post, pre] based on BANC synapse counts and NT rules."""
        W = np.zeros((self.num_neurons, self.num_neurons), dtype=np.float32)
        nt_rules = self.params.get("nt_mapping", DEFAULT_PHYSIOLOGY_PARAMS["nt_mapping"])
        base_w_syn = float(self.params.get("w_syn", 0.275))
        weight_scale = float(self.params.get("weight_scale", 1.0))
        syn_cutoff = int(self.params.get("synapse_cutoff", 3))

        for edge in self.edges:
            count = edge["count"]
            if count < syn_cutoff:
                continue

            pre_id = edge["pre"]
            post_id = edge["post"]
            if pre_id not in self.id_to_idx or post_id not in self.id_to_idx:
                continue

            pre_idx = self.id_to_idx[pre_id]
            post_idx = self.id_to_idx[post_id]

            # Transmitter sign from presynaptic neuron
            pre_nt = self.nodes[pre_idx].get("neurotransmitter", "unknown")
            sign = nt_rules.get(pre_nt, 0.0)

            # Weight = sign * count * w_syn * weight_scale
            weight_val = sign * count * base_w_syn * weight_scale
            W[post_idx, pre_idx] += weight_val

        return W

    def run_simulation(
        self,
        stim_rate: Optional[float] = None,
        bg_rate: Optional[float] = None,
        t_run: Optional[float] = None,
        seed: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Execute an exact LIF simulation trial.
        Returns spike trains, firing rates, membrane voltage traces, and network health checks.
        """
        start_time = time.time()

        p = self.params
        dt = float(p["dt"])
        duration = float(t_run if t_run is not None else p["t_run"])
        n_steps = int(np.round(duration / dt))

        cur_stim_rate = float(stim_rate if stim_rate is not None else p["stim_rate"])
        cur_bg_rate = float(bg_rate if bg_rate is not None else p["bg_rate"])
        cur_seed = int(seed if seed is not None else p["seed"])

        rng = np.random.RandomState(cur_seed)

        v_0 = float(p["v_0"])
        v_rst = float(p["v_rst"])
        v_th = float(p["v_th"])
        t_mbr = float(p["t_mbr"])
        tau_syn = float(p["tau_syn"])
        t_rfc = float(p["t_rfc"])
        t_dly = float(p["t_dly"])
        stim_scale = float(p["stim_scale"])
        bg_scale = float(p["bg_scale"])

        N = self.num_neurons
        V = np.full(N, v_0, dtype=np.float32)
        G = np.zeros(N, dtype=np.float32)
        rfc_timer = np.zeros(N, dtype=np.float32)

        # Ring buffer for synaptic delay
        delay_steps = max(1, int(np.round(t_dly / dt)))
        delay_buffer = np.zeros((delay_steps, N), dtype=np.float32)
        buffer_idx = 0

        # Poisson stimulus and noise probabilities per step
        p_stim = 1.0 - np.exp(-cur_stim_rate * (dt / 1000.0)) if cur_stim_rate > 0 else 0.0
        p_bg = 1.0 - np.exp(-cur_bg_rate * (dt / 1000.0)) if cur_bg_rate > 0 else 0.0

        # Output recording
        spikes: List[Tuple[float, int]] = []  # (time_ms, neuron_idx)

        # Select representative neurons for voltage tracing (1 DN input, 1 interneuron, 2 motor neurons)
        trace_indices = []
        if self.stim_indices:
            trace_indices.append(self.stim_indices[0])
        if self.interneuron_indices:
            trace_indices.append(self.interneuron_indices[0])
        if self.motor_indices:
            trace_indices.extend(self.motor_indices[:2])

        voltage_traces: Dict[str, List[float]] = {self.idx_to_id[i]: [] for i in trace_indices}
        trace_times: List[float] = []

        # Numerical stability flags
        has_nan = False
        spike_count_per_neuron = np.zeros(N, dtype=np.int32)

        # Euler / exact step constants
        leak_factor = dt / t_mbr
        syn_decay_factor = dt / tau_syn

        for step in range(n_steps):
            current_time = step * dt

            # 1. Deliver delayed synaptic inputs from the ring buffer
            synaptic_inflow = delay_buffer[buffer_idx]
            G += synaptic_inflow
            delay_buffer[buffer_idx] = 0.0  # reset slot

            # 2. Add Poisson stimulation to descending neurons
            if p_stim > 0 and len(self.stim_indices) > 0:
                stim_mask = rng.rand(len(self.stim_indices)) < p_stim
                for k, active in enumerate(stim_mask):
                    if active:
                        idx = self.stim_indices[k]
                        G[idx] += stim_scale

            # 3. Add background noise Poisson drive across all neurons
            if p_bg > 0:
                bg_mask = rng.rand(N) < p_bg
                G[bg_mask] += bg_scale

            # 4. Integrate LIF membrane dynamics
            active_mask = (rfc_timer <= 0)
            V[active_mask] += leak_factor * (v_0 - V[active_mask] + G[active_mask])
            G += -syn_decay_factor * G

            # Clamp refractory neurons to reset
            V[~active_mask] = v_rst
            rfc_timer[~active_mask] = np.maximum(0.0, rfc_timer[~active_mask] - dt)

            # Check for NaN / instability
            if np.isnan(V).any() or np.isinf(V).any():
                has_nan = True
                break

            # 5. Threshold detection and spike emission
            spike_mask = active_mask & (V >= v_th)
            spiking_neurons = np.where(spike_mask)[0]

            if len(spiking_neurons) > 0:
                for s_idx in spiking_neurons:
                    spikes.append((round(current_time, 2), int(s_idx)))
                    spike_count_per_neuron[s_idx] += 1
                    V[s_idx] = v_rst
                    rfc_timer[s_idx] = t_rfc

                # Route post-synaptic changes into the future delay ring buffer slot
                # W has shape [post, pre]
                delta_g = self.W[:, spiking_neurons].sum(axis=1)
                target_slot = (buffer_idx + delay_steps - 1) % delay_steps
                delay_buffer[target_slot] += delta_g

            # Record voltage traces every 1 ms (downsampled for efficiency)
            if step % max(1, int(1.0 / dt)) == 0:
                trace_times.append(round(current_time, 1))
                for tidx in trace_indices:
                    voltage_traces[self.idx_to_id[tidx]].append(round(float(V[tidx]), 2))

            # Advance ring buffer
            buffer_idx = (buffer_idx + 1) % delay_steps

        # Compute firing rates in Hz
        duration_s = duration / 1000.0
        firing_rates_hz = spike_count_per_neuron / duration_s

        # Classification rates
        stim_rate_mean = float(np.mean(firing_rates_hz[self.stim_indices])) if self.stim_indices else 0.0
        interneuron_rate_mean = float(np.mean(firing_rates_hz[self.interneuron_indices])) if self.interneuron_indices else 0.0
        motor_rate_mean = float(np.mean(firing_rates_hz[self.motor_indices])) if self.motor_indices else 0.0
        network_rate_mean = float(np.mean(firing_rates_hz))

        # Health checks
        is_silent = (len(spikes) == 0)
        is_runaway = (network_rate_mean > 350.0 or np.max(firing_rates_hz) > 500.0)
        status = "healthy"
        if has_nan:
            status = "numerical_instability"
        elif is_runaway:
            status = "runaway_excitation"
        elif is_silent:
            status = "silent_network"

        # Motor neuron details sorted by firing rate
        motor_details = []
        for midx in self.motor_indices:
            nid = self.idx_to_id[midx]
            node = self.nodes[midx]
            motor_details.append({
                "id": nid,
                "cell_type": node.get("cell_type", ""),
                "body_part_effector": node.get("body_part_effector", ""),
                "neuromere": node.get("neuromere", ""),
                "side": node.get("side", ""),
                "firing_rate_hz": round(float(firing_rates_hz[midx]), 2),
                "spike_count": int(spike_count_per_neuron[midx])
            })
        motor_details.sort(key=lambda x: x["firing_rate_hz"], reverse=True)

        # Format spikes for frontend visualization
        formatted_spikes = [
            {
                "t": t,
                "neuron_idx": idx,
                "neuron_id": self.idx_to_id[idx],
                "cell_type": self.nodes[idx].get("cell_type", ""),
                "super_class": self.nodes[idx].get("super_class", "")
            }
            for t, idx in spikes
        ]

        compute_ms = round((time.time() - start_time) * 1000.0, 1)

        return {
            "circuit_id": self.circuit_data.get("circuit_id", "unknown"),
            "circuit_name": self.circuit_data.get("circuit_name", ""),
            "duration_ms": duration,
            "dt_ms": dt,
            "seed": cur_seed,
            "stim_rate_applied_hz": cur_stim_rate,
            "bg_rate_applied_hz": cur_bg_rate,
            "total_spikes": len(spikes),
            "compute_time_ms": compute_ms,
            "network_status": status,
            "population_rates_hz": {
                "descending_inputs": round(stim_rate_mean, 2),
                "vnc_interneurons": round(interneuron_rate_mean, 2),
                "motor_neurons": round(motor_rate_mean, 2),
                "network_overall": round(network_rate_mean, 2)
            },
            "spikes": formatted_spikes,
            "traces": {
                "times": trace_times,
                "voltages": voltage_traces
            },
            "motor_outputs": motor_details,
            "assumptions_summary": {
                "membrane_time_constant_ms": t_mbr,
                "synaptic_time_constant_ms": tau_syn,
                "synaptic_delay_ms": t_dly,
                "refractory_period_ms": t_rfc,
                "weight_per_synapse_mV": p["w_syn"],
                "weight_scale_multiplier": p["weight_scale"],
                "synapse_cutoff": p["synapse_cutoff"],
                "neurotransmitter_effects": p["nt_mapping"]
            }
        }


def run_comparison_experiment(
    circuit_data: Dict[str, Any],
    stim_frequencies: List[float] = [0.0, 50.0, 100.0, 150.0, 250.0],
    seed: int = 42
) -> Dict[str, Any]:
    """
    Runs a controlled experiment comparing unstimulated baseline with multiple stimulation rates.
    Measures spike timing, motor neuron recruitment, and response curves.
    """
    sim = BANCLIFSimulator(circuit_data)

    # 1. Unstimulated baseline (0 Hz)
    baseline_res = sim.run_simulation(stim_rate=0.0, seed=seed)

    # 2. Stimulation runs across frequencies
    freq_results = {}
    for f in stim_frequencies:
        res = sim.run_simulation(stim_rate=f, seed=seed)
        freq_results[str(int(f))] = {
            "stim_rate_hz": f,
            "descending_rate_hz": res["population_rates_hz"]["descending_inputs"],
            "vnc_interneuron_rate_hz": res["population_rates_hz"]["vnc_interneurons"],
            "motor_rate_hz": res["population_rates_hz"]["motor_neurons"],
            "total_spikes": res["total_spikes"],
            "motor_delta_from_baseline_hz": round(
                res["population_rates_hz"]["motor_neurons"] - baseline_res["population_rates_hz"]["motor_neurons"],
                2
            )
        }

    # 3. Target motor neuron response contrast (Baseline vs 150 Hz)
    stim_150_res = sim.run_simulation(stim_rate=150.0, seed=seed)
    baseline_motor_map = {m["id"]: m["firing_rate_hz"] for m in baseline_res["motor_outputs"]}

    contrast_motor = []
    for m in stim_150_res["motor_outputs"]:
        nid = m["id"]
        base_rate = baseline_motor_map.get(nid, 0.0)
        stim_rate = m["firing_rate_hz"]
        delta = round(stim_rate - base_rate, 2)
        contrast_motor.append({
            "id": nid,
            "cell_type": m["cell_type"],
            "body_part_effector": m["body_part_effector"],
            "neuromere": m["neuromere"],
            "baseline_rate_hz": base_rate,
            "stimulated_rate_hz": stim_rate,
            "delta_rate_hz": delta
        })
    contrast_motor.sort(key=lambda x: x["delta_rate_hz"], reverse=True)

    return {
        "circuit_name": circuit_data.get("circuit_name", ""),
        "seed": seed,
        "baseline_summary": baseline_res["population_rates_hz"],
        "frequency_response_curve": freq_results,
        "motor_contrast_150hz": contrast_motor[:25],
        "active_motor_neurons_recruited": sum(1 for c in contrast_motor if c["delta_rate_hz"] > 0.5),
        "total_motor_neurons": len(contrast_motor)
    }


if __name__ == "__main__":
    from moscabrain.connectome.banc_circuit import BANCCircuitManager
    mgr = BANCCircuitManager()
    gf_circuit = mgr.extract_giant_fiber_circuit()

    print("Running baseline vs stimulation experiment on Giant Fiber circuit...")
    exp = run_comparison_experiment(gf_circuit)
    print("Baseline:", exp["baseline_summary"])
    print("Frequency response curve:")
    for f, v in exp["frequency_response_curve"].items():
        print(f"  Stim {f} Hz -> Motor Rate: {v['motor_rate_hz']} Hz (Delta: +{v['motor_delta_from_baseline_hz']} Hz)")
    print(f"\nMotor neurons recruited above baseline: {exp['active_motor_neurons_recruited']} / {exp['total_motor_neurons']}")
    print("Top recruited motor neurons:")
    for m in exp["motor_contrast_150hz"][:5]:
        print(f"  {m['cell_type']} ({m['body_part_effector']}, {m['neuromere']}): Base={m['baseline_rate_hz']}Hz, Stim={m['stimulated_rate_hz']}Hz (Delta=+{m['delta_rate_hz']}Hz)")
