"""
MoscaBrain: Sistema olfativo y de codificación simbólica (Antennal Lobe & Glomeruli).
Permite exponer a la mosca a olores naturales (quimiorrecepción) o codificar símbolos
abstractos (como cartas para 21/Blackjack o estados de juego) a través de los glomérulos.
"""

from typing import Dict, List, Optional
import numpy as np


class AntennalLobe:
    """
    Modela el lóbulo antenal de Drosophila.
    Contiene un mapa glomerular que traduce químicos u olores simbólicos
    en patrones de disparo de neuronas receptoras olfativas (ORNs).
    """

    # Perfiles glomerulares conocidos de olores naturales en Drosophila
    KNOWN_ODORS = {
        "vinagre_manzana": [0.9, 0.7, 0.2, 0.1, 0.0, 0.0, 0.1, 0.3, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2, 0.0, 0.0],
        "sacarosa_azucar": [0.1, 0.2, 0.9, 0.8, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1],
        "platano_fruta":   [0.3, 0.8, 0.7, 0.2, 0.1, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.0, 0.0],
        "humo_repelente":  [0.0, 0.0, 0.0, 0.1, 0.8, 0.9, 0.7, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "feromona_pareja": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.9, 0.8, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "alcohol_etanol":  [0.4, 0.4, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.8, 0.7, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0],
        # Perfiles olfativos específicos para tetrominós (Tetris)
        "tetris_mentol_I":  [1.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "tetris_sacarosa_O": [0.0, 1.0, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "tetris_lavanda_T": [0.0, 0.0, 1.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "tetris_citrico_S": [0.0, 0.0, 0.0, 1.0, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "tetris_humo_Z":    [0.0, 0.0, 0.0, 0.0, 1.0, 0.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "tetris_platano_J": [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "tetris_naranja_L": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    }

    def __init__(self, num_glomeruli: int = 16):
        self.num_glomeruli = num_glomeruli
        self.glomerular_activity = np.zeros(num_glomeruli, dtype=np.float32)
        self.active_odor_label = "aire_limpio"
        self.concentration = 0.0
        self.symbol_mapping: Dict[str, int] = {}

    def expose_odor(self, odor_name: str, concentration: float = 1.0) -> np.ndarray:
        """
        Expone a la mosca a un olor conocido por nombre.
        concentration: intensidad de 0.0 a 1.5
        """
        self.active_odor_label = odor_name
        self.concentration = float(np.clip(concentration, 0.0, 2.0))

        if odor_name in self.KNOWN_ODORS:
            profile = np.array(self.KNOWN_ODORS[odor_name], dtype=np.float32)
            if len(profile) < self.num_glomeruli:
                profile = np.pad(profile, (0, self.num_glomeruli - len(profile)))
            else:
                profile = profile[: self.num_glomeruli]
            self.glomerular_activity = profile * self.concentration
        else:
            # Hash determinista de la palabra para generar un perfil glomerular único
            seed = sum(ord(c) for c in odor_name)
            rng = np.random.RandomState(seed)
            random_profile = rng.uniform(0.0, 1.0, size=self.num_glomeruli).astype(np.float32)
            # Hacerlo biológicamente esparso (solo 2-4 glomérulos dominantes)
            mask = random_profile > 0.6
            self.glomerular_activity = random_profile * mask * self.concentration

        return self.glomerular_activity

    def encode_symbol(self, symbol: str, channel: Optional[int] = None, intensity: float = 1.0) -> np.ndarray:
        """
        Codifica un símbolo arbitrario (ej. 'Carta_As', 'Puntaje_18', 'Color_Rojo')
        en una firma de activación glomerular. Usado para juegos como Blackjack / 21.
        """
        self.active_odor_label = symbol
        self.concentration = intensity

        if channel is None:
            if symbol not in self.symbol_mapping:
                self.symbol_mapping[symbol] = len(self.symbol_mapping) % self.num_glomeruli
            channel = self.symbol_mapping[symbol]

        activity = np.zeros(self.num_glomeruli, dtype=np.float32)
        # Glomérulo principal
        activity[channel % self.num_glomeruli] = 1.0 * intensity
        # Activación cruzada débil vecina (dispersión biológica)
        activity[(channel - 1) % self.num_glomeruli] = 0.2 * intensity
        activity[(channel + 1) % self.num_glomeruli] = 0.2 * intensity

        self.glomerular_activity = activity
        return self.glomerular_activity

    def encode_blackjack_hand(self, player_total: int, dealer_upcard: int) -> np.ndarray:
        """
        Codificación específica para el juego de 21 / Blackjack:
        Mapea el puntaje de la mano y la carta visible del croupier
        a un par de canales glomerulares olfativos.
        """
        self.active_odor_label = f"Mano:{player_total}|Croupier:{dealer_upcard}"
        activity = np.zeros(self.num_glomeruli, dtype=np.float32)

        # Canal para el puntaje (canales 0 a 11, correspondiente a puntajes 10 a 21)
        score_channel = np.clip(player_total - 10, 0, 11)
        activity[score_channel] = 0.9

        # Canal para la carta del dealer (canales 12 a 15)
        dealer_channel = 12 + (dealer_upcard % 4)
        activity[dealer_channel] = 0.7

        self.glomerular_activity = activity
        return self.glomerular_activity

    def encode_tetris_piece(self, piece_type: str, intensity: float = 1.0) -> np.ndarray:
        """
        Codificación olfativa de piezas de Tetris (I, O, T, S, Z, J, L):
        Mapea el tipo de pieza a su firma glomerular química exclusiva.
        """
        mapping = {
            "I": "tetris_mentol_I",
            "O": "tetris_sacarosa_O",
            "T": "tetris_lavanda_T",
            "S": "tetris_citrico_S",
            "Z": "tetris_humo_Z",
            "J": "tetris_platano_J",
            "L": "tetris_naranja_L",
        }
        odor_name = mapping.get(piece_type.upper(), "tetris_mentol_I")
        return self.expose_odor(odor_name, concentration=intensity)

    def clear(self):
        """Limpia la presencia de olores en el ambiente."""
        self.glomerular_activity.fill(0.0)
        self.active_odor_label = "aire_limpio"
        self.concentration = 0.0

    def get_activity_vector(self) -> np.ndarray:
        return self.glomerular_activity.copy()
