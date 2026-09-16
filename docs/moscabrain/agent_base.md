# Documentación Técnica: `moscabrain/agent_base.py`

## 1. Propósito General del Módulo
El módulo `moscabrain/agent_base.py` introduce la jerarquía de herencia y diseño orientado a objetos unificado para todos los agentes virtuales de *Drosophila melanogaster* en MoscaBrain.

Define la clase base abstracta `BaseFlyAgent` (`ABC`) y las fachadas polimórficas `DopamineFacade` y `TopologyFacade`. Gracias a este diseño:
- Se elimina por completo la duplicación de código entre `FlyWireAgent` (cerebro aislado de 138k neuronas) y `BANCAgent` (Whole-CNS: cerebro + VNC).
- Ambos agentes exponen una interfaz polimórfica homogénea para cinemática, dopamina, conectoma, telemetría y ejecución motora.
- Los servidores (`server/app.py`, `server/tetris_server.py`) y entornos pueden interactuar con cualquier agente sin condicionales dependientes del modo.

---

## 2. Clases y Arquitectura

### 2.1. `BaseFlyAgent(ABC)`
Clase base abstracta de la que derivan todos los agentes en MoscaBrain.

#### Atributos Comunes Inicializados en `__init__(connectome_mode)`:
- `connectome_mode: str`: Etiqueta del modo activo (`"flywire_brain"` o `"banc"`).
- `x: float`, `y: float`: Coordenadas 2D del cuerpo de la mosca en el entorno (predeterminado `300.0, 300.0`).
- `angle: float`: Orientación angular corporal en radianes.
- `speed: float`: Velocidad cinemática de traslación.
- `is_feeding: bool`: Estado binario de extensión de la probóscide / programa de ingestión.
- `feeding_counter: int`: Contador de ciclos de alimentación activa.

#### Propiedades Abstractas (Contrato Obligatorio):
- `@property total_neurons -> int`: Cantidad total de neuronas en el conectoma activo.
- `@property total_synapses -> int`: Cantidad total de conexiones sinápticas en el conectoma.
- `@property dopamine_level -> float`: Nivel extracelular actual de dopamina.
- `@property total_rewards -> float`: Cantidad acumulada de recompensas apetitivas (PAM).
- `@property total_punishments -> float`: Cantidad acumulada de refuerzos aversivos (PPL1).

#### Métodos Abstractos (Comportamiento Requerido):
- `reward(amount=1.0, reason="recompensa")`: Inyecta un pulso de recompensa / activación PAM.
- `punish(amount=1.0, reason="castigo")`: Inyecta un estímulo aversivo / activación PPL1.
- `step(**kwargs) -> ActionOutput`: Ejecuta un ciclo de procesamiento sensoriomotor y actualización física.
- `get_telemetry() -> Dict[str, Any]`: Retorna un diccionario unificado con la telemetría del agente.

#### Métodos y Propiedades Base Provistos:
- `aversion(amount=1.0, reason="aversion")`: Alias común que redirige a `punish(...)`.
- `start_feeding()`: Detiene la velocidad y activa la probóscide.
- `stop_feeding()`: Desactiva la probóscide.
- `@property dopamine`: Retorna el subsistema asignado (como `DopamineSystem` en `FlyWireAgent`) o una instancia de `DopamineFacade(self)` por defecto.
- `@property topology`: Retorna el subsistema asignado (como `FlyWireConnectomeTopology` en `FlyWireAgent`) o una instancia de `TopologyFacade(self)` por defecto.

---

### 2.2. `DopamineFacade`
Fachada polimórfica que permite acceder a las métricas de dopamina mediante el patrón `.dopamine.current_level`, `.dopamine.total_rewards`, `.dopamine.reward()`, etc., garantizando compatibilidad retrospectiva con código consumidor legacy sin tener que duplicar proxies en cada agente.

### 2.3. `TopologyFacade`
Fachada polimórfica que expone `.topology.total_neurons` y `.topology.total_synapses`, garantizando consistencia estructural para clientes y frontends.
