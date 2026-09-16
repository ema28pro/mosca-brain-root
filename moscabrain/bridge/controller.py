"""
MoscaBrain Game Controller Bridge: Conector entre juegos y el cerebro de la mosca.
Permite alimentar capturas de pantalla de cualquier juego (Doom, Mario, Pong, Flappy Bird),
configurar la división visual de los ojos (split o duplicado) y traducir el disparo
del conectoma en pulsaciones de teclas o comandos de juego (UP, DOWN, LEFT, RIGHT, SPACE).
"""

from typing import Dict, List, Optional, Callable
import numpy as np
from ..agent import FlyAgent


class GameBridge:
    """
    Puente de control para conectar el cerebro de la mosca a cualquier videojuego.
    """

    def __init__(
        self,
        fly_agent: Optional[FlyAgent] = None,
        stereo_mode: str = "split",  # 'split' (mitad izq/der) o 'duplicate' (misma imagen a ambos ojos)
    ):
        self.fly = fly_agent or FlyAgent()
        self.stereo_mode = stereo_mode

        # Mapeo configurable de neuronas/acciones a teclas de teclado
        self.key_bindings = {
            "FORWARD": "UP",        # o "W"
            "STEER_LEFT": "LEFT",    # o "A"
            "STEER_RIGHT": "RIGHT",  # o "D"
            "JUMP_ESCAPE": "SPACE",  # Salto de escape balístico por Fibra Gigante
            "ACTION_FEED": "ENTER",  # o disparar / comer
        }

        # Umbrales de activación
        self.forward_threshold = 0.2
        self.steer_threshold = 0.25

        # Estado actual de teclas
        self.pressed_keys: Dict[str, bool] = {
            "UP": False,
            "DOWN": False,
            "LEFT": False,
            "RIGHT": False,
            "SPACE": False,
            "ENTER": False,
        }

        # Callbacks opcionales para disparar teclas en el sistema operativo
        self._on_key_press_callbacks: List[Callable[[str, bool], None]] = []

    def bind_key(self, fly_action: str, key_name: str):
        """
        Asocia una acción del cerebro de la mosca a una tecla específica del juego.
        Ejemplos de fly_action: 'FORWARD', 'STEER_LEFT', 'STEER_RIGHT', 'JUMP_ESCAPE', 'ACTION_FEED'
        """
        self.key_bindings[fly_action] = key_name
        self.pressed_keys[key_name] = False

    def set_stereo_mode(self, mode: str):
        """
        Configura cómo la mosca ve la pantalla del juego:
        - 'split': Ojo izquierdo ve la mitad izquierda del juego, Ojo derecho ve la mitad derecha.
        - 'duplicate': La imagen entera se proyecta duplicada a ambos ojos.
        """
        if mode not in ["split", "duplicate"]:
            raise ValueError("stereo_mode debe ser 'split' o 'duplicate'")
        self.stereo_mode = mode

    def step_frame(
        self,
        game_frame: np.ndarray,
        odor_stimulus: Optional[str] = None,
        substeps: int = 5,
    ) -> Dict[str, bool]:
        """
        Pasa un fotograma del videojuego al cerebro de la mosca y retorna
        el diccionario de teclas presionadas según las neuronas descendientes P9 reales.

        Args:
            game_frame: array numpy con la captura del juego (H, W) o (H, W, 3).
            odor_stimulus: opcional, aroma o feromona activa en el juego (ej. 'enemigo', 'pocion').
            substeps: sub-pasos de integración del conectoma real.

        Returns:
            Dict[str, bool]: ej. {'UP': True, 'LEFT': False, 'SPACE': False}
        """
        # 1. Exponer a olor químico si el juego lo especifica
        if odor_stimulus:
            self.fly.olfaction.expose_odor(odor_stimulus)

        # 2. Paso en el conectoma real de FlyWire con captura hexagonal de pantalla
        fwd, yaw, escape = self.fly.step_screen(
            game_frame, stereo_mode=self.stereo_mode, substeps=substeps
        )

        # 3. Traducir disparo de las neuronas P9 reales a teclas presionadas
        new_pressed: Dict[str, bool] = {k: False for k in self.pressed_keys}

        # Avance (P9 Left + P9 Right)
        if fwd > self.forward_threshold:
            k = self.key_bindings.get("FORWARD", "UP")
            new_pressed[k] = True

        # Giro a la izquierda (P9 Left dominante)
        if yaw < -self.steer_threshold:
            k = self.key_bindings.get("STEER_LEFT", "LEFT")
            new_pressed[k] = True

        # Giro a la derecha (P9 Right dominante)
        if yaw > self.steer_threshold:
            k = self.key_bindings.get("STEER_RIGHT", "RIGHT")
            new_pressed[k] = True

        # Salto de escape / Acción especial (Fibra gigante)
        if escape:
            k = self.key_bindings.get("JUMP_ESCAPE", "SPACE")
            new_pressed[k] = True

        self.pressed_keys.update(new_pressed)

        # Disparar callbacks si están registrados
        for key, is_down in new_pressed.items():
            for cb in self._on_key_press_callbacks:
                cb(key, is_down)

        return self.pressed_keys.copy()

    def is_key_pressed(self, key_name: str) -> bool:
        """Verifica si una tecla específica está presionada por la mosca."""
        return self.pressed_keys.get(key_name, False)

    # -------------------------------------------------------------------------
    # Triggers de Recompensa / Castigo para el Desarrollador del Juego
    # -------------------------------------------------------------------------
    def reward(self, amount: float = 1.0, reason: str = "juego_punto_ganado"):
        """
        Llama esta función en tu juego cuando la mosca logre un objetivo
        (ej. ganar puntos, esquivar un obstáculo, recoger una moneda).
        """
        self.fly.reward(amount=amount, reason=reason)

    def punish(self, amount: float = 1.0, reason: str = "juego_colision_muerte"):
        """
        Llama esta función en tu juego cuando la mosca choque, pierda una vida
        o cometa un error, reforzando la aversión en el conectoma.
        """
        self.fly.punish(amount=amount, reason=reason)

    def aversion(self, amount: float = 1.0, reason: str = "juego_colision_muerte"):
        """
        Alias de punish(): llama esta función cuando la mosca choque o sufra un evento aversivo.
        """
        return self.punish(amount=amount, reason=reason)

    def expose_odor(self, odor_name: str, concentration: float = 1.0):
        """
        Muestra un olor a la mosca para representar un estado químico o del juego
        (ej. 'manzana', 'veneno', 'enemigo_cerca').
        """
        self.fly.olfaction.expose_odor(odor_name, concentration=concentration)
