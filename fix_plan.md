# Instrucciones: eliminar duplicación real_dynamics / real_flywire en MoscaBrain

Objetivo: dejar `dynamics.py` + `circuits.py` como única implementación del motor.
`RealFlyWireEngine` no se usa en ningún lado (solo se importa); `FlyWireRealConnectome`
solo se usa para inspeccionar el dataset crudo, algo que `FlyWireConnectomeTopology`
ya cubre. Ningún test de producción depende de estos dos archivos.

## Paso 1 — Editar `moscabrain/__init__.py`

Eliminar estas dos líneas de import:
```python
from .connectome.real_flywire import FlyWireRealConnectome
from .connectome.real_dynamics import RealFlyWireEngine
```

Eliminar estas dos entradas de `__all__`:
```python
    "FlyWireRealConnectome",
    "RealFlyWireEngine",
```

## Paso 2 — Editar `moscabrain/connectome/__init__.py`

Eliminar:
```python
from .real_flywire import FlyWireRealConnectome
from .real_dynamics import RealFlyWireEngine
```

Eliminar del `__all__`:
```python
    "FlyWireRealConnectome",
    "RealFlyWireEngine",
```

(Dejar intacto el alias `DrosophilaConnectomeTopology = FlyWireConnectomeTopology`, no depende de los archivos viejos.)

## Paso 3 — Eliminar los archivos viejos

```bash
git rm moscabrain/connectome/real_dynamics.py
git rm moscabrain/connectome/real_flywire.py
```

## Paso 4 — Reescribir `tests/test_moscabrain.py`

Cambiar el import (quitar `FlyWireRealConnectome`, agregar `FlyWireConnectomeTopology`):
```python
from moscabrain import (
    FlyAgent,
    SimulationArena,
    VisionConfig,
    ActionState,
    FlyWireConnectomeTopology,
    HexagonalCompoundEye,
    GameBridge,
)
```

Reemplazar la función `test_real_connectome_dataset_integrity` completa por:
```python
def test_real_connectome_dataset_integrity():
    """Verifica que el dataset real de FlyWire cargue 138.639 neuronas y 15M de conexiones."""
    topo = FlyWireConnectomeTopology()
    assert topo.num_neurons == 138639

    df = topo.load_connections_dataframe()
    assert len(df) == 15091983
    assert "Presynaptic_Index" in df.columns
    assert "Postsynaptic_Index" in df.columns
    assert "Excitatory x Connectivity" in df.columns

    # Verificar neuronas biológicas anotadas
    assert len(topo.sugar_grn_ids) == 21
    assert 720575940624963786 in topo.sugar_grn_ids

    assert len(topo.p9_walking_ids) == 2
    assert 720575940627652358 in topo.p9_walking_ids
```

> Nota: `circuits.py` usa `Presynaptic_Index`/`Postsynaptic_Index` (columnas de índice
> ya mapeado), mientras que el test viejo verificaba `Presynaptic_ID`/`Postsynaptic_ID`
> (Root IDs crudos). Si el parquet trae ambos pares de columnas, no hay problema.
> Si solo trae una de las dos versiones, avísame para ajustar el test al esquema real.

## Paso 5 — Reescribir `examples/real_flywire_dataset.py`

Cambiar:
```python
from moscabrain import FlyWireRealConnectome
...
real = FlyWireRealConnectome.load()
df = real.load_raw_connections_dataframe()
...
sugar_ids = real.get_sugar_neurons()
p9_walking_ids = real.get_p9_walking_neurons()
...
W_sparse = real.get_sparse_weight_matrix()
```

Por:
```python
from moscabrain import FlyWireConnectomeTopology
...
real = FlyWireConnectomeTopology()
df = real.load_connections_dataframe()
...
sugar_ids = real.sugar_grn_ids
p9_walking_ids = real.p9_walking_ids
...
W_sparse = real.get_sparse_weight_matrix()
```

> El script también imprime `df['Excitatory']` para contar sinapsis excitatorias/inhibitorias
> (`df['Excitatory'] > 0`). Confirmar que esa columna exista en el parquet real — si no
> existe (solo existe `Excitatory x Connectivity`), ese print habrá que ajustarlo o quitarlo.

## Paso 6 — Verificar que no queden referencias sueltas

```bash
grep -rn "real_dynamics\|real_flywire\|RealFlyWireEngine\|FlyWireRealConnectome" --include="*.py" .
```

Debe devolver **cero resultados** fuera de este mismo archivo de instrucciones.

## Paso 7 — Correr la suite de tests

```bash
pytest tests/test_moscabrain.py -v
```

Confirmar que `test_real_connectome_dataset_integrity` y `test_agent_initialization_with_real_flywire`
pasen ambos (el segundo ya usaba el motor bueno vía `FlyAgent`, así que no debería cambiar).