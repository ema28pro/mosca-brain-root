"""
BANC Connectome Circuit Extractor and Manager.

Extracts validated descending-to-motor circuits from the BANC v888 dataset:
- Giant Fiber (DNp01) escape and jump circuit (DNp01 -> TTMn / PSI / DLM).
- P9 (DNp09) forward walking leg circuit (DNp09 -> thoracic premotor interneurons -> leg motor neurons).

Preserves 64-bit root IDs losslessly as strings across all interfaces.
Loads anatomical positions, neurotransmitter predictions, and synaptic counts.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
import pandas as pd
import numpy as np

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "banc"
CACHE_DIR = DATA_DIR / "circuits"


class BANCCircuitManager:
    """Manages extraction, caching, and loading of BANC biological circuits."""

    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = Path(data_dir) if data_dir else DATA_DIR
        self.cache_dir = self.data_dir / "circuits"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.meta_file = self.data_dir / "banc_888_meta.feather"
        self.edge_file = self.data_dir / "banc_888_edgelist_simple_v3.feather"
        self._meta_df: Optional[pd.DataFrame] = None

    def _get_meta(self) -> pd.DataFrame:
        if self._meta_df is None:
            if not self.meta_file.exists():
                raise FileNotFoundError(f"BANC meta file not found at {self.meta_file}")
            self._meta_df = pd.read_feather(self.meta_file).set_index("banc_888_id")
        return self._meta_df

    def extract_giant_fiber_circuit(
        self,
        synapse_threshold: int = 3,
        force_recompute: bool = False
    ) -> Dict[str, Any]:
        """
        Extract the Giant Fiber (DNp01) circuit:
        DNp01 (Left & Right) -> Thoracic VNC premotor interneurons -> Identified motor neurons (TTMn, DLM, etc.).
        """
        cache_path = self.cache_dir / f"giant_fiber_thresh_{synapse_threshold}.json"
        if cache_path.exists() and not force_recompute:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)

        meta = self._get_meta()
        edge = pd.read_feather(self.edge_file)

        # Biological Root IDs for DNp01 in BANC v888
        dnp01_ids = ["720575941509145950", "720575941451068597"]

        # Step 1: Hop-1 downstream targets of DNp01 with synapse count >= synapse_threshold
        h1_edges = edge[edge["pre"].isin(dnp01_ids) & (edge["count"] >= synapse_threshold)]
        h1_targets = set(h1_edges["post"].unique())

        # Step 2: Interneurons in VNC and brain that connect DNp01 downstream
        h1_meta = meta.loc[[i for i in h1_targets if i in meta.index]]
        vnc_intermediaries = set(
            h1_meta[
                h1_meta["super_class"].isin(["ventral_nerve_cord_intrinsic", "ascending", "motor"])
            ].index
        )

        # Step 3: Hop-2 edges from intermediaries to motor neurons or recurrently
        h2_edges = edge[edge["pre"].isin(vnc_intermediaries) & (edge["count"] >= synapse_threshold)]
        h2_targets = set(h2_edges["post"].unique())
        h2_meta = meta.loc[[i for i in h2_targets if i in meta.index]]
        motor_targets = set(h2_meta[h2_meta["super_class"] == "motor"].index)

        # Step 4: Closed network of all active participants
        active_ids = set(dnp01_ids) | vnc_intermediaries | motor_targets

        # Subgraph edges
        circuit_edges_df = edge[
            edge["pre"].isin(active_ids) &
            edge["post"].isin(active_ids) &
            (edge["count"] >= synapse_threshold)
        ]

        # Prune isolated nodes (keep nodes with at least 1 connection or the stimulated DNs)
        connected_nodes = set(circuit_edges_df["pre"]) | set(circuit_edges_df["post"]) | set(dnp01_ids)
        final_node_ids = sorted(list(connected_nodes))

        # Re-filter edges
        final_edges_df = circuit_edges_df[
            circuit_edges_df["pre"].isin(connected_nodes) &
            circuit_edges_df["post"].isin(connected_nodes)
        ]

        circuit_data = self._build_circuit_payload(
            circuit_name="Giant Fiber (DNp01) Escape Circuit",
            circuit_id="giant_fiber",
            stimulated_ids=dnp01_ids,
            node_ids=final_node_ids,
            edges_df=final_edges_df,
            meta=meta,
            synapse_threshold=synapse_threshold,
            description=(
                "Descending giant fiber escape circuit in adult female Drosophila (BANC v888). "
                "DNp01 descends into the thoracic neuromere T2, synapsing onto tergotrochanteral "
                "jump motor neurons (TTMn) and peripherally synapsing interneurons (PSI) connected to "
                "dorsal longitudinal flight muscle motor neurons (DLM)."
            )
        )

        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(circuit_data, f, indent=2)

        return circuit_data

    def extract_p9_circuit(
        self,
        synapse_threshold: int = 5,
        force_recompute: bool = False
    ) -> Dict[str, Any]:
        """
        Extract the P9 (DNp09) forward walking circuit:
        DNp09 (Left & Right) -> Thoracic leg premotor networks -> Identified leg motor neurons.
        """
        cache_path = self.cache_dir / f"p9_walking_thresh_{synapse_threshold}.json"
        if cache_path.exists() and not force_recompute:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)

        meta = self._get_meta()
        edge = pd.read_feather(self.edge_file)

        # Biological Root IDs for DNp09 in BANC v888
        p9_ids = ["720575941566493282", "720575941433155799"]

        # Hop-1 targets
        h1_edges = edge[edge["pre"].isin(p9_ids) & (edge["count"] >= synapse_threshold)]
        h1_targets = set(h1_edges["post"].unique())

        h1_meta = meta.loc[[i for i in h1_targets if i in meta.index]]
        vnc_targets = set(
            h1_meta[
                h1_meta["region"] == "ventral_nerve_cord"
            ].index
        )

        # Direct motor neurons + hop-2 motor neurons
        h2_edges = edge[edge["pre"].isin(vnc_targets) & (edge["count"] >= synapse_threshold)]
        h2_meta = meta.loc[[i for i in set(h2_edges["post"]) if i in meta.index]]
        motor_targets = set(h2_meta[h2_meta["super_class"] == "motor"].index)

        active_ids = set(p9_ids) | vnc_targets | motor_targets
        circuit_edges_df = edge[
            edge["pre"].isin(active_ids) &
            edge["post"].isin(active_ids) &
            (edge["count"] >= synapse_threshold)
        ]

        connected_nodes = set(circuit_edges_df["pre"]) | set(circuit_edges_df["post"]) | set(p9_ids)
        final_node_ids = sorted(list(connected_nodes))

        final_edges_df = circuit_edges_df[
            circuit_edges_df["pre"].isin(connected_nodes) &
            circuit_edges_df["post"].isin(connected_nodes)
        ]

        circuit_data = self._build_circuit_payload(
            circuit_name="P9 (DNp09) Forward Locomotor Circuit",
            circuit_id="p9_walking",
            stimulated_ids=p9_ids,
            node_ids=final_node_ids,
            edges_df=final_edges_df,
            meta=meta,
            synapse_threshold=synapse_threshold,
            description=(
                "Descending P9 forward walking circuit in adult female Drosophila (BANC v888). "
                "DNp09 projects bilaterally into thoracic leg neuropils (T1, T2, T3 neuromeres) "
                "to recruit leg flexor and extensor motor neurons via thoracic premotor interneurons."
            )
        )

        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(circuit_data, f, indent=2)

        return circuit_data

    def extract_sensorimotor_circuit(
        self,
        synapse_threshold: int = 3,
        force_recompute: bool = False
    ) -> Dict[str, Any]:
        """
        Extract the complete whole-CNS sensorimotor integration circuit:
        - DNp01 (Giant Fiber Left & Right, escape jump TTMn / DLMn)
        - DNp09 (P9 Left & Right, walking steering & forward drive)
        -> Thoracic interneurons -> Leg & Jump motor neurons.
        """
        cache_path = self.cache_dir / f"sensorimotor_thresh_{synapse_threshold}.json"
        if cache_path.exists() and not force_recompute:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)

        meta = self._get_meta()
        edge = pd.read_feather(self.edge_file)

        all_dns = [
            "720575941566493280", "720575941566493281",  # DNp01 GF
            "720575941566493282", "720575941433155799",  # DNp09 P9
        ]

        h1_edges = edge[edge["pre"].isin(all_dns) & (edge["count"] >= synapse_threshold)]
        h1_targets = set(h1_edges["post"].unique())
        h1_meta = meta.loc[[i for i in h1_targets if i in meta.index]]
        vnc_intermediaries = set(
            h1_meta[
                h1_meta["region"] == "ventral_nerve_cord"
            ].index
        )

        h2_edges = edge[edge["pre"].isin(vnc_intermediaries) & (edge["count"] >= synapse_threshold)]
        h2_meta = meta.loc[[i for i in set(h2_edges["post"]) if i in meta.index]]
        motor_targets = set(h2_meta[h2_meta["super_class"] == "motor"].index)

        active_ids = set(all_dns) | vnc_intermediaries | motor_targets
        circuit_edges_df = edge[
            edge["pre"].isin(active_ids) &
            edge["post"].isin(active_ids) &
            (edge["count"] >= synapse_threshold)
        ]

        connected_nodes = set(circuit_edges_df["pre"]) | set(circuit_edges_df["post"]) | set(all_dns)
        final_node_ids = sorted(list(connected_nodes))

        final_edges_df = circuit_edges_df[
            circuit_edges_df["pre"].isin(connected_nodes) &
            circuit_edges_df["post"].isin(connected_nodes)
        ]

        circuit_data = self._build_circuit_payload(
            circuit_name="Whole-CNS Sensorimotor Locomotor & Escape Circuit",
            circuit_id="sensorimotor",
            stimulated_ids=all_dns,
            node_ids=final_node_ids,
            edges_df=final_edges_df,
            meta=meta,
            synapse_threshold=synapse_threshold,
            description=(
                "Unified whole-CNS sensorimotor circuit combining Giant Fiber (DNp01) jump/flight escape "
                "and P9 (DNp09) directional walking networks descending into the thoracic ganglion (BANC v888)."
            )
        )

        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(circuit_data, f, indent=2)

        return circuit_data

    def _build_circuit_payload(
        self,
        circuit_name: str,
        circuit_id: str,
        stimulated_ids: List[str],
        node_ids: List[str],
        edges_df: pd.DataFrame,
        meta: pd.DataFrame,
        synapse_threshold: int,
        description: str
    ) -> Dict[str, Any]:
        """Construct a clean, serializable circuit representation with biological metadata."""
        nodes = []
        for nid in node_ids:
            row = meta.loc[nid] if nid in meta.index else pd.Series()

            # Coordinates in nm
            pos_nm_str = str(row.get("root_position_nm", ""))
            x_nm, y_nm, z_nm = 0.0, 0.0, 0.0
            if pos_nm_str and "," in pos_nm_str:
                parts = [p.strip() for p in pos_nm_str.split(",")]
                if len(parts) >= 3:
                    try:
                        x_nm = float(parts[0])
                        y_nm = float(parts[1])
                        z_nm = float(parts[2])
                    except ValueError:
                        pass

            nt_pred = str(row.get("neurotransmitter_predicted", "unknown"))
            if nt_pred == "nan" or not nt_pred:
                nt_pred = "unknown"

            sc = str(row.get("super_class", "unknown"))
            cell_type = str(row.get("cell_type", nid))
            if cell_type == "nan" or not cell_type:
                cell_type = str(row.get("manc_cell_type", nid))

            is_stim = nid in stimulated_ids
            is_motor = (sc == "motor")

            node_dict = {
                "id": str(nid),
                "cell_type": cell_type,
                "super_class": sc,
                "cell_class": str(row.get("cell_class", "")),
                "region": str(row.get("region", "")),
                "neuromere": str(row.get("neuromere", "")),
                "side": str(row.get("side", "")),
                "body_part_effector": str(row.get("body_part_effector", "")),
                "neurotransmitter": nt_pred,
                "nt_score": float(row.get("neurotransmitter_score", 0.0)) if not pd.isna(row.get("neurotransmitter_score", 0.0)) else 0.0,
                "is_stimulated_input": is_stim,
                "is_motor_output": is_motor,
                "position_nm": [x_nm, y_nm, z_nm]
            }
            nodes.append(node_dict)

        edges = []
        for _, r in edges_df.iterrows():
            edges.append({
                "pre": str(r["pre"]),
                "post": str(r["post"]),
                "count": int(r["count"])
            })

        return {
            "circuit_id": circuit_id,
            "circuit_name": circuit_name,
            "description": description,
            "provenance": {
                "dataset": "BANC (Brain and Nerve Cord)",
                "materialization": "v888",
                "synapse_version": "v3 (size >= 10)",
                "source_bucket": "gs://lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888/",
                "reference": "Bates, Phelps, Kim, Yang et al. (Nature 2026)"
            },
            "parameters": {
                "synapse_threshold": synapse_threshold
            },
            "stats": {
                "total_neurons": len(nodes),
                "total_synapses": sum(e["count"] for e in edges),
                "total_edges": len(edges),
                "stimulated_neurons_count": len(stimulated_ids),
                "motor_neurons_count": sum(1 for n in nodes if n["is_motor_output"]),
                "interneurons_count": sum(1 for n in nodes if not n["is_stimulated_input"] and not n["is_motor_output"])
            },
            "nodes": nodes,
            "edges": edges
        }


if __name__ == "__main__":
    mgr = BANCCircuitManager()
    print("Extracting Giant Fiber circuit...")
    gf = mgr.extract_giant_fiber_circuit(synapse_threshold=3, force_recompute=True)
    print(f"GF Circuit extracted: {gf['stats']['total_neurons']} neurons, {gf['stats']['total_edges']} edges, {gf['stats']['motor_neurons_count']} motor neurons")

    print("\nExtracting P9 walking circuit...")
    p9 = mgr.extract_p9_circuit(synapse_threshold=5, force_recompute=True)
    print(f"P9 Circuit extracted: {p9['stats']['total_neurons']} neurons, {p9['stats']['total_edges']} edges, {p9['stats']['motor_neurons_count']} motor neurons")
