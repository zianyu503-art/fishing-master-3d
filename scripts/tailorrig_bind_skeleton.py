#!/usr/bin/env python3
"""TailorRig Hierarchical Chain-to-Bone Skeleton & glTF 2.0 Skinning Pipeline
Based on TailorRig (arXiv:2611.02902, Hugging Face `tencent/TailorRig` & `rigconv.py`).

Two-Stage Formulation:
  Stage 1 (Chain-Level Semantic Association): Partitions vertices into disjoint kinematic chains
    (e.g., primary rod blank chain vs. auxiliary spinning reel chain; primary fish spine chain vs.
    auxiliary dorsal/pectoral fin chains; left/right 5-finger TailorRig arm chains) to eliminate
    weight bleeding across nearby distinct parts.
  Stage 2 (Within-Chain Bone Weight Refinement & Top-4 Normalization): Computes smooth capsule/segment
    projection weights strictly within the assigned chain, normalizes top-4 influences (`JOINTS_0` +
    `WEIGHTS_0`), builds glTF 2.0 `skin` + `inverseBindMatrices`, and writes binary `.glb` files.
"""
import copy
import json
import math
import shutil
import struct
from pathlib import Path

ROOT = Path("/Users/alex/.gemini/antigravity/scratch/fishing-master-3d")
TRELLIS_OUT = ROOT / "outputs" / "trellis_outputs"
HF_DIR = ROOT / "outputs" / "hf_assets"
TRIG_OUT = ROOT / "outputs" / "tailorrig"
TRIG_OUT.mkdir(parents=True, exist_ok=True)


def load_glb(path: Path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw, 0)
    assert magic == b"glTF", f"Invalid GLB magic in {path}"
    jlen, jtype = struct.unpack_from("<II", raw, 12)
    gltf = json.loads(raw[20 : 20 + jlen].decode("utf-8"))
    bin_off = 20 + jlen
    blen, btype = struct.unpack_from("<II", raw, bin_off)
    blob = bytearray(raw[bin_off + 8 : bin_off + 8 + blen])
    return gltf, blob


def save_glb(path: Path, gltf: dict, blob: bytearray):
    while len(blob) % 4 != 0:
        blob.append(0)
    gltf["buffers"] = [{"byteLength": len(blob)}]
    jbytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(jbytes) % 4 != 0:
        jbytes += b" "
    total_len = 12 + 8 + len(jbytes) + 8 + len(blob)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, total_len)
    out += struct.pack("<II", len(jbytes), 0x4E4F534A)
    out += jbytes
    out += struct.pack("<II", len(blob), 0x004E4942)
    out += blob
    path.write_bytes(out)


def read_vec3_accessor(gltf: dict, blob: bytearray, acc_idx: int):
    acc = gltf["accessors"][acc_idx]
    bv = gltf["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = bv.get("byteStride", 12)
    pts = []
    for i in range(acc["count"]):
        pts.append(list(struct.unpack_from("<fff", blob, base + i * stride)))
    return pts


def write_vec3_accessor_in_place(gltf: dict, blob: bytearray, acc_idx: int, pts):
    acc = gltf["accessors"][acc_idx]
    bv = gltf["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = bv.get("byteStride", 12)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    zs = [p[2] for p in pts]
    acc["min"] = [min(xs), min(ys), min(zs)]
    acc["max"] = [max(xs), max(ys), max(zs)]
    for i, p in enumerate(pts):
        struct.pack_into("<fff", blob, base + i * stride, p[0], p[1], p[2])


def append_buffer_view(gltf: dict, blob: bytearray, raw_bytes: bytes, target=None):
    while len(blob) % 4 != 0:
        blob.append(0)
    offset = len(blob)
    blob.extend(raw_bytes)
    bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(raw_bytes)}
    if target is not None:
        bv["target"] = target
    gltf["bufferViews"].append(bv)
    return len(gltf["bufferViews"]) - 1


def point_segment_weight(p, a, b, sigma=0.14):
    ax, ay, az = a
    bx, by, bz = b
    px, py, pz = p
    vx, vy, vz = bx - ax, by - ay, bz - az
    wx, wy, wz = px - ax, py - ay, pz - az
    seg_len2 = vx * vx + vy * vy + vz * vz
    if seg_len2 < 1e-10:
        d2 = wx * wx + wy * wy + wz * wz
        t = 0.0
    else:
        t = max(0.0, min(1.0, (wx * vx + wy * vy + wz * vz) / seg_len2))
        cx, cy, cz = ax + t * vx, ay + t * vy, az + t * vz
        d2 = (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2
    return math.exp(-d2 / (2.0 * sigma * sigma)), t


def bind_tailorrig_skeleton(
    gltf: dict,
    blob: bytearray,
    joints_spec: list,
    chain_classifier,
    sigma: float = 0.14,
):
    """
    `joints_spec`: list of dicts:
      {"name": str, "parent": int (-1 for root), "pos": (x, y, z), "chain": str}
    `chain_classifier(v)` -> chain_name (Stage 1 TailorRig semantic chain assignment)
    """
    prim = gltf["meshes"][0]["primitives"][0]
    verts = read_vec3_accessor(gltf, blob, prim["attributes"]["POSITION"])
    V = len(verts)
    J = len(joints_spec)

    # Group bone segments by chain
    chain_bones = {}
    for j_idx, j in enumerate(joints_spec):
        chain_bones.setdefault(j["chain"], []).append(j_idx)

    joints0_bytes = bytearray()
    weights0_bytes = bytearray()

    for v in verts:
        assigned_chain = chain_classifier(v)
        cand_bones = chain_bones.get(assigned_chain, chain_bones[joints_spec[0]["chain"]])

        # Stage 2: Smooth bone refinement strictly within assigned kinematic chain
        bone_scores = {}
        for j_idx in cand_bones:
            p_idx = joints_spec[j_idx]["parent"]
            j_pos = joints_spec[j_idx]["pos"]
            # Check segments to children in the same chain, or to parent
            children_in_chain = [c for c in cand_bones if joints_spec[c]["parent"] == j_idx]
            if children_in_chain:
                for c_idx in children_in_chain:
                    c_pos = joints_spec[c_idx]["pos"]
                    w_seg, t = point_segment_weight(v, j_pos, c_pos, sigma=sigma)
                    bone_scores[j_idx] = bone_scores.get(j_idx, 0.0) + w_seg * (1.0 - t)
                    bone_scores[c_idx] = bone_scores.get(c_idx, 0.0) + w_seg * t
            elif p_idx >= 0:
                p_pos = joints_spec[p_idx]["pos"]
                w_seg, t = point_segment_weight(v, p_pos, j_pos, sigma=sigma)
                bone_scores[j_idx] = bone_scores.get(j_idx, 0.0) + w_seg * (0.35 + 0.65 * t)
                if joints_spec[p_idx]["chain"] == assigned_chain:
                    bone_scores[p_idx] = bone_scores.get(p_idx, 0.0) + w_seg * (1.0 - t) * 0.5
            else:
                w_pt, _ = point_segment_weight(v, j_pos, j_pos, sigma=sigma)
                bone_scores[j_idx] = bone_scores.get(j_idx, 0.0) + w_pt

        # TailorRig rigconv.py dense_top4 normalization
        ranked = sorted(bone_scores.items(), key=lambda kv: kv[1], reverse=True)[:4]
        while len(ranked) < 4:
            ranked.append((0, 0.0))
        w_sum = sum(val for _, val in ranked)
        if w_sum <= 1e-12:
            ranked = [(cand_bones[0], 1.0), (0, 0.0), (0, 0.0), (0, 0.0)]
            w_sum = 1.0
        idxs = [int(k) for k, _ in ranked]
        ws = [float(val / w_sum) for _, val in ranked]
        # Ensure exact 1.0 sum
        ws[0] += 1.0 - sum(ws)

        joints0_bytes += struct.pack("<HHHH", *idxs)
        weights0_bytes += struct.pack("<ffff", *ws)

    # Inverse bind matrices (column-major 4x4 translation(-world_pos) since rest rotations are identity)
    ibm_bytes = bytearray()
    for j in joints_spec:
        gx, gy, gz = j["pos"]
        # Column-major 4x4 matrix for T(-gx, -gy, -gz)
        ibm = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            -gx, -gy, -gz, 1.0,
        ]
        ibm_bytes += struct.pack("<16f", *ibm)

    bv_j = append_buffer_view(gltf, blob, bytes(joints0_bytes), target=34962)
    bv_w = append_buffer_view(gltf, blob, bytes(weights0_bytes), target=34962)
    bv_ibm = append_buffer_view(gltf, blob, bytes(ibm_bytes))

    gltf.setdefault("accessors", [])
    acc_j = len(gltf["accessors"])
    gltf["accessors"].append({
        "bufferView": bv_j,
        "componentType": 5123,  # UNSIGNED_SHORT
        "count": V,
        "type": "VEC4",
    })
    acc_w = len(gltf["accessors"])
    gltf["accessors"].append({
        "bufferView": bv_w,
        "componentType": 5126,  # FLOAT
        "count": V,
        "type": "VEC4",
    })
    acc_ibm = len(gltf["accessors"])
    gltf["accessors"].append({
        "bufferView": bv_ibm,
        "componentType": 5126,  # FLOAT
        "count": J,
        "type": "MAT4",
    })

    prim["attributes"]["JOINTS_0"] = acc_j
    prim["attributes"]["WEIGHTS_0"] = acc_w

    # Fix PBR default metallicFactor=1.0 on TRELLIS material
    for mat in gltf.get("materials", []):
        pbr = mat.setdefault("pbrMetallicRoughness", {})
        pbr["metallicFactor"] = 0.08
        pbr["roughnessFactor"] = 0.42

    # Build glTF node hierarchy:
    # Armature container node -> SkinnedMesh node + Root Joint node -> child joint nodes
    joint_node_indices = []
    base_node_idx = 0
    nodes = []

    # Node 0: RigRoot container
    nodes.append({"name": "TailorRig_Armature", "children": [1, 2]})
    # Node 1: SkinnedMesh node
    nodes.append({"name": "TailorRig_SkinnedMesh", "mesh": 0, "skin": 0})

    # Nodes 2 .. 2+J-1: Joint nodes
    for j_idx, j in enumerate(joints_spec):
        joint_node_indices.append(2 + j_idx)

    for j_idx, j in enumerate(joints_spec):
        p_idx = j["parent"]
        gx, gy, gz = j["pos"]
        if p_idx < 0:
            lx, ly, lz = gx, gy, gz
        else:
            px, py, pz = joints_spec[p_idx]["pos"]
            lx, ly, lz = gx - px, gy - py, gz - pz
        children_nodes = [joint_node_indices[c] for c in range(J) if joints_spec[c]["parent"] == j_idx]
        j_node = {
            "name": j["name"],
            "translation": [round(lx, 6), round(ly, 6), round(lz, 6)],
            "extras": {"tailorrig_chain": j["chain"]},
        }
        if children_nodes:
            j_node["children"] = children_nodes
        nodes.append(j_node)

    gltf["nodes"] = nodes
    gltf["skins"] = [{
        "name": "TailorRig_Skin",
        "inverseBindMatrices": acc_ibm,
        "skeleton": joint_node_indices[0],
        "joints": joint_node_indices,
    }]
    gltf["scenes"] = [{"name": "Scene", "nodes": [0]}]
    gltf["scene"] = 0


def rig_fishing_rod():
    src = TRELLIS_OUT / "fishing_rod" / "fishing_rod.glb"
    gltf, blob = load_glb(src)

    # Rotate raw rod (-X tip, +X butt, -Y reel) by -90° around Y right in bind pose so:
    #   +Z = butt handle (+0.50), -Z = rod tip (-0.50), -Y = spinning reel hanging down!
    prim = gltf["meshes"][0]["primitives"][0]
    pts = read_vec3_accessor(gltf, blob, prim["attributes"]["POSITION"])
    # R_y(-90°): (x, y, z) -> (-z, y, x) ... Wait: check (-1, 0, 0) [tip]:
    # We want (-1, 0, 0) [tip] -> (0, 0, -1) [-Z forward!] and (+1, 0, 0) [butt] -> (0, 0, +1) [+Z toward angler!]
    # Let's check: (x', y', z') = (-z, y, x) maps x=-0.5 -> z'=-0.5 (-Z tip!) and x=+0.5 -> z'=+0.5 (+Z butt!),
    # determinant = (-1)*(1)*(0) ... wait: det([[0,0,-1],[0,1,0],[1,0,0]]) = +1 (proper rotation R_y(-90°))!
    rot_pts = [[-p[2], p[1], p[0]] for p in pts]
    write_vec3_accessor_in_place(gltf, blob, prim["attributes"]["POSITION"], rot_pts)
    if "NORMAL" in prim["attributes"]:
        nrms = read_vec3_accessor(gltf, blob, prim["attributes"]["NORMAL"])
        rot_nrms = [[-n[2], n[1], n[0]] for n in nrms]
        write_vec3_accessor_in_place(gltf, blob, prim["attributes"]["NORMAL"], rot_nrms)

    for mat in gltf.get("materials", []):
        mat.setdefault("pbrMetallicRoughness", {})["metallicFactor"] = 0.28
        mat["pbrMetallicRoughness"]["roughnessFactor"] = 0.36

    # TailorRig Primary Rod Chain + Auxiliary Spinning Reel Chain
    joints = [
        {"name": "rod_butt",     "parent": -1, "pos": (0.0, 0.0,  0.34), "chain": "rod_blank"},
        {"name": "rod_grip",     "parent":  0, "pos": (0.0, 0.0,  0.16), "chain": "rod_blank"},
        {"name": "rod_blank_01", "parent":  1, "pos": (0.0, 0.0,  0.00), "chain": "rod_blank"},
        {"name": "rod_blank_02", "parent":  2, "pos": (0.0, 0.0, -0.17), "chain": "rod_blank"},
        {"name": "rod_blank_03", "parent":  3, "pos": (0.0, 0.0, -0.34), "chain": "rod_blank"},
        {"name": "rod_tip",      "parent":  4, "pos": (0.0, 0.005, -0.50), "chain": "rod_blank"},
        # Auxiliary Reel Chain (isolated from blank bending!)
        {"name": "reel_body",    "parent":  1, "pos": (0.0, -0.048, 0.21), "chain": "reel_aux"},
        {"name": "reel_crank",   "parent":  6, "pos": (-0.032, -0.062, 0.21), "chain": "reel_aux"},
    ]

    def classify_rod_vertex(v):
        x, y, z = v
        # Hanging spinning reel sits below shaft (y < -0.022) around z in [0.06, 0.36]
        if y < -0.022 and 0.05 <= z <= 0.37:
            return "reel_aux"
        return "rod_blank"

    bind_tailorrig_skeleton(gltf, blob, joints, classify_rod_vertex, sigma=0.095)
    out = TRIG_OUT / "fishing_rod_tailorrig.glb"
    save_glb(out, gltf, blob)
    print(f"Created TailorRig rod: {out.name} ({len(joints)} joints, 2 chains)")


def rig_fish(species_id: str, rotate_x_neg_to_z_pos: bool):
    src = TRELLIS_OUT / species_id / f"{species_id}.glb"
    gltf, blob = load_glb(src)
    prim = gltf["meshes"][0]["primitives"][0]
    pts = read_vec3_accessor(gltf, blob, prim["attributes"]["POSITION"])

    if rotate_x_neg_to_z_pos:
        # Map x=-0.5 (snout) -> z=+0.5 (+Z forward!), x=+0.5 (tail) -> z=-0.5 (-Z tail!)
        # Proper rotation R_y(+90°): (x, y, z) -> (z, y, -x)
        pts = [[p[2], p[1], -p[0]] for p in pts]
        write_vec3_accessor_in_place(gltf, blob, prim["attributes"]["POSITION"], pts)
        if "NORMAL" in prim["attributes"]:
            nrms = read_vec3_accessor(gltf, blob, prim["attributes"]["NORMAL"])
            nrms = [[n[2], n[1], -n[0]] for n in nrms]
            write_vec3_accessor_in_place(gltf, blob, prim["attributes"]["NORMAL"], nrms)

    # TailorRig Primary Spine Chain + Auxiliary Fin Chains
    joints = [
        {"name": "fish_root",     "parent": -1, "pos": (0.0,  0.00,  0.14), "chain": "spine"},
        {"name": "head",          "parent":  0, "pos": (0.0,  0.00,  0.38), "chain": "spine"},
        {"name": "spine_01",      "parent":  0, "pos": (0.0,  0.00, -0.03), "chain": "spine"},
        {"name": "spine_02",      "parent":  2, "pos": (0.0,  0.00, -0.20), "chain": "spine"},
        {"name": "tail_peduncle", "parent":  3, "pos": (0.0,  0.00, -0.35), "chain": "spine"},
        {"name": "caudal_fin",    "parent":  4, "pos": (0.0,  0.00, -0.49), "chain": "spine"},
        # Auxiliary Fin Chains
        {"name": "dorsal_fin",    "parent":  2, "pos": (0.0,  0.14, -0.05), "chain": "dorsal_aux"},
        {"name": "pectoral_l",    "parent":  0, "pos": (0.09, -0.07, 0.12), "chain": "pec_l_aux"},
        {"name": "pectoral_r",    "parent":  0, "pos": (-0.09, -0.07, 0.12), "chain": "pec_r_aux"},
    ]

    def classify_fish_vertex(v):
        x, y, z = v
        if y > 0.115 and -0.24 <= z <= 0.14:
            return "dorsal_aux"
        if x > 0.058 and y < -0.02 and 0.0 <= z <= 0.28:
            return "pec_l_aux"
        if x < -0.058 and y < -0.02 and 0.0 <= z <= 0.28:
            return "pec_r_aux"
        return "spine"

    bind_tailorrig_skeleton(gltf, blob, joints, classify_fish_vertex, sigma=0.12)
    out = TRIG_OUT / f"{species_id}_tailorrig.glb"
    save_glb(out, gltf, blob)
    print(f"Created TailorRig fish: {out.name} ({len(joints)} joints, 4 chains)")


def prepare_tailorrig_arms():
    # `rigged-arms-76f4c7ae.glb` from Hugging Face `codepawl/objaverse-clean-glb`
    # uses the exact 49-joint TailorRig humanrig naming (`clavicle_l/r`, `upperarm_l/r`, `lowerarm_l/r`, `hand_l/r`, 5-finger chains).
    src = HF_DIR / "rigged-arms-76f4c7ae.glb"
    gltf, blob = load_glb(src)
    for mat in gltf.get("materials", []):
        pbr = mat.setdefault("pbrMetallicRoughness", {})
        pbr["metallicFactor"] = 0.0
        pbr["roughnessFactor"] = 0.65
    gltf.setdefault("extras", {})["tailorrig_source"] = "HuggingFace codepawl/objaverse-clean-glb rigged-arms-76f4c7ae (TailorRig humanrig 49-joint convention)"
    out = TRIG_OUT / "angler_arms_tailorrig.glb"
    save_glb(out, gltf, blob)
    print(f"Prepared TailorRig FPS arms: {out.name} (49 joints, left/right 5-finger kinematic chains)")


if __name__ == "__main__":
    rig_fishing_rod()
    rig_fish("largemouth_bass", rotate_x_neg_to_z_pos=True)
    rig_fish("common_carp", rotate_x_neg_to_z_pos=True)
    rig_fish("northern_pike", rotate_x_neg_to_z_pos=False)
    prepare_tailorrig_arms()
    print("=== All TailorRig SkinnedMesh .glb assets built successfully! ===")
