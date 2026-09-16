# Documentación Técnica: `run.py`

## 1. Propósito General del Módulo
El archivo `run.py` es el punto de entrada ejecutable (*launcher script*) principal para desplegar el servidor web FastAPI de MoscaBrain en entornos locales.

Su objetivo de diseño fundamental en Windows es resolver el error crítico del sistema de archivos NTFS `OSError: [WinError 1450] Recursos insuficientes en el sistema para completar el servicio solicitado`:
- Al usar la opción `--reload` genérica de Uvicorn en proyectos grandes, el observador de cambios (*file watcher*) intenta registrar descriptores de archivo recursivos sobre todas las carpetas, agotando la memoria del kernel de Windows debido a las decenas de miles de archivos de datos binarios y anotaciones de `eons_fly_brain/` o `.git/`.
- `run.py` restringe explícitamente el mecanismo de recarga a las carpetas de código fuente activo: `reload_dirs=["server", "moscabrain"]`.

---

## 2. Importaciones y Justificación

```python
import sys
import uvicorn
```

### Justificación de Importaciones:
1. **`sys`**: Permite parsear argumentos de línea de comandos pasados por el usuario (`sys.argv`) para sobreescribir el puerto de escucha por defecto (ej. `python run.py 8080`).
2. **`uvicorn`**: Servidor web ASGI estándar de producción en Python para servir aplicaciones FastAPI.

---

## 3. Lógica de Ejecución y Argumentos

### Detección de Puerto:
- Por defecto, utiliza el puerto `8000`.
- Si se proporciona un primer argumento numérico en la terminal (ejemplo: `python run.py 9000`), valida con `isdigit()` y lo asigna a la variable `port`.

### Configuración del Servidor Uvicorn:
- **`app`**: `"server.app:app"` (instancia FastAPI definida en `server/app.py`).
- **`host`**: `"127.0.0.1"` (interfaz de loopback local para acceso seguro).
- **`port`**: Puerto configurado.
- **`reload`**: `True` (habilita la recarga en caliente durante el desarrollo).
- **`reload_dirs`**: `["server", "moscabrain"]` (vigilancia acotada a módulos de código para evitar `[WinError 1450]`).

### Enlaces Informativos de Consola:
Al arrancar, imprime en consola los enlaces directos para el usuario:
- **Cockpit FlyWire Arena**: `http://localhost:8000/`
- **Simulador BANC (Whole-CNS)**: `http://localhost:8000/banc/`
