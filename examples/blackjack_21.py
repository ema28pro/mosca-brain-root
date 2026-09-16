import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import random
from moscabrain import FlyAgent


def deal_card() -> int:
    """Reparte una carta (valor en Blackjack: 2-11)."""
    cards = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11]
    return random.choice(cards)


def play_blackjack_round(fly: FlyAgent, round_num: int):
    # 1. Repartir cartas iniciales
    fly_hand = [deal_card(), deal_card()]
    dealer_hand = [deal_card(), deal_card()]

    print(f"\n{'='*20} RONDA {round_num} {'='*20}")
    print(f"Mano inicial de la Mosca: {fly_hand} (Total: {sum(fly_hand)})")
    print(f"Carta visible del Croupier: {dealer_hand[0]}")

    # 2. Turno de la mosca (Toma de decisiones con el cerebro)
    while True:
        fly_score = sum(fly_hand)
        if fly_score >= 21:
            break

        # A) Codificar el puntaje en el lóbulo antenal (olor glomerular)
        fly.olfaction.encode_blackjack_hand(fly_score, dealer_hand[0])

        # B) Ejecutar un paso en el conectoma
        fly.step()

        # C) Leer la decisión desde las neuronas de salida (MBONs)
        appetitive = fly.engine.get_group_activity("MBON_APPROACH")
        aversive = fly.engine.get_group_activity("MBON_AVOID")

        # MBON_APPROACH promueve riesgo/pedir carta, MBON_AVOID promueve cautela/plantarse
        hit_desire = appetitive - aversive + random.uniform(-0.02, 0.02)
        decision = "PEDIR CARTA" if hit_desire > 0.0 else "PLANTARSE"

        print(
            f"  -> Conectoma evaluando {fly_score} pts: "
            f"Atracción={appetitive:.3f}, Cautela={aversive:.3f} => Decisión: [{decision}]"
        )

        if decision == "PEDIR CARTA":
            new_card = deal_card()
            fly_hand.append(new_card)
            print(f"     Mosca recibe: {new_card} (Nuevo total: {sum(fly_hand)})")
            if sum(fly_hand) > 21:
                print("     ¡La mosca se pasó de 21! (Bust)")
                break
        else:
            print(f"     La mosca decide plantarse con {fly_score} pts.")
            break

    fly_final = sum(fly_hand)

    # 3. Turno del croupier (si la mosca no se pasó)
    if fly_final <= 21:
        while sum(dealer_hand) < 17:
            dealer_hand.append(deal_card())
    dealer_final = sum(dealer_hand)

    print(f"\n[Resultado]")
    print(f"Mosca: {fly_final} pts vs Croupier: {dealer_final} pts (Mano croupier: {dealer_hand})")

    # 4. Modulación por Dopamina (Recompensa vs Castigo)
    if fly_final > 21:
        fly.punish(amount=1.0, reason="derrota_exceso")
        print(f">> Castigo (PPL1): La mosca recibe señal aversiva por pasarse. Dopamina: {fly.dopamine.current_level:.2f}")
    elif dealer_final > 21 or fly_final > dealer_final:
        fly.reward(amount=1.5, reason="victoria_blackjack")
        print(f">> ¡RECOMPENSA DE DOPAMINA (PAM)! La mosca gana la mano. Dopamina: {fly.dopamine.current_level:.2f}")
    elif fly_final == dealer_final:
        print(">> Empate. No hay modulación dopaminérgica.")
    else:
        fly.punish(amount=0.6, reason="derrota_menor")
        print(f">> Castigo leve (PPL1): Croupier tuvo mejor puntaje. Dopamina: {fly.dopamine.current_level:.2f}")


def main():
    print("*" * 65)
    print(" CEREBRO DE MOSCA JUGANDO A 21 (BLACKJACK) CON OLFATO Y DOPAMINA")
    print("*" * 65)
    print("En este experimento, las cartas se transforman en aromas en los glomérulos")
    print("del lóbulo antenal. Las neuronas PAM premian con dopamina las victorias,")
    print("ajustando la red neuronal para aprender a jugar mejor.")

    fly = FlyAgent()

    # Jugar 5 rondas para observar la toma de decisiones y aprendizaje
    for r in range(1, 6):
        play_blackjack_round(fly, round_num=r)

    print(f"\nEntrenamiento finalizado. Total recompensas acumuladas: {fly.dopamine.total_rewards:.1f}")


if __name__ == "__main__":
    main()
