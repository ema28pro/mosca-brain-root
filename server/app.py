"""
MoscaBrain Web Server: Servidor FastAPI con WebSockets a 60 FPS.
Gestiona el streaming en tiempo real de la arena, el conectoma,
la visión retinotópica, inyecciones de dopamina y juego interactivo de 21/Blackjack.
"""

import asyncio
import os
from pathlib import Path
from typing import Dict, List, Optional
import random
import numpy as np

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from moscabrain import FlyAgent, SimulationArena

app = FastAPI(title="MoscaBrain Cockpit", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instancia global de la arena y agente
arena = SimulationArena(width=800, height=520)

# Clientes WebSocket conectados
connected_websockets: List[WebSocket] = []
current_sim_mode: str = "arena"


class DopamineRequest(BaseModel):
    amount: float = 1.0
    is_reward: bool = True
    reason: str = "web_cockpit"


class VisionRequest(BaseModel):
    fov_horizontal: Optional[float] = None
    ommatidia_count: Optional[int] = None
    sensitivity: Optional[float] = None


class OlfactionRequest(BaseModel):
    odor_name: Optional[str] = None
    symbol: Optional[str] = None
    concentration: float = 1.0


class ScenarioRequest(BaseModel):
    scenario: str


class AddStimulusRequest(BaseModel):
    type: str  # "food", "light", "threat"
    x: float
    y: float


class RemoveStimulusRequest(BaseModel):
    type: Optional[str] = None  # "food", "light", "threat"
    id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    radius: float = 35.0


class MoveStimulusRequest(BaseModel):
    type: str  # "food", "light", "threat", "fly"
    x: float
    y: float
    id: Optional[str] = None
    old_x: Optional[float] = None
    old_y: Optional[float] = None


class ClearStimulusRequest(BaseModel):
    target: Optional[str] = "all"  # "all", "food", "light", "threat"


@app.get("/api/status")
async def get_status():
    return arena.get_state()


@app.post("/api/dopamine")
async def trigger_dopamine(req: DopamineRequest):
    arena.agent.dopamine.trigger(amount=req.amount, is_reward=req.is_reward, reason=req.reason)
    return {
        "success": True,
        "dopamine_level": arena.agent.dopamine.current_level,
        "reason": req.reason,
    }


@app.post("/api/vision")
async def configure_vision(req: VisionRequest):
    arena.agent.vision.configure(
        fov_horizontal=req.fov_horizontal,
        ommatidia_count=req.ommatidia_count,
        sensitivity=req.sensitivity,
    )
    return {
        "success": True,
        "fov": arena.agent.vision.config.fov_horizontal,
        "ommatidia_count": arena.agent.vision.config.ommatidia_count,
    }


@app.post("/api/olfaction")
async def configure_olfaction(req: OlfactionRequest):
    if req.odor_name:
        arena.agent.olfaction.expose_odor(req.odor_name, concentration=req.concentration)
    elif req.symbol:
        arena.agent.olfaction.encode_symbol(req.symbol, intensity=req.concentration)
    else:
        arena.agent.olfaction.clear()
    return {
        "success": True,
        "odor_label": arena.agent.olfaction.active_odor_label,
        "concentration": arena.agent.olfaction.concentration,
    }


class ConnectomeModeRequest(BaseModel):
    mode: str  # "banc" or "flywire_brain"


@app.get("/api/connectome/mode")
async def get_connectome_mode():
    """Consulta el modo de conectoma activo (BANC Whole-CNS vs FlyWire Brain-only)."""
    return {
        "current_mode": getattr(arena.agent, "connectome_mode", "banc"),
        "available_modes": [
            {
                "id": "banc",
                "name": "BANC Whole-CNS (Brain + VNC Motor Circuits)",
                "description": "188k neuronas continuas (Cerebro + Cuello + VNC) hasta motoneuronas identificadas de patas y alas.",
                "dataset": "BANC v888 (Nature 2026)"
            },
            {
                "id": "flywire_brain",
                "name": "FlyWire Brain-Only (FAFB / v783)",
                "description": "138k neuronas cerebrales (Lóbulos ópticos, antenales, MB, Complejo Central, neuronas descendentes).",
                "dataset": "FlyWire v783 (Nature 2024)"
            }
        ],
        "banc_telemetry": getattr(arena.agent, "banc_telemetry", {})
    }


@app.post("/api/connectome/mode")
async def set_connectome_mode(req: ConnectomeModeRequest):
    """Alterna en tiempo real entre BANC (Whole-CNS) y FlyWire (Brain-Only)."""
    if req.mode not in ("banc", "flywire_brain"):
        raise HTTPException(status_code=400, detail=f"Modo inválido: {req.mode}. Use 'banc' o 'flywire_brain'.")
    arena.agent.set_connectome_mode(req.mode)
    return {
        "success": True,
        "current_mode": arena.agent.connectome_mode,
        "message": f"Conectoma activo cambiado a: {req.mode}"
    }


@app.post("/api/scenario")
async def switch_scenario(req: ScenarioRequest):
    arena.load_scenario(req.scenario)
    return {"success": True, "scenario": arena.scenario_name}


@app.post("/api/reset_bias")
@app.get("/api/reset_bias")
async def reset_bias_endpoint():
    arena.agent.engine.reset_motor_bias()
    arena.agent.olfaction.clear()
    arena.agent.stop_feeding()
    return {"success": True, "message": "Sesgo motor y conectoma restablecidos con éxito"}


@app.post("/api/stimulus/add")
async def add_stimulus(req: AddStimulusRequest):
    if current_sim_mode == "blackjack":
        return {"success": False, "reason": "arena_disabled_in_blackjack"}

    from moscabrain.arena import FoodItem, LightSource, ThreatShadow

    if req.type == "food":
        arena.foods.append(FoodItem(f"food_{len(arena.foods)+1}", req.x, req.y))
    elif req.type == "light":
        arena.lights.append(LightSource(f"light_{len(arena.lights)+1}", req.x, req.y, intensity=1.2))
    elif req.type == "threat":
        arena.threats.append(
            ThreatShadow(f"threat_{len(arena.threats)+1}", req.x, req.y, radius=25.0, vx=0.0, vy=0.0)
        )
    return {"success": True, "type": req.type}


@app.post("/api/stimulus/remove")
async def remove_stimulus(req: RemoveStimulusRequest):
    removed = arena.remove_item(
        item_type=req.type,
        item_id=req.id,
        x=req.x,
        y=req.y,
        radius=req.radius,
    )
    return {"success": removed}


@app.post("/api/stimulus/move")
async def move_stimulus(req: MoveStimulusRequest):
    moved = arena.move_item(
        item_type=req.type,
        x=req.x,
        y=req.y,
        item_id=req.id,
        old_x=req.old_x,
        old_y=req.old_y,
    )
    return {"success": moved}


@app.post("/api/stimulus/clear")
async def clear_stimuli(req: Optional[ClearStimulusRequest] = None):
    target = req.target if req else "all"
    if target == "food":
        arena.foods.clear()
        arena.agent.olfaction.clear()
        # Resetear sesgo motor acumulado por olfato (adaptación sensorial rápida)
        arena.agent.engine.reset_motor_bias()
    elif target == "light":
        arena.lights.clear()
        # Resetear sesgo motor acumulado por visión
        arena.agent.engine.reset_motor_bias()
    elif target == "threat":
        arena.threats.clear()
    else:
        arena.foods.clear()
        arena.lights.clear()
        arena.threats.clear()
        arena.agent.olfaction.clear()
        arena.agent.engine.reset_motor_bias()
    return {"success": True, "target": target}


@app.post("/api/blackjack/round")
async def play_blackjack_round():
    cards = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11]
    fly_hand = [random.choice(cards), random.choice(cards)]
    dealer_hand = [random.choice(cards), random.choice(cards)]

    log = []
    if sum(fly_hand) >= 21:
        log.append({
            "score": sum(fly_hand),
            "decision": "PLANTARSE",
            "mbon_app": 0.0,
            "mbon_avd": 1.0,
        })
    else:
        # Turno de la mosca usando su conectoma
        while sum(fly_hand) < 21:
            current_score = sum(fly_hand)
            arena.agent.olfaction.encode_blackjack_hand(current_score, dealer_hand[0])
            arena.agent.step()
            appetitive = arena.agent.engine.get_group_activity("MBON_APPROACH")
            aversive = arena.agent.engine.get_group_activity("MBON_AVOID")
            decision = "PEDIR CARTA" if (appetitive - aversive + random.uniform(-0.02, 0.02)) > 0 else "PLANTARSE"
            log.append({
                "score": current_score,
                "decision": decision,
                "mbon_app": round(appetitive, 3),
                "mbon_avd": round(aversive, 3),
            })
            if decision == "PEDIR CARTA":
                card = random.choice(cards)
                fly_hand.append(card)
                if sum(fly_hand) > 21:
                    break
            else:
                break

    fly_total = sum(fly_hand)
    if fly_total <= 21:
        while sum(dealer_hand) < 17:
            dealer_hand.append(random.choice(cards))
    dealer_total = sum(dealer_hand)

    # Resultado y modulación por dopamina
    outcome = "DERROTA"
    dopamine_delta = 0.0
    if fly_total > 21:
        outcome = "PASADO_21"
        arena.agent.punish(amount=0.8, reason="blackjack_bust")
        dopamine_delta = -0.8
    elif dealer_total > 21 or fly_total > dealer_total:
        outcome = "VICTORIA"
        arena.agent.reward(amount=1.5, reason="blackjack_win")
        dopamine_delta = 1.5
    elif fly_total == dealer_total:
        outcome = "EMPATE"
    else:
        outcome = "DERROTA"
        arena.agent.punish(amount=0.5, reason="blackjack_loss")
        dopamine_delta = -0.5

    return {
        "fly_hand": fly_hand,
        "fly_total": fly_total,
        "dealer_hand": dealer_hand,
        "dealer_total": dealer_total,
        "outcome": outcome,
        "dopamine_delta": dopamine_delta,
        "dopamine_level": round(arena.agent.dopamine.current_level, 3),
        "steps_log": log,
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.append(websocket)
    sim_mode = "arena"
    is_simulation_paused = False
    step_once_requested = False

    # Cola de comandos para desacoplar la recepción de mensajes del bucle de simulación
    command_queue = asyncio.Queue()

    async def rx_worker():
        try:
            while True:
                msg = await websocket.receive_json()
                await command_queue.put(msg)
        except Exception:
            pass

    rx_task = asyncio.create_task(rx_worker())

    try:
        while True:
            # Procesar inmediatamente todos los comandos acumulados en la cola
            while not command_queue.empty():
                try:
                    msg = command_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
                cmd = msg.get("command")
                if cmd == "set_mode":
                    global current_sim_mode
                    current_sim_mode = msg.get("mode", "arena")
                    sim_mode = current_sim_mode
                elif cmd == "reward":
                    arena.agent.reward(float(msg.get("amount", 1.0)), reason="ws_button")
                elif cmd == "punish":
                    arena.agent.punish(float(msg.get("amount", 1.0)), reason="ws_button")
                elif cmd == "pause":
                    is_simulation_paused = True
                elif cmd == "resume":
                    is_simulation_paused = False
                elif cmd == "toggle_pause":
                    is_simulation_paused = not is_simulation_paused
                elif cmd == "step_frame":
                    step_once_requested = True
                elif cmd == "move_fly":
                    arena.agent.x = float(msg.get("x", arena.agent.x))
                    arena.agent.y = float(msg.get("y", arena.agent.y))
                    if "angle" in msg:
                        arena.agent.angle = float(msg["angle"])
                    elif "angle_deg" in msg:
                        arena.agent.angle = float(np.radians(float(msg["angle_deg"])))
                elif cmd == "set_fly_pose":
                    if "x" in msg:
                        arena.agent.x = float(msg["x"])
                    if "y" in msg:
                        arena.agent.y = float(msg["y"])
                    if "angle" in msg:
                        arena.agent.angle = float(msg["angle"])
                    elif "angle_deg" in msg:
                        arena.agent.angle = float(np.radians(float(msg["angle_deg"])))
                    arena.agent.angle = (arena.agent.angle + np.pi) % (2 * np.pi) - np.pi
                    arena.agent.speed = 0.0
                    if msg.get("reset_bias", True):
                        arena.agent.engine.reset_motor_bias()
                elif cmd == "reset_bias":
                    arena.agent.engine.reset_motor_bias()
                    arena.agent.stop_feeding()
                elif cmd == "move_threat":
                    dx = float(msg.get("dx", 0.0))
                    dy = float(msg.get("dy", 0.0))
                    from moscabrain.arena import ThreatShadow
                    if not arena.threats:
                        arena.threats.append(
                            ThreatShadow("shadow_hawk", arena.width / 2.0, 120.0, radius=24.0, vx=0.0, vy=0.0)
                        )
                    latest = arena.threats[-1]
                    latest.x = float(np.clip(latest.x + dx, 15.0, arena.width - 15.0))
                    latest.y = float(np.clip(latest.y + dy, 15.0, arena.height - 15.0))
                elif cmd == "move_threat_absolute":
                    tx = float(msg.get("x", arena.width / 2.0))
                    ty = float(msg.get("y", arena.height / 2.0))
                    from moscabrain.arena import ThreatShadow
                    if not arena.threats:
                        arena.threats.append(
                            ThreatShadow("shadow_hawk", tx, ty, radius=24.0, vx=0.0, vy=0.0)
                        )
                    latest = arena.threats[-1]
                    latest.x = float(np.clip(tx, 15.0, arena.width - 15.0))
                    latest.y = float(np.clip(ty, 15.0, arena.height - 15.0))
                elif cmd == "move_stimulus":
                    arena.move_item(
                        item_type=msg.get("type", "food"),
                        x=float(msg.get("x", 0.0)),
                        y=float(msg.get("y", 0.0)),
                        item_id=msg.get("id"),
                        old_x=float(msg["old_x"]) if "old_x" in msg else None,
                        old_y=float(msg["old_y"]) if "old_y" in msg else None,
                    )
                elif cmd == "remove_stimulus":
                    arena.remove_item(
                        item_type=msg.get("type"),
                        item_id=msg.get("id"),
                        x=float(msg["x"]) if "x" in msg else None,
                        y=float(msg["y"]) if "y" in msg else None,
                        radius=float(msg.get("radius", 35.0)),
                    )
                elif cmd == "clear_stimuli":
                    target = msg.get("target", "all")
                    if target == "food":
                        arena.foods.clear()
                        arena.agent.olfaction.clear()
                    elif target == "light":
                        arena.lights.clear()
                    elif target == "threat":
                        arena.threats.clear()
                    else:
                        arena.foods.clear()
                        arena.lights.clear()
                        arena.threats.clear()
                        arena.agent.olfaction.clear()

            # Si el usuario está en modo Blackjack, pausar la física de la arena
            if sim_mode == "blackjack":
                state = arena.get_state()
                state["is_paused"] = True
                state["action"] = {
                    "state": "CASINO_BLACKJACK (ARENA PAUSADA)",
                    "forward_thrust": 0.0,
                    "turn_yaw": 0.0,
                    "wingbeat_hz": 0.0,
                    "proboscis_extended": False,
                    "escape_jump": False,
                }
                state["compute_ms"] = 0.0
                await websocket.send_json(state)
                await asyncio.sleep(0.040)
                continue

            # Si la simulación está pausada y no se pidió 1 paso manual
            if is_simulation_paused and not step_once_requested:
                state = arena.get_state()
                state["is_paused"] = True
                state["action"] = {
                    "state": "PAUSADO" if not arena.agent.is_feeding else "FEEDING (PAUSADO)",
                    "forward_thrust": 0.0,
                    "turn_yaw": 0.0,
                    "wingbeat_hz": 0.0,
                    "proboscis_extended": arena.agent.is_feeding,
                    "escape_jump": False,
                }
                state["compute_ms"] = 0.0
                await websocket.send_json(state)
                await asyncio.sleep(0.040)
                continue

            if step_once_requested:
                step_once_requested = False

            # Modo Arena: avanzar simulación midiendo tiempo real de cómputo
            import time as pytime
            t0 = pytime.perf_counter()
            action = arena.step()
            elapsed = pytime.perf_counter() - t0
            compute_ms = round(elapsed * 1000.0, 1)

            # Enviar telemetría en tiempo real
            state = arena.get_state()
            state["is_paused"] = is_simulation_paused
            state["action"] = action.to_dict()
            state["compute_ms"] = compute_ms
            state["connectome_mode"] = getattr(arena.agent, "connectome_mode", "banc")
            state["banc_telemetry"] = getattr(arena.agent, "banc_telemetry", {})
            await websocket.send_json(state)

            # Pacing dinámico para garantizar 25-30 FPS estables con latencia mínima
            target_interval = 0.033  # ~30 FPS
            sleep_time = max(0.002, target_interval - elapsed)
            await asyncio.sleep(sleep_time)

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        rx_task.cancel()
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)


# Servir la interfaz web estática de React (busca primero 'dist' de Vite, o 'web')
root_dir = Path(__file__).resolve().parent.parent
dist_dir = root_dir / "dist"
web_dir = dist_dir if dist_dir.exists() else (root_dir / "web")

if web_dir.exists():
    app.mount("/static", StaticFiles(directory=str(web_dir)), name="static")
    assets_dir = web_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(web_dir / "index.html"))

# Montar simulador conectómico BANC desde carpeta dedicada 'web_banc'
try:
    from server.banc_api import router as banc_router
    app.include_router(banc_router)

    banc_web_dir = root_dir / "web_banc"
    if not banc_web_dir.exists():
        banc_web_dir = root_dir / "web" / "banc"

    if banc_web_dir.exists():
        app.mount("/banc/static", StaticFiles(directory=str(banc_web_dir)), name="banc_static")

        @app.get("/banc")
        @app.get("/banc/")
        async def serve_banc_home():
            return FileResponse(str(banc_web_dir / "index.html"))

        @app.get("/banc/banc_style.css")
        async def serve_banc_css():
            return FileResponse(str(banc_web_dir / "banc_style.css"), media_type="text/css")

        @app.get("/banc/banc_app.js")
        async def serve_banc_js():
            return FileResponse(str(banc_web_dir / "banc_app.js"), media_type="application/javascript")

        @app.get("/banc-preview")
        async def serve_banc_preview():
            return FileResponse(str(banc_web_dir / "index.html"))
except Exception as e:
    print(f"BANC mount notice: {e}")



if __name__ == "__main__":
    import uvicorn
    # Vigilar únicamente server/ y moscabrain/ para evitar el WinError 1450 por los miles de archivos de eons_fly_brain
    uvicorn.run(
        "server.app:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["server", "moscabrain"],
    )



