"""
Pruebas de integración del Servidor Web FastAPI y endpoints de la API de MoscaBrain.
Permite testear el estado de la simulación, control de visión, olfato, dopamina y juego de Blackjack.
"""

import pytest
from fastapi.testclient import TestClient
from server.app import app


@pytest.fixture
def client():
    return TestClient(app)


def test_api_status(client):
    """Verifica que el endpoint /api/status retorne telemetría completa de la arena y conectoma."""
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "fly" in data
    assert "arena" in data
    assert "foods" in data
    assert "lights" in data
    assert "threats" in data
    assert "dopamine" in data["fly"]


def test_api_vision_configuration(client):
    """Verifica que /api/vision configure FOV, omatidios y sensibilidad correctamente."""
    payload = {
        "fov_horizontal": 280.0,
        "ommatidia_count": 32,
        "sensitivity": 1.2
    }
    response = client.post("/api/vision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["fov"] == 280.0
    assert data["ommatidia_count"] == 32


def test_api_olfaction_and_dopamine(client):
    """Verifica la exposición de aromas y la inyección de dopamina vía API."""
    # 1. Inyectar aroma
    olf_res = client.post("/api/olfaction", json={"odor_name": "sacarosa_azucar", "concentration": 1.5})
    assert olf_res.status_code == 200
    assert olf_res.json()["success"] is True

    # 2. Inyectar dopamina
    da_res = client.post("/api/dopamine", json={"amount": 1.0, "is_reward": True, "reason": "test_api"})
    assert da_res.status_code == 200
    assert da_res.json()["success"] is True
    assert da_res.json()["dopamine_level"] > 0.0


def test_api_blackjack_round(client):
    """Verifica la simulación completa de una ronda de Blackjack gobernada por el conectoma."""
    response = client.post("/api/blackjack/round")
    assert response.status_code == 200
    data = response.json()
    assert "fly_hand" in data
    assert "dealer_hand" in data
    assert "fly_total" in data
    assert "dealer_total" in data
    assert "outcome" in data
    assert data["outcome"] in ["VICTORIA", "DERROTA", "PASADO_21", "EMPATE"]
    assert len(data["steps_log"]) >= 1
    assert "decision" in data["steps_log"][0]
    assert data["steps_log"][0]["decision"] in ["PEDIR CARTA", "PLANTARSE"]


def test_api_stimulus_lifecycle(client):
    """Verifica la adición, movimiento, remoción y limpieza de estímulos en la arena."""
    # 1. Agregar comida y luz
    add_food = client.post("/api/stimulus/add", json={"type": "food", "x": 400.0, "y": 250.0})
    assert add_food.status_code == 200

    add_light = client.post("/api/stimulus/add", json={"type": "light", "x": 100.0, "y": 100.0})
    assert add_light.status_code == 200

    # 2. Mover la comida a otra posición
    move_res = client.post("/api/stimulus/move", json={"type": "food", "x": 420.0, "y": 260.0, "old_x": 400.0, "old_y": 250.0})
    assert move_res.status_code == 200
    assert move_res.json()["success"] is True

    # 3. Remover la comida por proximidad
    rem_res = client.post("/api/stimulus/remove", json={"type": "food", "x": 420.0, "y": 260.0, "radius": 30.0})
    assert rem_res.status_code == 200
    assert rem_res.json()["success"] is True

    # 4. Limpiar estímulos
    clear_res = client.post("/api/stimulus/clear")
    assert clear_res.status_code == 200
    assert clear_res.json()["success"] is True


def test_api_reset_bias_and_scenario(client):
    """Verifica que /api/reset_bias y /api/scenario restablezcan el sesgo motor y conectoma."""
    res = client.post("/api/reset_bias")
    assert res.status_code == 200
    assert res.json()["success"] is True

    scen_res = client.post("/api/scenario", json={"scenario": "fototaxis_luz"})
    assert scen_res.status_code == 200
    assert scen_res.json()["scenario"] == "fototaxis_luz"
