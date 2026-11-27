import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
YAML_PATH = ROOT / "cases" / "scenarios" / "case_22_konser_jis.yaml"
OUT_PATH = ROOT / "visualizer" / "data" / "jis_network.placeholder.geojson"

# Pusat peta: koordinat JIS (6.125306 S, 106.860111 E)
CENTER_LAT, CENTER_LNG = -6.125306, 106.860111
DEG_PER_UNIT = 0.0005  # ~55 m per satuan pos


def main() -> None:
    case = yaml.safe_load(YAML_PATH.read_text(encoding="utf-8"))
    nodes = {n["id"]: n for n in case["nodes"]}
    start = case["execution_plan"]["start_node"]
    goal = case["execution_plan"]["goal_node"]
    cx, cy = nodes[goal]["pos"]  # node sink dijadikan titik pusat

    def lnglat(node_id: int):
        x, y = nodes[node_id]["pos"]
        return [
            round(CENTER_LNG + (x - cx) * DEG_PER_UNIT, 6),
            round(CENTER_LAT + (y - cy) * DEG_PER_UNIT, 6),
        ]

    features = []
    for nid, n in nodes.items():
        role = "source" if nid == start else "sink" if nid == goal else "mid"
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": lnglat(nid)},
            "properties": {"kind": "node", "id": nid, "label": n["label"],
                           "role": role},
        })
    for e in case["edges"]:
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString",
                         "coordinates": [lnglat(e["from"]), lnglat(e["to"])]},
            "properties": {"kind": "edge", "from": e["from"], "to": e["to"],
                           "capacity": e["capacity"]},
        })

    out = {
        "type": "FeatureCollection",
        "placeholder": True,
        "note": "KOORDINAT PLACEHOLDER - belum data geografis asli (menunggu Giza)",
        "features": features,
    }
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"saved {OUT_PATH} ({len(nodes)} node, {len(case['edges'])} edge)")


if __name__ == "__main__":
    main()
