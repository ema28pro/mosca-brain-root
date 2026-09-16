import pytest
from moscabrain.agent_banc import BANCAgent
from moscabrain.agent import FlyWireAgent


def test_pain_system_banc():
    agent = BANCAgent()
    init_da = agent.dopamine_level
    res = agent.pain(intensity=1.5, reason="test_shock")
    
    assert res["type"] == "PAIN_NOCICEPTION"
    assert res["mode"] == "banc"
    assert res["escape_triggered"] is True
    assert agent.dopamine_level < init_da
    assert agent.total_punishments >= 1.5


def test_pain_system_flywire():
    agent = FlyWireAgent()
    init_da = agent.dopamine_level
    res = agent.pain(intensity=1.5, reason="test_shock")
    
    assert res["type"] == "PAIN_NOCICEPTION"
    assert res["mode"] == "flywire_brain"
    assert res["escape_triggered"] is True
    assert agent.total_punishments >= 1.5
    assert agent.engine.aversive_arousal > 0.0
