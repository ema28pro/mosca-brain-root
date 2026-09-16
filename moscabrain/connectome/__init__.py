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

