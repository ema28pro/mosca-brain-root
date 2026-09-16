"""
MoscaBrain Tetris Server: Servidor dedicado para control en tiempo real de Tetris.
Ejecuta el conectoma biológico real de FlyWire (138.639 neuronas y 15.091.983 sinapsis)
en un proceso y puerto independiente (8001) para garantizar aislamiento y mínima latencia.
"""

import asyncio
import time
from typing import Dict, List, Optional
import numpy as np

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

import os
from moscabrain import FlyAgent, FlyWireAgent, BANCAgent

app = FastAPI(title="MoscaBrain Tetris Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modo de agente configurable por variable de entorno: AGENT_MODE=banc (predeterminado) o AGENT_MODE=flywire_brain
INITIAL_MODE = os.environ.get("AGENT_MODE", "banc")
fly = FlyAgent(connectome_mode=INITIAL_MODE)




class AgentModeRequest(BaseModel):
    mode: str  # "flywire_brain" o "banc"


class StepRequest(BaseModel):
    left_eye: Optional[List[float]] = None
    right_eye: Optional[List[float]] = None
    piece_type: Optional[str] = None
    odor_glomeruli: Optional[List[float]] = None
    substeps: int = 1
    olfaction_enabled: bool = True


class DopamineTriggerRequest(BaseModel):
    amount: float = 1.0
    reason: str = "tetris_event"


@app.get("/api/agent/mode")
async def get_agent_mode():
    """Consulta el agente activo (FlyWire Cerebro vs BANC Whole-CNS)."""
    return {
        "current_mode": getattr(fly, "connectome_mode", "flywire_brain"),
        "available_modes": ["flywire_brain", "banc"]
    }


@app.post("/api/agent/mode")
async def set_agent_mode(req: AgentModeRequest):
    """Cambia el agente activo de Tetris en caliente."""
    global fly
    if req.mode == "banc":
        fly = BANCAgent(circuit_id="p9")
    elif req.mode == "flywire_brain":
        fly = FlyWireAgent()
    else:
        raise HTTPException(status_code=400, detail=f"Modo inválido: {req.mode}. Use 'banc' o 'flywire_brain'.")
    return {"success": True, "mode": fly.connectome_mode}


@app.get("/api/status")
async def get_status():
    """Retorna el estado de conexión y métricas biológicas del conectoma de Tetris."""
    is_banc = getattr(fly, "connectome_mode", "flywire_brain") == "banc"
    return {
        "status": "online",
        "service": "MoscaBrain Tetris Engine",
        "port": 8001,
        "mode": fly.connectome_mode,
        "neurons_count": len(fly.circuit["nodes"]) if is_banc else fly.topology.total_neurons,
        "synapses_count": len(fly.circuit["edges"]) if is_banc else fly.topology.total_synapses,
        "dopamine_level": round(float(getattr(fly, "dopamine_level", getattr(getattr(fly, "dopamine", None), "current_level", 0.0))), 3),
        "total_rewards": round(float(getattr(getattr(fly, "dopamine", None), "total_rewards", 0.0)), 2),
        "total_punishments": round(float(getattr(getattr(fly, "dopamine", None), "total_punishments", 0.0)), 2),
        "last_spikes": int(fly.banc_telemetry.get("total_spikes", 0)) if is_banc else int(np.count_nonzero(fly.engine.spikes)),
    }



@app.post("/api/reward")
async def trigger_reward(req: DopamineTriggerRequest):
    fly.reward(amount=req.amount, reason=req.reason)
    return {
        "success": True,
        "type": "REWARD_PAM",
        "dopamine_level": round(float(fly.dopamine.current_level), 3),
        "total_rewards": round(float(fly.dopamine.total_rewards), 2),
        "total_punishments": round(float(fly.dopamine.total_punishments), 2),
    }


@app.post("/api/punish")
async def trigger_punish(req: DopamineTriggerRequest):
    fly.punish(amount=req.amount, reason=req.reason)
    return {
        "success": True,
        "type": "PUNISH_PPL1",
        "dopamine_level": round(float(fly.dopamine.current_level), 3),
        "total_rewards": round(float(fly.dopamine.total_rewards), 2),
        "total_punishments": round(float(fly.dopamine.total_punishments), 2),
    }


@app.post("/api/aversion")
async def trigger_aversion(req: DopamineTriggerRequest):
    fly.aversion(amount=req.amount, reason=req.reason)
    return {
        "success": True,
        "type": "PUNISH_PPL1",
        "dopamine_level": round(float(fly.dopamine.current_level), 3),
        "total_rewards": round(float(fly.dopamine.total_rewards), 2),
        "total_punishments": round(float(fly.dopamine.total_punishments), 2),
    }


def _process_neural_step(
    left_eye: Optional[List[float]] = None,
    right_eye: Optional[List[float]] = None,
    piece_type: Optional[str] = None,
    odor_glomeruli: Optional[List[float]] = None,
    substeps: int = 1,
    olfaction_enabled: bool = True,
) -> dict:
    """Ejecuta la inferencia biofísica sobre el conectoma real (FlyWire o BANC)."""
    t0 = time.perf_counter()

    if getattr(fly, "connectome_mode", "flywire_brain") == "banc":
        l_arr = np.asarray(left_eye, dtype=np.float32) if left_eye else np.zeros(120, dtype=np.float32)
        r_arr = np.asarray(right_eye, dtype=np.float32) if right_eye else np.zeros(120, dtype=np.float32)
        mean_l = float(np.mean(l_arr)) if len(l_arr) else 0.0
        mean_r = float(np.mean(r_arr)) if len(r_arr) else 0.0

        has_threat = (mean_l > 0.3 or mean_r > 0.3)
        threats = [{"x": 300.0, "y": 300.0, "speed": 10.0}] if has_threat else []
        fwd_drive = (mean_l + mean_r) * 60.0

        action = fly.step(threats=threats, forward_drive_hz=fwd_drive, trial_duration_ms=40.0)

        m_rate = fly.banc_telemetry.get("motor_rate_hz", 0.0)
        jump_active = fly.banc_telemetry.get("jump_motor_active", False)

        score_left = max(0.01, mean_l * 4.0)
        score_right = max(0.01, mean_r * 4.0)
        score_rot = max(0.01, 3.5 if jump_active else 0.2)
        score_drop = max(0.01, min(3.0, m_rate * 0.5))

        scores = np.array([score_left, score_right, score_rot, score_drop], dtype=np.float32)
        exp_scores = np.exp(scores - np.max(scores))
        probs = (exp_scores / np.sum(exp_scores)).tolist()
        act_idx = int(np.argmax(probs))

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return {
            "type": "tetris_motor",
            "mode": "banc",
            "action": act_idx,
            "probabilities": [round(float(p), 4) for p in probs],
            "p9_left": round(float(probs[0]), 3),
            "p9_right": round(float(probs[1]), 3),
            "rot": round(float(probs[2]), 3),
            "drop": round(float(probs[3]), 3),
            "fwd": round(float(action.forward_thrust), 3),
            "yaw": round(float(action.turn_yaw), 3),
            "escape": bool(action.escape_jump),
            "aversive_arousal": 0.0,
            "ppl1_act": 0.0,
            "avoid_act": 0.0,
            "spikes_count": int(fly.banc_telemetry.get("total_spikes", 0)),
            "dopamine_level": round(float(getattr(fly, "dopamine_level", 0.0)), 3),
            "compute_ms": elapsed_ms,
        }

    # Inferencia con Cerebro FlyWire
    # 1. Inyectar omatidios hexagonales de ambos ojos en el lóbulo óptico
    l_arr = np.asarray(left_eye, dtype=np.float32) if left_eye else np.zeros(120, dtype=np.float32)
    r_arr = np.asarray(right_eye, dtype=np.float32) if right_eye else np.zeros(120, dtype=np.float32)
    fly.engine.inject_optic_input(l_arr, r_arr)


    # 2. Inyectar quimiorrecepción olfativa de la pieza (si está activada)
    if olfaction_enabled:
        if odor_glomeruli and any(v > 0.01 for v in odor_glomeruli):
            g_arr = np.asarray(odor_glomeruli, dtype=np.float32)
            mean_g = float(np.mean(g_arr)) if len(g_arr) else 0.5
            fly.engine.inject_olfactory_input(g_arr, mean_g, mean_g)
        elif piece_type:
            fly.olfaction.expose_odor(piece_type)
            act = fly.olfaction.get_activity_vector()
            fly.engine.inject_olfactory_input(act, 0.5, 0.5)

    # 3. Propagar espigas a través de las 15M sinapsis biológicas
    num_steps = max(1, min(int(substeps), 4))
    for _ in range(num_steps):
        fly.engine.step()

    # 4. Decodificar las neuronas descendentes motoras reales
    fwd, yaw, escape = fly.engine.get_motor_output()

    p9_l = float(fly.engine.firing_rates[fly.topology.p9_left_idx])
    p9_r = float(fly.engine.firing_rates[fly.topology.p9_right_idx])

    dna_l = (
        float(np.mean(fly.engine.firing_rates[fly.topology.dna_left_indices]))
        if len(fly.topology.dna_left_indices) > 0
        else 0.0
    )
    dna_r = (
        float(np.mean(fly.engine.firing_rates[fly.topology.dna_right_indices]))
        if len(fly.topology.dna_right_indices) > 0
        else 0.0
    )

    gf_act = (
        float(np.mean(fly.engine.firing_rates[fly.topology.giant_fiber_indices]))
        if len(fly.topology.giant_fiber_indices) > 0
        else 0.0
    )

    ppl1_indices = getattr(fly.topology, 'ppl1_dopamine_indices', np.array([], dtype=np.int32))
    ppl1_act = float(np.mean(fly.engine.firing_rates[ppl1_indices])) if len(ppl1_indices) > 0 else 0.0

    avoid_indices = getattr(fly.topology, 'mbon_avoid_indices', np.array([], dtype=np.int32))
    avoid_act = float(np.mean(fly.engine.firing_rates[avoid_indices])) if len(avoid_indices) > 0 else 0.0

    arousal = float(getattr(fly.engine, 'aversive_arousal', 0.0))

    # 5. Calcular puntuaciones de activación para cada canal motor de Tetris
    # En estado de alarma/aversión biológica (sobresalto por castigo):
    # - La mosca entra en pánico motor: virajes erráticos y giros convulsivos para huir del peligro
    # - Inhibe fuertemente la caída rápida (Drop): la mosca rehúsa precipitarse
    panic_left = (dna_l * 5.0 + max(0.0, -yaw) * 3.5 + avoid_act * 4.0)
    panic_right = (dna_r * 5.0 + max(0.0, yaw) * 3.5 + avoid_act * 4.0)

    score_left = max(0.01, p9_l * 3.5 + dna_l * 4.0 + max(0.0, -yaw) * 1.5 + (panic_left * arousal * 1.8))
    score_right = max(0.01, p9_r * 3.5 + dna_r * 4.0 + max(0.0, yaw) * 1.5 + (panic_right * arousal * 1.8))
    score_rot = max(0.01, gf_act * 5.0 + (2.5 if escape else 0.0) + abs(yaw) * 2.0 + (arousal * 4.0 + ppl1_act * 5.0))

    # Caída rápida reprimida por la aversión
    drop_inhibition = 1.0 / (1.0 + arousal * 4.0 + avoid_act * 3.0)
    score_drop = max(0.01, (fwd * 3.0 + (p9_l + p9_r) * 1.5) * drop_inhibition)

    scores = np.array([score_left, score_right, score_rot, score_drop], dtype=np.float32)

    # Softmax con temperatura biológica modulada: en aversión la temperatura sube
    # drásticamente, volviendo a la mosca errática, frenética ("loca") e impredecible
    temp = float(np.clip(0.8 + arousal * 1.5, 0.4, 3.2))
    exp_scores = np.exp((scores - np.max(scores)) / temp)
    probs = (exp_scores / np.sum(exp_scores)).tolist()

    # Selección de acción estocástica basada en probabilidades
    r = float(np.random.random())
    accum = 0.0
    action = 3
    for i, p in enumerate(probs):
        accum += p
        if r <= accum:
            action = i
            break

    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    spikes_count = int(np.count_nonzero(fly.engine.spikes))
    da_level = round(float(fly.dopamine.current_level), 3)

    return {
        "type": "tetris_motor",
        "action": int(action),
        "probabilities": [round(float(p), 4) for p in probs],
        "p9_left": round(float(probs[0]), 3),
        "p9_right": round(float(probs[1]), 3),
        "rot": round(float(probs[2]), 3),
        "drop": round(float(probs[3]), 3),
        "fwd": round(float(fwd), 3),
        "yaw": round(float(yaw), 3),
        "escape": bool(escape),
        "aversive_arousal": round(arousal, 3),
        "ppl1_act": round(ppl1_act, 4),
        "avoid_act": round(avoid_act, 4),
        "spikes_count": spikes_count,
        "dopamine_level": da_level,
        "compute_ms": elapsed_ms,
    }


@app.post("/api/step")
async def step_rest(req: StepRequest):
    """Paso síncrono vía REST."""
    return _process_neural_step(
        left_eye=req.left_eye,
        right_eye=req.right_eye,
        piece_type=req.piece_type,
        odor_glomeruli=req.odor_glomeruli,
        substeps=req.substeps,
        olfaction_enabled=req.olfaction_enabled,
    )


@app.websocket("/ws/tetris")
async def tetris_websocket_endpoint(websocket: WebSocket):
    """
    Canal WebSocket full-duplex de baja latencia para el control de Tetris.
    Permite streaming bidireccional continuo de omatidios y acciones motoras.
    """
    await websocket.accept()
    try:
        # Enviar confirmación inicial de conexión
        await websocket.send_json({
            "type": "connected",
            "message": "MoscaBrain Tetris Connectome Ready",
            "neurons": fly.topology.total_neurons,
            "synapses": fly.topology.total_synapses,
            "dopamine": round(float(fly.dopamine.current_level), 3),
        })

        while True:
            msg = await websocket.receive_json()
            cmd = msg.get("command") or msg.get("type", "step")

            if cmd in ["step", "game_step"]:
                res = _process_neural_step(
                    left_eye=msg.get("left_eye"),
                    right_eye=msg.get("right_eye"),
                    piece_type=msg.get("piece_type"),
                    odor_glomeruli=msg.get("odor_glomeruli"),
                    substeps=msg.get("substeps", 1),
                    olfaction_enabled=msg.get("olfaction_enabled", True),
                )
                await websocket.send_json(res)

            elif cmd in ("reward", "REWARD_PAM"):
                amt = float(msg.get("amount", 1.0))
                reason = msg.get("reason", "line_clear")
                fly.reward(amount=amt, reason=reason)
                await websocket.send_json({
                    "type": "dopamine_update",
                    "event": "REWARD_PAM",
                    "amount": amt,
                    "reason": reason,
                    "dopamine_level": round(float(fly.dopamine.current_level), 3),
                    "total_rewards": round(float(fly.dopamine.total_rewards), 2),
                    "total_punishments": round(float(fly.dopamine.total_punishments), 2),
                })

            elif cmd in ("punish", "aversion", "PUNISH_PPL1"):
                amt = float(msg.get("amount", 1.0))
                reason = msg.get("reason", "game_over")
                fly.aversion(amount=amt, reason=reason)
                await websocket.send_json({
                    "type": "dopamine_update",
                    "event": "PUNISH_PPL1",
                    "amount": amt,
                    "reason": reason,
                    "dopamine_level": round(float(fly.dopamine.current_level), 3),
                    "total_rewards": round(float(fly.dopamine.total_rewards), 2),
                    "total_punishments": round(float(fly.dopamine.total_punishments), 2),
                })

            elif cmd == "reset":
                fly.engine.V.fill(fly.engine.v_rest)
                fly.engine.spikes.fill(False)
                fly.engine.syn_currents.fill(0.0)
                fly.engine.firing_rates.fill(0.0)
                fly.dopamine.total_rewards = 0.0
                fly.dopamine.total_punishments = 0.0
                await websocket.send_json({
                    "type": "reset_ack",
                    "message": "Connectome dynamics reset to rest",
                })

    except WebSocketDisconnect:
        pass
    except Exception:
        pass


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
