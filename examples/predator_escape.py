import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from moscabrain import FlyAgent

fly = FlyAgent()
fly.vision.configure(fov_horizontal=270, looming_threshold=0.5)

print("=" * 65)
print(" CIRCUITO DE ESCAPE POR FIBRA GIGANTE (PREDATOR ESCAPE RESPONSE)")
print("=" * 65)

# Situación 1: Sin amenaza (caminata normal)
print("\n[Fase 1] Ambiente seguro (sin depredador):")
action_safe = fly.step()
print(f"Estado de la mosca: {action_safe.state.name} | Batido de alas: {action_safe.wingbeat_hz} Hz")

# Situación 2: Una sombra de depredador se aproxima rápidamente
print("\n[Fase 2] ¡Sombra amenazante aproximándose a gran velocidad!")
threatening_shadow = [{"x": fly.x + 35, "y": fly.y + 20, "radius": 30.0, "speed": 12.0}]

action_threat = fly.step(threats=threatening_shadow)
gf_activity = fly.engine.get_group_activity("DN_GIANT_FIBER")
looming_signal = fly.vision.looming_signal

print(f"Señal Looming detectada por omatidios: {looming_signal:.2f}")
print(f"Disparo de la Fibra Gigante (Giant Fiber): {gf_activity:.4f}")
print(f"Estado motor resultante: {action_threat.state.name}")
print(f"Frecuencia de batido de alas: {action_threat.wingbeat_hz} Hz")
print(f"Salto balístico ejecutado: {action_threat.escape_jump}")

if action_threat.escape_jump:
    print("\n¡ÉXITO! El cerebro de la mosca detectó la amenaza y escapó en milisegundos.")
