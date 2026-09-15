import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from moscabrain import FlyAgent

# 1. Crear el agente con el conectoma funcional de FlyWire
fly = FlyAgent()

# 2. Configurar campo de visión fácilmente (270 grados panorámico, 32 omatidios)
fly.vision.configure(fov_horizontal=270, ommatidia_count=32, sensitivity=1.2)

# 3. Darle dopamina (recompensa / cluster PAM)
fly.reward(amount=1.0, reason="azucar_encontrada")
print(f"[Dopamina Inicial] Nivel en cerebro: {fly.dopamine.current_level}")

# 4. Ejecutar 10 pasos con una fuente de luz en el entorno
print("\n--- Simulando pasos sensoriales-motores ---")
for step_i in range(1, 11):
    action = fly.step(light_sources=[{"x": 450, "y": 300, "intensity": 1.5}])
    print(
        f"Paso {step_i:2d} | Estado: {action.state.name:<13} | "
        f"Empuje: {action.forward_thrust:.2f} | Giro: {action.turn_yaw:+.2f} | "
        f"Dopamina: {fly.dopamine.current_level:.2f}"
    )

print("\n¡Simulación completada con éxito!")
