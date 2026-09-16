"""
MoscaBrain: Entorno de simulación (Arena Virtual 2D).
Contiene fuentes de luz, gotas de sacarosa (alimento), sombras/depredadores y plumas de olor
para poner a prueba el comportamiento corporizado del conectoma.
"""

from dataclasses import dataclass
from typing import List, Dict, Optional
import numpy as np
from .agent import FlyAgent
from .body.motor import ActionOutput


@dataclass
class FoodItem:
    id: str
    x: float
    y: float
    radius: float = 12.0
    nutritive_value: float = 1.0


@dataclass
class LightSource:
    id: str
    x: float
    y: float
    intensity: float = 1.0
    color: str = "#ffe066"


@dataclass
class ThreatShadow:
    id: str
    x: float
    y: float
    radius: float = 15.0
    speed: float = 4.0
    vx: float = 0.0
    vy: float = 0.0


class SimulationArena:
    """
    Arena 2D para interactuar con la mosca.
    Gestiona la física de colisiones, evaporación de feromonas/olores y recompensas por comida.
    """

    # La punta de la probóscide se dibuja a 16 px delante del centro corporal.
    PROBOSCIS_REACH = 16.0

    def __init__(self, width: float = 800.0, height: float = 600.0):
        self.width = width
        self.height = height
        self.agent = FlyAgent()
        self.agent.x = width / 2.0
        self.agent.y = height / 2.0

        self.foods: List[FoodItem] = []
        self.lights: List[LightSource] = []
        self.threats: List[ThreatShadow] = []
        self.scenario_name: str = "exploracion_libre"

        # Configurar escenario predeterminado
        self.load_scenario("alimento_dopamina")

    def load_scenario(self, scenario_name: str):
        """Carga un escenario de prueba preconfigurado."""
        self.scenario_name = scenario_name
        self.foods.clear()
        self.lights.clear()
        self.threats.clear()
        self.agent.stop_feeding()
        self.agent.engine.reset_motor_bias()
        self.agent.olfaction.clear()

        if scenario_name == "alimento_dopamina":
            # 3 gotas de sacarosa para condicionamiento apetitivo con dopamina
            self.foods.append(FoodItem("food_1", 200.0, 180.0))
            self.foods.append(FoodItem("food_2", 620.0, 220.0))
            self.foods.append(FoodItem("food_3", 400.0, 480.0))

        elif scenario_name == "escape_depredador":
            # Depredador/sombra estática por defecto (controlable con teclas de flecha)
            self.threats.append(ThreatShadow("shadow_hawk", 150.0, 150.0, radius=24.0, vx=0.0, vy=0.0))
            self.lights.append(LightSource("ambient", 400.0, 300.0, intensity=0.3, color="#ffffff"))

        elif scenario_name == "fototaxis_luz":
            # Fuente de luz brillante hacia la cual la mosca se orienta
            self.lights.append(LightSource("sun_lamp", 650.0, 150.0, intensity=1.8, color="#f39c12"))

        elif scenario_name == "olfato_quimico":
            # Pluma de aroma a vinagre en una esquina
            self.foods.append(FoodItem("yeast_drop", 150.0, 450.0))
            self.agent.olfaction.expose_odor("vinagre_manzana", concentration=0.8)

    def step(self) -> ActionOutput:
        """Avanza un fotograma en la arena virtual."""
        # 1. Mover amenazas / sombras solo si tienen velocidad intrínseca configurada
        for threat in self.threats:
            if threat.vx != 0.0 or threat.vy != 0.0:
                threat.x += threat.vx
                threat.y += threat.vy
                if threat.x < 50 or threat.x > self.width - 50:
                    threat.vx *= -1
                if threat.y < 50 or threat.y > self.height - 50:
                    threat.vy *= -1

        # 2. Preparar listas de estímulos para la visión y olfato
        # Las fuentes de luz reales (la sacarosa es un estímulo químico/gustativo, no emite luz)
        light_dicts = [{"x": l.x, "y": l.y, "intensity": l.intensity} for l in self.lights]

        threat_dicts = [
            {"x": t.x, "y": t.y, "radius": t.radius, "speed": max(3.0, float(np.hypot(t.vx, t.vy)))}
            for t in self.threats
        ]

        # Detección olfativa de la sacarosa. La pluma tiene alcance finito y
        # su concentración crece al acercarse a la gota.
        nearest_food = min(
            self.foods,
            key=lambda food: np.hypot(food.x - self.agent.x, food.y - self.agent.y),
            default=None,
        )
        odor_signal = None
        if nearest_food and self.scenario_name != "olfato_quimico":
            # Las antenas se ubican a ambos lados de la cabeza (en la parte anterior).
            # Solo sus concentraciones locales alcanzan al agente; las coordenadas
            # de la gota se quedan en la arena.
            forward_offset = 8.0
            antenna_spread = 6.5
            head_x = self.agent.x + np.cos(self.agent.angle) * forward_offset
            head_y = self.agent.y + np.sin(self.agent.angle) * forward_offset
            # En coordenadas de pantalla (Y hacia abajo):
            # Vector izquierda: (+sin(theta), -cos(theta))
            # Vector derecha:   (-sin(theta), +cos(theta))
            lateral_x = np.sin(self.agent.angle) * antenna_spread
            lateral_y = -np.cos(self.agent.angle) * antenna_spread

            def plume_concentration(x: float, y: float) -> float:
                distance = float(np.hypot(nearest_food.x - x, nearest_food.y - y))
                linear = np.clip(1.0 - distance / 240.0, 0.0, 1.0)
                return float(linear ** 2)

            left_concentration = plume_concentration(head_x + lateral_x, head_y + lateral_y)
            right_concentration = plume_concentration(head_x - lateral_x, head_y - lateral_y)
            odor_concentration = (left_concentration + right_concentration) * 0.5
            if odor_concentration > 0.0:
                odor_signal = {
                    "name": "sacarosa_azucar",
                    "concentration": odor_concentration,
                    "left_concentration": left_concentration,
                    "right_concentration": right_concentration,
                }
        elif self.scenario_name != "olfato_quimico":
            self.agent.olfaction.clear()

        # 3. Paso de simulación del agente mosca (conectoma real)
        action = self.agent.step(light_sources=light_dicts, threats=threat_dicts, odor_signal=odor_signal)

        # 4. Límites de la arena (paredes reflectantes)
        margin = 15.0
        if self.agent.x < margin:
            self.agent.x = margin
            self.agent.angle = np.pi - self.agent.angle
        elif self.agent.x > self.width - margin:
            self.agent.x = self.width - margin
            self.agent.angle = np.pi - self.agent.angle

        if self.agent.y < margin:
            self.agent.y = margin
            self.agent.angle = -self.agent.angle
        elif self.agent.y > self.height - margin:
            self.agent.y = self.height - margin
            self.agent.angle = -self.agent.angle

        # 5. Detección de contacto con gotas de sacarosa -> Detenerse, comer y consumir
        food_eaten = None
        eating_active = False
        for food in self.foods:
            mouth_x = self.agent.x + self.PROBOSCIS_REACH * np.cos(self.agent.angle)
            mouth_y = self.agent.y + self.PROBOSCIS_REACH * np.sin(self.agent.angle)
            mouth_dist = float(np.hypot(food.x - mouth_x, food.y - mouth_y))
            # Contacto biológico real: la probóscide (labellum) o la cabeza anterior
            # deben alcanzar físicamente la gota de sacarosa.
            # No se permite "alimentarse con las alas o el abdomen": si la gota queda
            # lateral o posterior, las antenas dirigen el giro (DNa) hasta alinear la boca.
            head_x = self.agent.x + 8.0 * np.cos(self.agent.angle)
            head_y = self.agent.y + 8.0 * np.sin(self.agent.angle)
            head_dist = float(np.hypot(food.x - head_x, food.y - head_y))

            if mouth_dist <= (food.radius + 4.0) or head_dist <= (food.radius + 2.0):
                eating_active = True
                self.agent.start_feeding()
                # Estimular fuertemente las neuronas de azúcar (Sugar GRNs) y clúster PAM
                self.agent.stimulate_sugar(intensity=1.5)
                # La gota es consumida por la probóscide (~25 fotogramas)
                food.nutritive_value -= 0.04
                food.radius = max(2.0, 12.0 * np.sqrt(max(0.0, food.nutritive_value)))

                if food.nutritive_value <= 0.0:
                    food_eaten = food
                    # Gran recompensa de dopamina al terminar de comer la gota
                    self.agent.reward(amount=1.5, reason="sacarosa_devorada")
                break

        if food_eaten:
            self.foods.remove(food_eaten)
            self.agent.stop_feeding()
            # Solo regenerar comida automáticamente en el escenario alimento_dopamina
            if len(self.foods) == 0 and self.scenario_name == "alimento_dopamina":
                new_x = float(np.random.uniform(100.0, self.width - 100.0))
                new_y = float(np.random.uniform(80.0, self.height - 80.0))
                self.foods.append(FoodItem(f"food_{len(self.foods)+1}", new_x, new_y))
        elif not eating_active and self.agent.is_feeding:
            self.agent.stop_feeding()

        return action

    def get_state(self) -> dict:
        """Devuelve el estado completo del mundo para visualización y telemetría de testeo."""
        nearest_food_info = None
        if self.foods:
            nf = min(self.foods, key=lambda f: np.hypot(f.x - self.agent.x, f.y - self.agent.y))
            d = float(np.hypot(nf.x - self.agent.x, nf.y - self.agent.y))
            target_ang = float(np.arctan2(nf.y - self.agent.y, nf.x - self.agent.x))
            err_rad = float((target_ang - self.agent.angle + np.pi) % (2 * np.pi) - np.pi)
            nearest_food_info = {
                "id": nf.id,
                "x": round(nf.x, 1),
                "y": round(nf.y, 1),
                "dist": round(d, 1),
                "target_angle_deg": round(float(np.degrees(target_ang)), 1),
                "angle_err_deg": round(float(np.degrees(err_rad)), 1),
            }

        p9_l = float(self.agent.engine.firing_rates[self.agent.engine.topology.p9_left_idx])
        p9_r = float(self.agent.engine.firing_rates[self.agent.engine.topology.p9_right_idx])
        dna_l = float(np.mean(self.agent.engine.firing_rates[self.agent.engine.topology.dna_left_indices])) if len(self.agent.engine.topology.dna_left_indices) > 0 else 0.0
        dna_r = float(np.mean(self.agent.engine.firing_rates[self.agent.engine.topology.dna_right_indices])) if len(self.agent.engine.topology.dna_right_indices) > 0 else 0.0

        forward_offset = 8.0
        antenna_spread = 6.5
        head_x = self.agent.x + np.cos(self.agent.angle) * forward_offset
        head_y = self.agent.y + np.sin(self.agent.angle) * forward_offset
        lateral_x = np.sin(self.agent.angle) * antenna_spread
        lateral_y = -np.cos(self.agent.angle) * antenna_spread
        left_c = 0.0
        right_c = 0.0
        if self.foods:
            nf = min(self.foods, key=lambda f: np.hypot(f.x - self.agent.x, f.y - self.agent.y))
            d_l = float(np.hypot(nf.x - (head_x + lateral_x), nf.y - (head_y + lateral_y)))
            d_r = float(np.hypot(nf.x - (head_x - lateral_x), nf.y - (head_y - lateral_y)))
            left_c = float(np.clip(1.0 - d_l / 240.0, 0.0, 1.0) ** 2)
            right_c = float(np.clip(1.0 - d_r / 240.0, 0.0, 1.0) ** 2)
        denom = max(0.02, left_c + right_c)
        contrast = (right_c - left_c) / denom
        contrast_norm = float(np.clip(contrast * 10.0, -1.0, 1.0))

        return {
            "arena": {"width": self.width, "height": self.height, "scenario": self.scenario_name},
            "foods": [{"id": f.id, "x": round(f.x, 1), "y": round(f.y, 1), "radius": f.radius} for f in self.foods],
            "lights": [
                {"id": l.id, "x": round(l.x, 1), "y": round(l.y, 1), "intensity": l.intensity, "color": l.color}
                for l in self.lights
            ],
            "threats": [
                {"id": t.id, "x": round(t.x, 1), "y": round(t.y, 1), "radius": t.radius}
                for t in self.threats
            ],
            "fly": self.agent.get_telemetry(),
            "diagnostics": {
                "nearest_food": nearest_food_info,
                "antenna_left_c": round(left_c, 4),
                "antenna_right_c": round(right_c, 4),
                "contrast_norm": round(contrast_norm, 4),
                "p9_left_rate": round(p9_l, 4),
                "p9_right_rate": round(p9_r, 4),
                "dna_left_rate": round(dna_l, 4),
                "dna_right_rate": round(dna_r, 4),
                "is_feeding": self.agent.is_feeding,
            },
        }

    def remove_item(
        self,
        item_type: Optional[str] = None,
        item_id: Optional[str] = None,
        x: Optional[float] = None,
        y: Optional[float] = None,
        radius: float = 35.0,
    ) -> bool:
        """Elimina un ítem específico por ID o por proximidad (x, y)."""
        target_lists = []
        if item_type == "food":
            target_lists = [self.foods]
        elif item_type == "light":
            target_lists = [self.lights]
        elif item_type == "threat":
            target_lists = [self.threats]
        else:
            target_lists = [self.foods, self.lights, self.threats]

        # 1. Por ID exacto
        if item_id:
            for t_list in target_lists:
                for item in t_list:
                    if getattr(item, "id", None) == item_id:
                        t_list.remove(item)
                        return True

        # 2. Por coordenadas (x, y) y radio
        if x is not None and y is not None:
            closest_item = None
            closest_list = None
            min_dist = float("inf")
            for t_list in target_lists:
                for item in t_list:
                    d = float(np.hypot(item.x - x, item.y - y))
                    if d < min_dist and d <= radius:
                        min_dist = d
                        closest_item = item
                        closest_list = t_list
            if closest_item and closest_list:
                closest_list.remove(closest_item)
                return True

        return False

    def move_item(
        self,
        item_type: str,
        x: float,
        y: float,
        item_id: Optional[str] = None,
        old_x: Optional[float] = None,
        old_y: Optional[float] = None,
        radius: float = 40.0,
    ) -> bool:
        """Mueve un ítem existente (o la mosca) a una nueva posición (x, y)."""
        if item_type == "fly":
            self.agent.x = float(np.clip(x, 15.0, self.width - 15.0))
            self.agent.y = float(np.clip(y, 15.0, self.height - 15.0))
            return True

        target_list = None
        if item_type == "food":
            target_list = self.foods
        elif item_type == "light":
            target_list = self.lights
        elif item_type == "threat":
            target_list = self.threats

        if not target_list:
            return False

        if item_id:
            for item in target_list:
                if getattr(item, "id", None) == item_id:
                    item.x = float(np.clip(x, 15.0, self.width - 15.0))
                    item.y = float(np.clip(y, 15.0, self.height - 15.0))
                    return True

        if old_x is not None and old_y is not None:
            closest = None
            min_d = float("inf")
            for item in target_list:
                d = float(np.hypot(item.x - old_x, item.y - old_y))
                if d < min_d and d <= radius:
                    min_d = d
                    closest = item
            if closest:
                closest.x = float(np.clip(x, 15.0, self.width - 15.0))
                closest.y = float(np.clip(y, 15.0, self.height - 15.0))
                return True

        return False
