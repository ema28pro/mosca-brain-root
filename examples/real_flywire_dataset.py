"""
Ejemplo de Uso del Dataset Real de FlyWire v783.
Carga directamente los 15 millones de conexiones sinápticas reales y los 138.639
IDs de neuronas del archivo oficial '2025_Connectivity_783.parquet'.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from moscabrain import FlyWireConnectomeTopology


def main():
    print("=" * 70)
    print(" CARGANDO EL CONECTOMA REAL DE FLYWIRE (DROSOPHILA v783)")
    print("=" * 70)

    # 1. Cargar metadatos y tabla de conexiones reales
    print("Accediendo a 'eons_fly_brain/data/2025_Connectivity_783.parquet'...")
    real = FlyWireConnectomeTopology()

    df = real.load_connections_dataframe()

    print(f"\n[DATOS REALES DEL CEREBRO DE LA MOSCA]")
    print(f"  - Total de neuronas en el conectoma: {real.num_neurons:,}")
    print(f"  - Total de sinapsis reales mapeadas: {len(df):,}")
    excitatory_col = "Excitatory x Connectivity"
    if excitatory_col in df.columns:
        print(f"  - Sinapsis excitatorias (+):         {(df[excitatory_col] > 0).sum():,}")
        print(f"  - Sinapsis inhibitorias (-):         {(df[excitatory_col] < 0).sum():,}")

    # 2. Explorar neuronas biológicas reales
    sugar_ids = real.sugar_grn_ids
    p9_walking_ids = real.p9_walking_ids

    print(f"\n[NEURONAS ESPECÍFICAS DE FLYWIRE IDENTIFICADAS]")
    print(f"  - Neuronas gustativas de azúcar (Sugar GRNs): {len(sugar_ids)} neuronas")
    print(f"    Ejemplo Root ID: {sugar_ids[0]}")
    print(f"  - Neuronas descendientes de marcha (P9 DNs):   {len(p9_walking_ids)} neuronas")
    print(f"    P9 Izquierda ID: {p9_walking_ids[0]}")
    print(f"    P9 Derecha ID:   {p9_walking_ids[1]}")

    # 3. Buscar conexiones sinápticas reales de las neuronas de azúcar
    print(f"\n[BUSCANDO SINAPSIS REALES DE LAS NEURONAS DE AZÚCAR EN EL CONECTOMA]")
    pre_col = "Presynaptic_Index"
    post_col = "Postsynaptic_Index"
    sugar_sub = df[df[pre_col].isin(sugar_ids)].head(5) if pre_col in df.columns else df.head(5)
    for _, row in sugar_sub.iterrows():
        exc_val = row.get(excitatory_col, 0)
        tipo = "Excitatoria (+)" if exc_val > 0 else "Inhibitoria (-)"
        print(
            f"  Pre-sináptica: {row[pre_col]} -> Post-sináptica: {row[post_col]} "
            f"| Tipo: {tipo}"
        )

    # 4. Construir la matriz dispersa para simulaciones biofísicas
    print(f"\nConstruyendo matriz dispersa CSR de 138.639 x 138.639...")
    W_sparse = real.get_sparse_weight_matrix()
    print(f"¡Matriz lista! Formato: {W_sparse.shape}, Elementos no nulos (sinapsis): {W_sparse.nnz:,}")
    print(f"Memoria RAM utilizada por la matriz: {W_sparse.data.nbytes / (1024 * 1024):.1f} MB")
    print("\nEl conectoma real de FlyWire está completamente integrado y listo para usar.")


if __name__ == "__main__":
    main()
