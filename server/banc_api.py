"""
BANC Connectome API Server.

Provides REST endpoints for:
- Retrieving biological circuits (Giant Fiber, P9 walking)
- Running Leaky Integrate-and-Fire simulations with user parameters
- Performing stimulation rate sweeps
- Exporting experiment configurations and results
- Serving the interactive web cockpit
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from moscabrain.connectome.banc_circuit import BANCCircuitManager
from moscabrain.connectome.banc_lif_simulator import BANCLIFSimulator, run_comparison_experiment, DEFAULT_PHYSIOLOGY_PARAMS
from moscabrain.connectome.banc_experiment import run_full_banc_evaluation

router = APIRouter(prefix="/api/banc", tags=["banc"])

app = FastAPI(
    title="BANC Drosophila Connectome Simulation API",
    description="Interactive connectome-based simulation platform constrained by BANC v888 data",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


circuit_mgr = BANCCircuitManager()
cached_circuits: Dict[str, Dict[str, Any]] = {}


def get_or_load_circuit(circuit_id: str) -> Dict[str, Any]:
    if circuit_id in cached_circuits:
        return cached_circuits[circuit_id]

    if circuit_id == "giant_fiber":
        c = circuit_mgr.extract_giant_fiber_circuit(synapse_threshold=3)
    elif circuit_id == "p9":
        c = circuit_mgr.extract_p9_circuit(synapse_threshold=5)
    else:
        raise HTTPException(status_code=404, detail=f"Unknown circuit: {circuit_id}")

    cached_circuits[circuit_id] = c
    return c


# Preload default circuit on startup
try:
    get_or_load_circuit("giant_fiber")
    get_or_load_circuit("p9")
except Exception as e:
    print(f"Warning during circuit preload: {e}")


class SimulationRequest(BaseModel):
    circuit_id: str = "giant_fiber"
    stim_rate: float = Field(150.0, ge=0.0, le=500.0, description="Stimulation frequency (Hz) for descending neurons")
    duration_ms: float = Field(500.0, ge=50.0, le=2000.0, description="Trial duration (ms)")
    bg_rate: float = Field(20.0, ge=0.0, le=100.0, description="Background noise Poisson rate (Hz)")
    weight_scale: float = Field(1.5, ge=0.1, le=5.0, description="Synaptic weight scaling factor")
    synapse_cutoff: int = Field(3, ge=1, le=20, description="Minimum synapse threshold")
    seed: int = Field(42, description="Random seed for reproducibility")


@router.get("/circuits")
async def list_circuits():
    """List available BANC biological circuits."""
    return [
        {
            "id": "giant_fiber",
            "name": "Giant Fiber (DNp01) Escape & Jump Circuit",
            "descending_type": "DNp01",
            "motor_targets": "TTMn (jump), DLM (flight), leg rotators",
            "description": "Descending giant fiber circuit mediating rapid escape jump and wing depression in Drosophila.",
            "default_synapse_threshold": 3
        },
        {
            "id": "p9",
            "name": "P9 (DNp09) Forward Locomotor Circuit",
            "descending_type": "DNp09",
            "motor_targets": "Leg flexor and extensor motor neurons (T1, T2, T3)",
            "description": "Descending command neurons promoting forward walking by recruiting thoracic premotor networks.",
            "default_synapse_threshold": 5
        }
    ]


@router.get("/circuit/{circuit_id}")
async def get_circuit_details(circuit_id: str):
    """Retrieve graph topology, biological metadata, and 3D anatomical coordinates for a circuit."""
    c = get_or_load_circuit(circuit_id)
    return c


@router.post("/simulate")
async def simulate(req: SimulationRequest):
    """Execute a Leaky Integrate-and-Fire simulation run."""
    c = get_or_load_circuit(req.circuit_id)

    custom_params = {
        "weight_scale": req.weight_scale,
        "synapse_cutoff": req.synapse_cutoff,
        "bg_rate": req.bg_rate,
        "seed": req.seed
    }

    sim = BANCLIFSimulator(c, params=custom_params)
    results = sim.run_simulation(
        stim_rate=req.stim_rate,
        bg_rate=req.bg_rate,
        t_run=req.duration_ms,
        seed=req.seed
    )

    # Compute baseline reference if stim_rate > 0
    if req.stim_rate > 0:
        base_res = sim.run_simulation(
            stim_rate=0.0,
            bg_rate=req.bg_rate,
            t_run=req.duration_ms,
            seed=req.seed
        )
        base_motor_map = {m["id"]: m["firing_rate_hz"] for m in base_res["motor_outputs"]}
        for m in results["motor_outputs"]:
            m["baseline_rate_hz"] = base_motor_map.get(m["id"], 0.0)
            m["delta_rate_hz"] = round(m["firing_rate_hz"] - m["baseline_rate_hz"], 2)
    else:
        for m in results["motor_outputs"]:
            m["baseline_rate_hz"] = m["firing_rate_hz"]
            m["delta_rate_hz"] = 0.0

    return results


@router.get("/sweep")
async def sweep(
    circuit_id: str = "giant_fiber",
    weight_scale: float = 1.5,
    synapse_cutoff: int = 3,
    seed: int = 42
):
    """Run stimulation rate sweep (0 to 250 Hz) for dose-response curves."""
    c = get_or_load_circuit(circuit_id)
    frequencies = [0.0, 25.0, 50.0, 75.0, 100.0, 150.0, 200.0, 250.0]

    sim = BANCLIFSimulator(c, params={"weight_scale": weight_scale, "synapse_cutoff": synapse_cutoff})

    # Baseline
    base_res = sim.run_simulation(stim_rate=0.0, seed=seed)
    base_m_rate = base_res["population_rates_hz"]["motor_neurons"]

    curve = []
    for f in frequencies:
        res = sim.run_simulation(stim_rate=f, seed=seed)
        curve.append({
            "stim_rate_hz": f,
            "descending_rate_hz": res["population_rates_hz"]["descending_inputs"],
            "vnc_interneuron_rate_hz": res["population_rates_hz"]["vnc_interneurons"],
            "motor_rate_hz": res["population_rates_hz"]["motor_neurons"],
            "motor_delta_from_baseline_hz": round(res["population_rates_hz"]["motor_neurons"] - base_m_rate, 2),
            "total_spikes": res["total_spikes"]
        })

    return {
        "circuit_id": circuit_id,
        "curve": curve,
        "parameters": {
            "weight_scale": weight_scale,
            "synapse_cutoff": synapse_cutoff,
            "seed": seed
        }
    }


@router.get("/export")
async def export_results(circuit_id: str = "giant_fiber"):
    """Export precomputed comprehensive evaluation report as a downloadable JSON."""
    report_file = Path(__file__).resolve().parent.parent / "data" / "banc" / "results" / f"{circuit_id}_experiment_report.json"
    if not report_file.exists():
        payload = run_full_banc_evaluation(circuit_id)
    else:
        with open(report_file, "r", encoding="utf-8") as f:
            payload = json.load(f)

    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": f"attachment; filename=banc_{circuit_id}_experiment.json"}
    )


# Attach router to standalone FastAPI instance
app.include_router(router)


# Serve Static UI files
root_dir = Path(__file__).resolve().parent.parent
banc_ui_dir = root_dir / "web_banc"

if banc_ui_dir.exists():

    app.mount("/static", StaticFiles(directory=str(banc_ui_dir)), name="banc_static")

    @app.get("/")
    async def serve_banc_home():
        return FileResponse(str(banc_ui_dir / "index.html"))

    @app.get("/banc")
    async def serve_banc_alias():
        return FileResponse(str(banc_ui_dir / "index.html"))

    @app.get("/banc_style.css")
    async def serve_banc_css():
        return FileResponse(str(banc_ui_dir / "banc_style.css"), media_type="text/css")

    @app.get("/banc_app.js")
    async def serve_banc_js():
        return FileResponse(str(banc_ui_dir / "banc_app.js"), media_type="application/javascript")


if __name__ == "__main__":
    import uvicorn
    print("Starting BANC Connectome Simulation Web Server on port 8080...")
    uvicorn.run(app, host="127.0.0.1", port=8080, log_level="info")
