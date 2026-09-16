# BANC Whole-CNS Connectome Simulation Guide

## Overview

This module delivers a biologically grounded, reproducible Leaky Integrate-and-Fire (LIF) computational simulation constrained by **BANC (Brain and Nerve Cord)**—the first complete synapse-resolution connectome spanning both the brain and the ventral nerve cord (VNC) of an adult female *Drosophila melanogaster*.

Unlike brain-only connectomes (such as FAFB / FlyWire v783), where descending axons terminate at the cervical connective without motor targets, BANC allows stimulating identified descending command neurons in the brain, propagating synaptic currents through thoracic premotor networks, and measuring action potentials in **identified motor neurons** innervating the legs and wings.

---

## 1. Repositorios de Datos, Código y Artículos Científicos (Landmark Papers)

### A. Dataset y Herramientas BANC (Brain and Nerve Cord)
- 📄 **Artículo Científico (Paper):**  
  **Bates, A. S., Phelps, J. S., Kim, M., Yang, H. H. et al. (2026)**  
  *The connectome of an adult Drosophila brain and nerve cord*.  
  **Nature**. DOI: [10.1038/s41586-026-10735-w](https://doi.org/10.1038/s41586-026-10735-w) | Enlace directo: [Nature Article](https://www.nature.com/articles/s41586-026-10735-w)
- 📦 **Repositorio del Tutorial y Esquema de Datos:**  
  [https://github.com/sjcabs/fly_connectome_data_tutorial](https://github.com/sjcabs/fly_connectome_data_tutorial)  
  *Documentación del dataset BANC:* [banc_data.md](https://github.com/sjcabs/fly_connectome_data_tutorial/blob/main/data/dataset_documentation/banc_data.md)
- 🐍 **Repositorio de Herramientas Python para BANC:**  
  [https://github.com/jasper-tms/the-BANC-fly-connectome](https://github.com/jasper-tms/the-BANC-fly-connectome)
- 📊 **Herramientas R y Acceso Público (bancr / natverse):**  
  [https://natverse.org/bancr/](https://natverse.org/bancr/)
- 🌐 **Explorador Interactivo:**  
  [FlyWire Codex](https://codex.flywire.ai/)
- 🗄️ **Almacenamiento Público Google Cloud Storage:**  
  `gs://lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888/`  
  HTTP: `https://storage.googleapis.com/lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888/`

---

### B. Modelo de Simulación Biofísica LIF (Precedente Shiu et al.)
- 📄 **Artículo Científico (Paper):**  
  **Shiu, P. K., Stern, D. L., Hermundstad, A. M. et al. (2024)**  
  *A leaky integrate-and-fire computational model based on the connectome of the entire adult Drosophila brain reveals insights into sensorimotor processing*.  
  **Nature**, 634, 153–161. DOI: [10.1038/s41586-024-07763-9](https://doi.org/10.1038/s41586-024-07763-9) | Enlace directo: [Nature Article](https://www.nature.com/articles/s41586-024-07763-9)
- 📦 **Repositorio del Modelo de Simulación Original (Phil Shiu):**  
  [https://github.com/philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model)
- ⚙️ **Repositorio de Emulación Multi-Backend (Eon Systems):**  
  [https://github.com/eonsystemspbc/fly-brain](https://github.com/eonsystemspbc/fly-brain) *(también integrado localmente en este workspace dentro de `eons_fly_brain/`)*

---

## 2. Data Provenance and Materialization (BANC v888)

- **Materialization Snapshot:** CAVE materialization **888** (snapshot 2026-04-16)
- **Scale:** 188,508 neurons | 13.62 million synaptic connections (v3 edgelist)
- **Cached Files:**
  - `data/banc/banc_888_meta.feather` (57.5 MB): Full metadata, neurotransmitter predictions, neuromere, laterality, and nanometer soma coordinates.
  - `data/banc/banc_888_edgelist_simple_v3.feather` (359.2 MB): Simple edgelist with pre/post root IDs and connection counts.
- **ID Integrity:** All 64-bit root IDs (`banc_888_id`) are preserved losslessly as strings across Python, JSON, and JavaScript interfaces to prevent integer overflow.

---

## 2. Selected Biological Circuits

Two biologically characterized circuits are available for interactive exploration:

### Circuit 1: Giant Fiber (DNp01) Escape & Jump Circuit (Default)
- **Stimulated Input:** Giant Fiber bilateral pair (DNp01 Left: `720575941509145950`, Right: `720575941451068597`).
- **Intermediate Circuit:** 27 thoracic VNC interneurons (including peripherally synapsing interneurons, PSI) and 6 ascending feedback neurons.
- **Identified Motor Targets:** 151–210 identified motor neurons, notably:
  - `tergotrochanter_extensor_TT` (TTMn): Middle-leg jump motor neuron that drives the escape jump.
  - `DLM1-4`, `DLM5`: Dorsal longitudinal flight muscle motor neurons that initiate wing depression.
  - Thoracic sternal rotator and flexor motor units.
- **Topology:** 263 neurons, 1,112 directed synaptic connections (at cutoff $\ge 3$).

### Circuit 2: P9 (DNp09) Forward Locomotor Walking Circuit
- **Stimulated Input:** P9 bilateral pair (`720575941566493282`, `720575941433155799`).
- **Intermediate Circuit:** Thoracic premotor interneurons in neuromeres T1, T2, T3.
- **Identified Motor Targets:** 301 leg motor neurons (`tibia_flexor`, `accessory_tibia_flexor`, `long_tendon_muscle`, `trochanter_extensor`).

---

## 3. Biophysical Model & Physiological Assumptions

The simulation draws on the validated Leaky Integrate-and-Fire (LIF) framework of **Shiu et al. (Nature 2024)**:

### Membrane & Synapse Equations
$$\frac{dv_i}{dt} = \frac{v_0 - v_i + g_i}{\tau_m} \quad (\text{unless refractory})$$
$$\frac{dg_i}{dt} = -\frac{g_i}{\tau_{syn}} \quad (\text{unless refractory})$$

- **Resting Membrane Potential ($v_0$):** $-52.0\text{ mV}$ (Kakaria & de Bivort 2017)
- **Action Potential Threshold ($v_{th}$):** $-45.0\text{ mV}$
- **Reset Potential ($v_{rst}$):** $-52.0\text{ mV}$
- **Membrane Time Constant ($\tau_m$):** $20.0\text{ ms}$ ($R_m \cdot C_m$)
- **Synaptic Conductance Decay ($\tau_{syn}$):** $5.0\text{ ms}$ (Jürgensen et al.)
- **Absolute Refractory Period ($t_{rfc}$):** $2.2\text{ ms}$ (Lazar et al.)
- **Conduction & Synaptic Delay ($t_{delay}$):** $1.8\text{ ms}$ (implemented via an integer ring buffer)
- **Baseline Synaptic Weight ($w_{syn}$):** $0.35\text{ mV}$ per anatomical synapse count (modulated by configurable scale).

### Neurotransmitter Effect Mapping
- **Acetylcholine:** Excitatory ($+1.0$) via nicotinic acetylcholine receptors (nAChRs).
- **GABA:** Inhibitory ($-1.0$) via Rdl ionotropic chloride channels.
- **Glutamate:** Inhibitory ($-1.0$) in the *Drosophila* central nervous system via GluCl-$\alpha$ chloride channels.
- **Histamine:** Inhibitory ($-1.0$) via HisCl channels.
- **Dopamine, Octopamine, Serotonin:** Modulatory ($0.0$ in fast ionotropic LIF; configurable).
- **Unknown / Unassigned:** $0.0$ (neutral).

---

## 4. Verification and Experimental Findings

Reproducible evaluations (`moscabrain/connectome/banc_experiment.py`) establish:

1. **Unstimulated Baseline:** With $0\text{ Hz}$ descending input and $20\text{ Hz}$ background noise, spontaneous motor firing rate is $0.0\text{ Hz}$ (quiescent, realistic in vivo baseline).
2. **Progressive Recruitment:**
   - At $50\text{ Hz}$ DN stimulation: Subthreshold depolarization; $0.05\text{ Hz}$ motor response.
   - At $100\text{ Hz}$ DN stimulation: Firing onset; $0.5\text{ Hz}$ motor rate.
   - At $150\text{ Hz}$ DN stimulation: Robust recruitment; $1.12\text{ Hz}$ population motor rate, selectively recruiting flight muscle motor neurons (`DLM1-4`, $26\text{ Hz}$) and jump motor neurons (`TTMn`).
   - At $250\text{ Hz}$ DN stimulation: Peak physiological recruitment ($2.52\text{ Hz}$ population rate).
3. **Stability:** No runaway epileptiform bursts ($< 350\text{ Hz}$) or numerical instability ($\text{NaN}/\text{Inf}$) observed across all parameter sweeps.

---

## 5. Explicit Limitations & Non-claims

> [!CAUTION]
> **Important Non-claim:** Action potentials recorded from motor neurons represent **physiological synaptic recruitment**. They do **not** constitute physical movement (walking or flying). Overt locomotion requires muscle contraction dynamics, skeletal biomechanics, and proprioceptive sensory feedback loops.

- Synapse counts reflect physical contact frequency from automated EM detection, not physiological quantal content.
- Truncated subcircuit boundaries necessarily omit upstream brain sensory networks and long-range modulatory inputs.

---

## 6. How to Run the Interactive Local Preview

### Quickstart

1. Start the server (port 8000):
   ```bash
   python -m uvicorn server.app:app --reload --port 8000
   ```
   *(Alternatively, run standalone: `python -m uvicorn server.banc_api:app --reload --port 8000`)*

2. Open in your browser:
   ```
   http://127.0.0.1:8000/banc/
   ```

3. Explore:
   - Toggle between **Schematic Flow** and **Anatomical 3D (EM nm)** layouts.
   - Adjust the **Stimulation Rate** slider ($0 - 300\text{ Hz}$).
   - Click **Run Simulation** to inspect the live **Spike Raster** and **Membrane Potential Traces ($V_m$)**.
   - Review recruited motor neurons in the **Motor Recruitment Table**.
   - Click **Dose-Response Sweep** to visualize recruitment curves across stimulation strengths.
   - Click **Export JSON** to download complete experiment settings and results.
