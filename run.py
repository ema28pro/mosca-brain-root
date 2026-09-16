"""
MoscaBrain Server Runner.
Arranca el servidor web FastAPI en http://127.0.0.1:8000
Vigilando únicamente 'server' y 'moscabrain' para evitar agotar recursos en Windows por eons_fly_brain.
"""

import sys
import uvicorn

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])

    print(f"🚀 Iniciando MoscaBrain Server en http://127.0.0.1:{port}...")
    print("   • Cockpit FlyWire Arena:  http://localhost:8000/")
    print("   • Simulador BANC (VNC):   http://localhost:8000/banc/")
    uvicorn.run(
        "server.app:app",
        host="127.0.0.1",
        port=port,
        reload=True,
        reload_dirs=["server", "moscabrain"],
    )
