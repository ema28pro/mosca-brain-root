from .circuits import FlyWireConnectomeTopology
from .dynamics import ConnectomeEngine

# Alias para compatibilidad hacia atrás
DrosophilaConnectomeTopology = FlyWireConnectomeTopology

__all__ = [
    "FlyWireConnectomeTopology",
    "DrosophilaConnectomeTopology",
    "ConnectomeEngine",
]

