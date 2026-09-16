# Documentación Técnica: `moscabrain/bridge/__init__.py`

## 1. Propósito General del Módulo
El archivo `moscabrain/bridge/__init__.py` es el punto de entrada del paquete `moscabrain.bridge`. Expone la clase `GameBridge`, permitiendo importarla de forma directa mediante:
```python
from moscabrain.bridge import GameBridge
```

---

## 2. Importaciones y Símbolos Exportados

```python
from .controller import GameBridge

__all__ = ["GameBridge"]
```

### Justificación:
- **`GameBridge`**: Controlador intermediario que procesa fotogramas de pantalla hacia las retinas del agente y decodifica las tasas motoras descendentes en pulsaciones de teclado para videojuegos externos.
