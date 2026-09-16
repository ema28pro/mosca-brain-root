"""
Ejemplo de Integración con Videojuegos: GameBridge para MoscaBrain.
Muestra cómo conectar cualquier juego al cerebro de la mosca:
1. Configurar la visión (estéreo dividido 'split' o 'duplicate').
2. Mapear las acciones del conectoma a teclas (UP, LEFT, RIGHT, SPACE).
3. Pasar fotogramas del juego a los omatidios.
4. Llamar a las funciones de recompensa/dopamina o castigo en los eventos del juego.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
from moscabrain import GameBridge, FlyAgent


def create_mock_game_screen(width=160, height=120, obstacle_x=80, player_y=60):
    """
    Simula el renderizado de un videojuego en 2D (array numpy RGB de 160x120 píxeles).
    Fondo oscuro, obstáculo brillante acercándose y suelo.
    """
    screen = np.zeros((height, width, 3), dtype=np.uint8)

    # Cielo/Fondo
    screen[:] = [15, 20, 30]

    # Suelo
    screen[100:, :] = [40, 50, 70]

    # Obstáculo (ej. tubería/columna brillante)
    obs_w = 16
    if 0 <= obstacle_x < width:
        x_end = min(width, obstacle_x + obs_w)
        screen[20:80, obstacle_x:x_end] = [50, 220, 100]  # Verde brillante

    # Jugador (mosca en el juego)
    py = int(np.clip(player_y, 10, 100))
    screen[py : py + 10, 20:30] = [255, 200, 50]  # Cuadrado dorado

    return screen


def main():
    print("=" * 68)
    print(" VIDEOJUEGO CONTROLADO POR EL CONECTOMA DE LA MOSCA (GAME BRIDGE)")
    print("=" * 68)

    # 1. Crear el conector GameBridge
    # stereo_mode puede ser:
    # - 'split': El ojo izquierdo ve la mitad izquierda del juego, el derecho la mitad derecha.
    # - 'duplicate': Ambos ojos reciben la imagen completa del juego.
    bridge = GameBridge(stereo_mode="split")

    # 2. Mapear qué tecla del juego activa cada neurona o reflejo
    bridge.bind_key(fly_action="FORWARD", key_name="UP")          # Flecha Arriba para acelerar
    bridge.bind_key(fly_action="STEER_LEFT", key_name="LEFT")     # Flecha Izquierda
    bridge.bind_key(fly_action="STEER_RIGHT", key_name="RIGHT")   # Flecha Derecha
    bridge.bind_key(fly_action="JUMP_ESCAPE", key_name="SPACE")   # Barra espaciadora para saltar
    bridge.bind_key(fly_action="ACTION_FEED", key_name="ENTER")   # Enter para interactuar

    print("[Configuración de Controles del Juego]")
    for action, key in bridge.key_bindings.items():
        print(f"  - Conectoma {action:<14} => Tecla [{key}]")
    print(f"  - Modo de Visión Estéreo: {bridge.stereo_mode}")

    # 3. Bucle del Videojuego
    print("\n--- Iniciando Bucle de Juego (10 fotogramas) ---")
    player_y = 60
    score = 0

    for frame_idx in range(1, 11):
        # El obstáculo se desplaza hacia la izquierda
        obstacle_x = 140 - (frame_idx * 14)

        # Renderizar fotograma del juego
        screen = create_mock_game_screen(obstacle_x=obstacle_x, player_y=player_y)

        # Opcional: mostrar un olor al juego (ej. olor a peligro si obstáculo está cerca)
        if 20 <= obstacle_x <= 50:
            bridge.expose_odor("humo_repelente", concentration=0.9)

        # A) ALIMENTAR EL FOTOGRAMA AL CEREBRO DE LA MOSCA
        pressed_keys = bridge.step_frame(screen)

        # B) APLICAR FÍSICA DEL JUEGO SEGÚN LAS TECLAS PRESIONADAS
        if pressed_keys.get("SPACE", False) or pressed_keys.get("UP", False):
            player_y -= 8  # Salto/Vuelo
            action_desc = "¡SALTO (SPACE/UP)!"
        elif pressed_keys.get("LEFT", False):
            player_y -= 3
            action_desc = "Giro Izquierda (LEFT)"
        elif pressed_keys.get("RIGHT", False):
            player_y += 3
            action_desc = "Giro Derecha (RIGHT)"
        else:
            player_y += 2  # Gravedad natural
            action_desc = "Cayendo (Sin teclas)"

        # C) RECOMPENSAS O CASTIGOS CON DOPAMINA EN EL CÓDIGO DEL JUEGO
        # Si la mosca supera el obstáculo con éxito:
        if obstacle_x < 15 and obstacle_x >= 0:
            score += 10
            # ¡Línea de recompensa con dopamina para el desarrollador!
            bridge.reward(amount=1.5, reason="obstaculo_superado")
            reward_note = ">> [+1.5 DOPAMINA] (Punto ganado)"
        else:
            reward_note = ""

        print(
            f"Frame {frame_idx:2d} | Obstáculo X={obstacle_x:3d} | Mosca Y={player_y:2d} | "
            f"Teclas: {[k for k, v in pressed_keys.items() if v]} | {action_desc} {reward_note}"
        )

    print(f"\nJuego finalizado. Puntuación: {score} pts.")
    print(f"Dopamina final en el cerebro: {bridge.fly.dopamine.current_level:.2f}")


if __name__ == "__main__":
    main()
