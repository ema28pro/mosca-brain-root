# Documentación Técnica: `moscabrain/connectome/__init__.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/connectome/__init__.py` define el paquete `moscabrain.connectome`, reuniendo en una interfaz común los módulos relacionados con la topología, biofísica y experimentación conectómica:
- Dataset **FlyWire v783** (cerebro de 138k neuronas y 15M sinapsis).
- Dataset **BANC v888** (Whole-CNS con VNC y motoneuronas torácicas).
- Simulador Leaky Integrate-and-Fire (LIF) con parámetros fisiológicos de Shiu et al. (2024).
- Alias de compatibilidad hacia atrás (`DrosophilaConnectomeTopology = FlyWireConnectomeTopology`).

---

## 2. Importaciones y Justificación

```python
from .circuits import FlyWireConnectomeTopology
from .dynamics import ConnectomeEngine
from .banc_circuit import BANCCircuitManager
from .banc_lif_simulator import BANCLIFSimulator, DEFAULT_PHYSIOLOGY_PARAMS, run_comparison_experiment
from .banc_experiment import run_full_banc_evaluation

# Alias para compatibilidad hacia atrás
DrosophilaConnectomeTopology = FlyWireConnectomeTopology

__all__ = [
    "FlyWireConnectomeTopology",
    "DrosophilaConnectomeTopology",
    "ConnectomeEngine",
    "BANCCircuitManager",
    "BANCLIFSimulator",
    "DEFAULT_PHYSIOLOGY_PARAMS",
    "run_comparison_experiment",
    "run_full_banc_evaluation",
]
```

### Justificación de Exportaciones:
- `FlyWireConnectomeTopology`: Cargador de datos y constructor de matrices dispersas CSR.
- `ConnectomeEngine`: Motor dinámico de integración y disparo para 138k neuronas.
- `BANCCircuitManager`: Extractor de subcircuitos de Giant Fiber y P9 de BANC.
- `BANCLIFSimulator`: Simulador LIF de picos vectorizado con retardos axonales.
- `DEFAULT_PHYSIOLOGY_PARAMS`: Diccionario canónico de constantes electrofisiológicas.
- `run_comparison_experiment`: Evaluador de respuesta de frecuencia y reclutamiento motor.
- `run_full_banc_evaluation`: Protocolo integral de sensibilidad y generación de informes JSON.
