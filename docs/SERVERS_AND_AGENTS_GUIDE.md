# 🕹️ Guía de Ejecución de Servidores, Selección de Agentes y Entornos Web

Esta guía detalla paso a paso cómo iniciar cada servidor de **MoscaBrain**, cómo alternar entre los dos agentes conectómicos (**FlyWireAgent** y **BANCAgent**), y cómo acceder a cada interfaz web.

---

## 📋 Resumen de Puertos y Servicios

| Servicio | Puerto | Comando de Ejecución | Agente Compatible | URL Web |
| :--- | :--- | :--- | :--- | :--- |
| **Servidor General** | `8000` | `python -m uvicorn server.app:app --reload --port 8000` | Ambos (`FlyWireAgent` / `BANCAgent`) | • Cockpit FlyWire: `http://localhost:8000/`<br>• Simulación BANC: `http://localhost:8000/banc/` |
| **Servidor BANC Dedicado** | `8080` | `python -m server.banc_api` | `BANCAgent` (Memoria Ligera) | `http://localhost:8080/` |
| **Tetris Server** | `8001` | `python -m server.tetris_server` | Ambos (Configurable en caliente o por `$env:AGENT_MODE`) | `C:\Users\Fixer\Desktop\Git Kraken\calibrador\tetris_mosca.html` |

---

## 1. Servidor General (Cockpit FlyWire + Simulador BANC)

El servidor general integra todo el ecosistema en un solo proceso FastAPI en el **puerto 8000**.

### A. Comando para Iniciar
Ejecuta en la terminal de la raíz del proyecto (`c:\Users\Fixer\Desktop\Mosca`):

**Comando Recomendado (Estable y sin sobrecarga de archivos):**
```powershell
python -m uvicorn server.app:app --port 8000
```

**Si deseas modo Auto-Reload (sin agotar recursos de Windows):**
```powershell
python -m uvicorn server.app:app --reload --reload-dir server --reload-dir moscabrain --port 8000
```

> [!WARNING]
> **Solución a `OSError: [WinError 1450] Recursos insuficientes en el sistema`**:  
> Si usas `--reload` sin especificar carpetas, Windows intenta rastrear recursivamente más de 1.000 archivos de Python (incluyendo la carpeta `eons_fly_brain`), lo que agota los descriptores del sistema de archivos de Windows (NTFS). Usa siempre el comando sin `--reload` o especificando `--reload-dir server --reload-dir moscabrain`.


### B. Cómo Elegir qué Agente Usar

#### Opción 1: En caliente desde la API REST
Puedes consultar y cambiar el modo activo sin reiniciar el servidor:
```bash
# Consultar modo activo:
curl http://localhost:8000/api/connectome/mode

# Cambiar a BANC Whole-CNS (Cerebro + VNC continuo):
curl -X POST http://localhost:8000/api/connectome/mode -H "Content-Type: application/json" -d "{\"mode\": \"banc\"}"

# Cambiar a FlyWire (Cerebro cefálico aislado 138k):
curl -X POST http://localhost:8000/api/connectome/mode -H "Content-Type: application/json" -d "{\"mode\": \"flywire_brain\"}"
```

#### Opción 2: En Código Python
```python
from moscabrain import FlyAgent, FlyWireAgent, BANCAgent

# 1. Instanciación con la fábrica unificada:
fly_cerebro = FlyAgent(connectome_mode="flywire_brain")  # Retorna FlyWireAgent
fly_completo = FlyAgent(connectome_mode="banc")          # Retorna BANCAgent

# 2. Instanciación directa de clases (Aislamiento de memoria garantizado):
agente_cerebro = FlyWireAgent(dt=0.002)
agente_vnc = BANCAgent(circuit_id="giant_fiber") # o "p9"
```

### C. Cómo Abrir las Páginas Web
- **Arena y Cockpit General FlyWire (Cerebro, Visión, Dopamina, 2D Arena):**  
  Abre en tu navegador: [http://localhost:8000/](http://localhost:8000/)
- **Simulador Sensorimotor BANC (Cerebro + VNC, Raster Plot, Trazas de Voltaje y Motoneuronas):**  
  Abre en tu navegador: [http://localhost:8000/banc/](http://localhost:8000/banc/)
- En ambas páginas hay un botón directo en la barra superior para alternar entre ellas con un solo clic.

---

## 2. Servidor BANC Dedicado (Ultra-Ligero)

Si solo deseas experimentar con las vías de escape de la **Fibra Gigante (DNp01)** o marcha **P9 (DNp09)** hacia las motoneuronas sin cargar los 15 millones de sinapsis de FlyWire en RAM.

### A. Comando para Iniciar
Ejecuta en la terminal (`c:\Users\Fixer\Desktop\Mosca`):
```powershell
python -m server.banc_api
```
*(También puedes usar: `python -m uvicorn server.banc_api:app --reload --port 8080`)*

### B. Cómo Abrir la Web
Abre en tu navegador:  
👉 **[http://localhost:8080/](http://localhost:8080/)**

En este puerto la interfaz web de BANC responde como ruta raíz (`/`) de forma completamente aislada.

### C. Script Python de Ejemplo
```python
from moscabrain import BANCAgent

# Instancia ligera sin conectoma de 15M de sinapsis
agent = BANCAgent(circuit_id="giant_fiber", synapse_threshold=3)

# Simular paso biológico ante amenaza visual (Looming)
threat = [{"x": 305.0, "y": 305.0, "radius": 20.0, "speed": 12.0}]
action = agent.step(threats=threat, trial_duration_ms=40.0)

print(f"Estado motor: {action.state.name}")
print(f"Salto de escape activado: {action.escape_jump}")
print(f"Telemetría motoneuronas: {agent.banc_telemetry}")
```

---

## 3. Tetris Server y Selección de Agente

El servidor de Tetris corre en el **puerto 8001** y expone un WebSocket de alta frecuencia (`ws://localhost:8001/ws/tetris`) para controlar partidas de Tetris mediante la red biológica.

### A. Comando para Iniciar el Servidor (Usa BANC por defecto)
Ejecuta en la terminal (`c:\Users\Fixer\Desktop\Mosca`):
```powershell
python -m server.tetris_server
```
*Por defecto arranca en modo **BANC** (alta eficiencia, consumo de apenas ~102 MB de RAM y arranque instantáneo).*

### B. Cómo Seleccionar el Agente para Tetris

#### Método 1: Al arrancar mediante variable de entorno
En PowerShell (Windows):
```powershell
# BANC Whole-CNS (Predeterminado - ultra liviano):
$env:AGENT_MODE="banc"; python -m server.tetris_server

# FlyWire Cerebro (Carga las 15M de sinapsis completas):
$env:AGENT_MODE="flywire_brain"; python -m server.tetris_server
```


#### Método 2: En caliente con el servidor en marcha (vía REST)
```powershell
# Cambiar a BANC:
Invoke-RestMethod -Uri "http://localhost:8001/api/agent/mode" -Method Post -ContentType "application/json" -Body '{"mode": "banc"}'

# Cambiar a FlyWire:
Invoke-RestMethod -Uri "http://localhost:8001/api/agent/mode" -Method Post -ContentType "application/json" -Body '{"mode": "flywire_brain"}'

# Consultar el estado del agente:
Invoke-RestMethod -Uri "http://localhost:8001/api/status"
```

### C. Cómo Abrir la Página de Tetris

El frontend interactivo de Tetris desarrollado con Three.js se encuentra en:
```
C:\Users\Fixer\Desktop\Git Kraken\calibrador\tetris_mosca.html
```

#### Cómo abrirlo:
1. **Opción Directa**:  
   Haz doble clic en el archivo `tetris_mosca.html` en el Explorador de Windows o ábrelo en tu navegador favorito.
2. **Opción Servidor Estático Local (Recomendada)**:
   Abre una terminal en esa carpeta y levanta un servidor HTTP simple:
   ```powershell
   cd "C:\Users\Fixer\Desktop\Git Kraken\calibrador"
   python -m http.server 3000
   ```
   Luego abre en el navegador:  
   👉 **`http://localhost:3000/tetris_mosca.html`**

#### Verificación de Conexión:
Al abrir la página con `tetris_server.py` corriendo en `:8001`:
- El indicador en la barra superior pasará a **`ONLINE (ws://localhost:8001/ws/tetris)`**.
- Verás el renderizado de los omatidios hexagonales alimentando las neuronas motoras descendentes.
- Las decisiones de movimiento (`P9L`, `P9R`, `ROT`, `DROP`) serán computadas directamente por el conectoma biológico seleccionado.
