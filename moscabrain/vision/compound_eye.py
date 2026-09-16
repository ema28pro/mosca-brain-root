"""
MoscaBrain: Sistema visual de ojo compuesto (Compound Eye & Ommatidia).
Modela la retina hexagonal, ángulo interomatidial, campo visual panorámico (FOV),
flujo óptico y detección de amenazas de sombras expansivas (Looming Stimulus).
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict
import numpy as np


@dataclass
class VisionConfig:
    fov_horizontal: float = 270.0   # Grados de amplitud panorámica (típico en Drosophila: 240°-270°)
    ommatidia_count: int = 32       # Número total de facetas omatidiales (16 ojo izq, 16 ojo der)
    sensitivity: float = 1.0        # Sensibilidad de los fotorreceptores
    looming_threshold: float = 0.6  # Umbral de detección de amenaza/sombra en expansión
    noise: float = 0.02             # Ruido fotónico en fotorreceptores


class CompoundEye:
    """
    Ojo compuesto de la mosca. Convierte la escena y estímulos visuales
    en vectores de activación retinotópica para el lóbulo óptico.
    """

    def __init__(self, config: Optional[VisionConfig] = None):
        self.config = config or VisionConfig()
        self.n_left = self.config.ommatidia_count // 2
        self.n_right = self.config.ommatidia_count // 2

        # Orientación angular relativa de cada omatidio respecto a la cabeza
        self._compute_ommatidia_angles()

        # Buffers temporales para cálculo de flujo óptico y sombras
        self.left_intensities = np.zeros(self.n_left, dtype=np.float32)
        self.right_intensities = np.zeros(self.n_right, dtype=np.float32)
        self.looming_signal = 0.0

    def configure(
        self,
        fov_horizontal: Optional[float] = None,
        ommatidia_count: Optional[int] = None,
        sensitivity: Optional[float] = None,
        looming_threshold: Optional[float] = None,
    ):
        """Permite al usuario reconfigurar el campo de visión de forma simple y dinámica."""
        if fov_horizontal is not None:
            self.config.fov_horizontal = float(fov_horizontal)
        if ommatidia_count is not None:
            # Debe ser número par
            count = int(ommatidia_count)
            if count % 2 != 0:
                count += 1
            self.config.ommatidia_count = count
            self.n_left = count // 2
            self.n_right = count // 2
        if sensitivity is not None:
            self.config.sensitivity = float(sensitivity)
        if looming_threshold is not None:
            self.config.looming_threshold = float(looming_threshold)

        self._compute_ommatidia_angles()
        self.left_intensities = np.zeros(self.n_left, dtype=np.float32)
        self.right_intensities = np.zeros(self.n_right, dtype=np.float32)

    def _compute_ommatidia_angles(self):
        """Calcula las direcciones azimutales de cada lente omatidial."""
        half_fov = np.radians(self.config.fov_horizontal / 2.0)
        # Ojo izquierdo cubre desde -half_fov hasta 0
        self.left_angles = np.linspace(-half_fov, 0.0, self.n_left, endpoint=False)
        # Ojo derecho cubre desde 0 hasta +half_fov
        self.right_angles = np.linspace(0.0, half_fov, self.n_right, endpoint=True)

    def process_environment(
        self,
        fly_x: float,
        fly_y: float,
        fly_angle: float,  # Radianes (0 = eje X positivo)
        light_sources: List[Dict],  # [{'x': float, 'y': float, 'intensity': float, 'color': str}]
        shadows_or_threats: List[Dict],  # [{'x': float, 'y': float, 'radius': float, 'speed': float}]
    ) -> Tuple[np.ndarray, np.ndarray, float]:
        """
        Muestrea el entorno visible y genera las señales para RETINA_L, RETINA_R y LPLC2.
        Retorna (señal_izq, señal_der, señal_looming).
        """
        left_signal = np.zeros(self.n_left, dtype=np.float32)
        right_signal = np.zeros(self.n_right, dtype=np.float32)

        # 1. Procesamiento de fuentes de luz / estímulos brillantes (Fototaxis)
        for light in light_sources:
            dx = light["x"] - fly_x
            dy = light["y"] - fly_y
            dist = max(1.0, np.sqrt(dx * dx + dy * dy))
            target_angle = np.arctan2(dy, dx)
            # Ángulo relativo a la orientación de la mosca
            rel_angle = (target_angle - fly_angle + np.pi) % (2 * np.pi) - np.pi
            attenuation = (1.0 / (dist * 0.02 + 1.0)) * light.get("intensity", 1.0)

            # Iluminar omatidios izquierdos
            for i, o_angle in enumerate(self.left_angles):
                diff = abs((rel_angle - o_angle + np.pi) % (2 * np.pi) - np.pi)
                receptive_field = np.exp(-0.5 * (diff / 0.25) ** 2)
                left_signal[i] += receptive_field * attenuation

            # Iluminar omatidios derechos
            for i, o_angle in enumerate(self.right_angles):
                diff = abs((rel_angle - o_angle + np.pi) % (2 * np.pi) - np.pi)
                receptive_field = np.exp(-0.5 * (diff / 0.25) ** 2)
                right_signal[i] += receptive_field * attenuation

        # 2. Detección de Sombras en Expansión (Looming Stimulus / Circuito de Escape LPLC2)
        current_looming = 0.0
        for threat in shadows_or_threats:
            dx = threat["x"] - fly_x
            dy = threat["y"] - fly_y
            dist = max(1.0, np.sqrt(dx * dx + dy * dy))
            radius = threat.get("radius", 20.0)

            # Ángulo subtendido por el objeto: theta = 2 * arctan(r / d)
            subtended_angle = 2.0 * np.arctan2(radius, dist)
            # Tasa de expansión aparente (r / v / d)
            expansion_rate = (radius * threat.get("speed", 5.0)) / (dist * dist + 1.0)

            if subtended_angle > 0.4 and dist < 120.0:
                looming_intensity = float(np.clip(expansion_rate * 5.0 + subtended_angle * 0.8, 0.0, 2.0))
                if looming_intensity > current_looming:
                    current_looming = looming_intensity

        # Añadir ruido biofísico y escalar por sensibilidad
        noise_l = np.random.normal(0, self.config.noise, self.n_left)
        noise_r = np.random.normal(0, self.config.noise, self.n_right)
        self.left_intensities = np.clip((left_signal + noise_l) * self.config.sensitivity, 0.0, 1.5)
        self.right_intensities = np.clip((right_signal + noise_r) * self.config.sensitivity, 0.0, 1.5)
        self.looming_signal = current_looming

        return self.left_intensities, self.right_intensities, self.looming_signal


    def get_view_array(self) -> List[float]:
        """Devuelve el vector concatenado de intensidades [Izq, Der] para visualización."""
        return [float(x) for x in np.concatenate([self.left_intensities, self.right_intensities])]
