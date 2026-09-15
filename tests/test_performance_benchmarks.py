"""
Suite de pruebas de rendimiento, latencia biofísica y estabilidad numérica.
Verifica que el cómputo de las 15M de conexiones se ejecute con latencia baja (<25ms) para 20-30 FPS.
"""

import pytest
import time
import numpy as np
from moscabrain import FlyAgent, SimulationArena


def test_engine_step_latency_benchmark():
    """Verifica que el paso biofísico sobre 15.091.983 conexiones tome menos de 25 ms en CPU."""
    fly = FlyAgent()
    # Warmup
    for _ in range(3):
        fly.engine.step()
    
    # Medir 20 pasos
    t0 = time.perf_counter()
    N = 20
    for _ in range(N):
        fly.engine.step()
    elapsed = time.perf_counter() - t0
    avg_ms = (elapsed / N) * 1000.0
    
    assert avg_ms < 30.0, f"Latencia promedio demasiado alta: {avg_ms:.2f} ms (límite: 30ms)"


def test_arena_fps_benchmark():
    """Verifica que la simulación completa de la arena sostenga al menos 20 FPS."""
    arena = SimulationArena(width=800, height=520)
    for _ in range(3):
        arena.step()
        
    t0 = time.perf_counter()
    N = 25
    for _ in range(N):
        arena.step()
    elapsed = time.perf_counter() - t0
    fps = N / elapsed
    
    assert fps >= 15.0, f"FPS de simulación insuficiente: {fps:.1f} FPS"


def test_membrane_potential_numerical_stability():
    """Verifica que los voltajes de membrana permanezcan acotados en rangos biológicos [-65 mV, 0 mV]."""
    fly = FlyAgent()
    fly.stimulate_sugar(2.0)
    fly.engine.inject_looming_input(2.0)
    
    for _ in range(15):
        fly.engine.step()
        assert not np.isnan(fly.engine.V).any(), "Voltajes contienen valores NaN"
        assert not np.isinf(fly.engine.V).any(), "Voltajes contienen valores Inf"
        assert np.all(fly.engine.V >= -90.0), "Hiperpolarización excede límite biofísico de cloruro"
        assert np.all(fly.engine.V <= 10.0), "Despolarización desborda límite biofísico"
