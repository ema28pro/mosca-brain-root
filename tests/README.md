# 🧪 Suite de Pruebas de MoscaBrain (FlyWire v783 Connectome)

Esta carpeta contiene la suite exhaustiva y modular de pruebas biofísicas, conectómicas, sensoriales, motoras y de integración para la emulación del cerebro completo de *Drosophila melanogaster*.

---

## 📂 Organización de los Tests

| Archivo de Test | Descripción y Cobertura | Casos de Prueba |
| :--- | :--- | :--- |
| [`test_moscabrain.py`](test_moscabrain.py) | **Pruebas de Integración y Conectoma Central**<br>Verifica la integridad del dataset Parquet de FlyWire v783 (138.639 neuronas, 15.091.983 sinapsis), inicialización sin atajos artificiales, captura de pantalla hexagonal, pluma bilateral de sacarosa y circuitos reales LC4, Giant Fiber, DNa y MN9. | 12 tests |
| [`test_blackjack.py`](test_blackjack.py) | **Codificación Química y Decisión en Blackjack (21)**<br>Verifica la codificación en glomérulos antenales, competencia sináptica entre neuronas de salida del cuerpo fungiforme (MBONs: Atracción vs Cautela) y plasticidad mediada por dopamina (PAM vs PPL1). | 4 tests |
| [`test_vision_looming.py`](test_vision_looming.py) | **Visión Panorámica y Detección de Sombras (Looming)**<br>Verifica el campo visual retinotópico (FOV), omatidios hexagonales, activación de neuronas de proyección visual LC4, sinapsis a Giant Fiber y disparo del salto balístico de escape. | 4 tests |
| [`test_olfaction_chemotaxis.py`](test_olfaction_chemotaxis.py) | **Olfato, Quimiotaxis y Receptores Odorantes**<br>Verifica los perfiles químicos conocidos (vinagre, azúcar, plátano, humo), la quimiotaxis bilateral y la activación de receptores específicos como Or56a. | 3 tests |
| [`test_motor_kinematics.py`](test_motor_kinematics.py) | **Cinemática Motora y Dinámica Biofísica**<br>Verifica el empuje de avance gobernado por neuronas descendientes P9 (izq/der), giro angular por DNa01/DNa02, extensión de probóscide por motoneuronas MN9 y supresión orgánica de escape mediada por dopamina. | 4 tests |
| [`test_performance_benchmarks.py`](test_performance_benchmarks.py) | **Benchmarks de Latencia y Estabilidad Numérica**<br>Verifica que la simulación de las 15M de conexiones mantenga latencia de paso < 30ms en CPU, sostenga 20+ FPS en arena y mantenga estabilidad en el potencial de membrana sin desbordes. | 3 tests |
| [`test_api_server.py`](test_api_server.py) | **Servidor Web FastAPI y Endpoints REST**<br>Verifica la disponibilidad de telemetría completa `/api/status`, configuración de visión `/api/vision`, olfato `/api/olfaction`, dopamina `/api/dopamine`, simulación de Blackjack `/api/blackjack/round` y ciclo de vida de estímulos. | 5 tests |

**Total de Pruebas Automatizadas:** 35 pruebas exhaustivas.

---

## 🚀 Cómo Ejecutar los Tests

### 1. Ejecutar Toda la Suite de Pruebas
```bash
python -m pytest tests/ -v
```

### 2. Ejecutar un Módulo Específico
- **Blackjack y Toma de Decisiones:**
  ```bash
  python -m pytest tests/test_blackjack.py -v
  ```
- **Visión y Estímulos Looming:**
  ```bash
  python -m pytest tests/test_vision_looming.py -v
  ```
- **Olfato y Quimiotaxis:**
  ```bash
  python -m pytest tests/test_olfaction_chemotaxis.py -v
  ```
- **Cinemática y Control Motor:**
  ```bash
  python -m pytest tests/test_motor_kinematics.py -v
  ```
- **Benchmarks de Rendimiento y Latencia:**
  ```bash
  python -m pytest tests/test_performance_benchmarks.py -v
  ```
- **Servidor y API REST:**
  ```bash
  python -m pytest tests/test_api_server.py -v
  ```

### 3. Ejecutar una Prueba Individual
```bash
python -m pytest tests/test_vision_looming.py::test_escape_jump_kinematics -v
```
