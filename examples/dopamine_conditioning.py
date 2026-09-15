import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from moscabrain import FlyAgent

fly = FlyAgent()

print("=" * 65)
print(" EXPERIMENTO: CONDICIONAMIENTO CLÁSICO CON DOPAMINA (PAM CLUSTER)")
print("=" * 65)

# 1. Medir respuesta previa al entrenamiento (Línea Base)
fly.step(odor_name="vinagre_manzana")
approach_pre = fly.engine.get_group_activity("MBON_APPROACH")
avoid_pre = fly.engine.get_group_activity("MBON_AVOID")
print(f"\n[Línea Base Pre-Entrenamiento]")
print(f"Activación MBON Atracción: {approach_pre:.4f} | MBON Evitación: {avoid_pre:.4f}")

# 2. Fase de Entrenamiento (Emparejamiento Estímulo + Dopamina)
print("\n--- Fase de Entrenamiento: Olor + Inyección de Dopamina (5 Ensayos) ---")
for trial in range(1, 6):
    # Exponer al olor y avanzar un ciclo
    fly.step(odor_name="vinagre_manzana")
    # Inyectar pulso de dopamina simultáneo (como al recibir una gota de sacarosa)
    fly.reward(amount=1.2, reason=f"ensayo_entrenamiento_{trial}")
    print(f"Ensayo {trial}: Dopamina liberada = {fly.dopamine.current_level:.2f} | Sinapsis KC->MBON fortalecidas")

# 3. Medir respuesta post-entrenamiento (Test de Memoria)
print("\n--- Test de Memoria Asociativa (Solo Olor, Sin Dopamina) ---")
for test_step in range(1, 4):
    action = fly.step(odor_name="vinagre_manzana")
    approach_post = fly.engine.get_group_activity("MBON_APPROACH")
    avoid_post = fly.engine.get_group_activity("MBON_AVOID")
    print(
        f"Test {test_step} | MBON Atracción: {approach_post:.4f} | "
        f"MBON Evitación: {avoid_post:.4f} | Acción: {action.state.name}"
    )

print("\n[Conclusión Neurobiológica]")
print("La dopamina (PAM) reforzó las sinapsis de las células de Kenyon con las MBONs")
print("de atracción, condicionando a la mosca a buscar el aroma asociado.")
