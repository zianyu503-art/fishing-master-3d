"""Step 2: Batch generate all 11《釣魚大師 3D》3D assets using Microsoft TRELLIS (Image-to-3D) on Colab GPU.
Outputs per asset:
  - <asset>.glb (baked 1024x1024 textured mesh)
  - <asset>_gaussian.ply (3D Gaussian Splatting)
  - <asset>_360_preview.mp4 (360-degree turnaround comparison video)
  - <asset>_views.png (4-view preview sheet)
Also creates /content/trellis_fishing_assets.tar.gz for fast batch download.
"""
import gc
import json
import os
import subprocess
import sys
import tarfile
import time
from pathlib import Path

import imageio
import numpy as np
import torch
from PIL import Image

WORK_DIR = Path("/content/TRELLIS")
os.chdir(WORK_DIR)
if str(WORK_DIR) not in sys.path:
    sys.path.insert(0, str(WORK_DIR))

ATTN_BACKEND = "auto"
SPCONV_ALGO = "native"
IMAGE_MODEL_ID = "microsoft/TRELLIS-image-large"

os.environ["SPCONV_ALGO"] = SPCONV_ALGO
if ATTN_BACKEND == "auto":
    cc_major, _ = torch.cuda.get_device_capability(0)
    if cc_major >= 8:
        try:
            import flash_attn  # noqa: F401
            os.environ["ATTN_BACKEND"] = "flash-attn"
        except ImportError:
            os.environ["ATTN_BACKEND"] = "xformers"
    else:
        os.environ["ATTN_BACKEND"] = "xformers"
else:
    os.environ["ATTN_BACKEND"] = ATTN_BACKEND

print(f"ATTN_BACKEND = {os.environ['ATTN_BACKEND']} | SPCONV_ALGO = {os.environ['SPCONV_ALGO']}", flush=True)

# 1. open3d compatibility shim for Python 3.12+
try:
    import open3d as o3d  # noqa: F401
except ImportError:
    import types
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "open3d"], check=False)
    try:
        import open3d as o3d  # noqa: F401
    except ImportError:
        import trimesh
        o3d_mod, geom_mod, util_mod, io_mod = (
            types.ModuleType("open3d"),
            types.ModuleType("open3d.geometry"),
            types.ModuleType("open3d.utility"),
            types.ModuleType("open3d.io"),
        )

        class _TriangleMesh:
            def __init__(self, vertices=None, triangles=None):
                self.vertices = np.asarray(vertices, dtype=np.float64) if vertices is not None else np.zeros((0, 3))
                self.triangles = np.asarray(triangles, dtype=np.int32) if triangles is not None else np.zeros((0, 3), dtype=np.int32)

        class _Voxel:
            def __init__(self, grid_index):
                self.grid_index = grid_index

        class _VoxelGrid:
            def __init__(self, voxels):
                self._voxels = voxels

            def get_voxels(self):
                return self._voxels

            @staticmethod
            def create_from_triangle_mesh_within_bounds(input, voxel_size, min_bound, max_bound):
                tm = trimesh.Trimesh(vertices=np.asarray(input.vertices), faces=np.asarray(input.triangles), process=False)
                pts = tm.voxelized(pitch=voxel_size).points
                idx = np.floor((pts - np.asarray(min_bound)) / voxel_size).astype(np.int32)
                valid = np.all((idx >= 0) & (idx < 64), axis=1)
                return _VoxelGrid([_Voxel(i) for i in idx[valid]])

        geom_mod.TriangleMesh = _TriangleMesh
        geom_mod.VoxelGrid = _VoxelGrid
        util_mod.Vector3dVector = lambda a: np.asarray(a, dtype=np.float64)
        util_mod.Vector3iVector = lambda a: np.asarray(a, dtype=np.int32)
        io_mod.read_triangle_mesh = lambda p: _TriangleMesh(*((lambda m: (m.vertices, m.faces))(trimesh.load(p, force="mesh"))))
        o3d_mod.geometry, o3d_mod.utility, o3d_mod.io = geom_mod, util_mod, io_mod
        sys.modules["open3d"] = o3d_mod
        sys.modules["open3d.geometry"] = geom_mod
        sys.modules["open3d.utility"] = util_mod
        sys.modules["open3d.io"] = io_mod
        print("Enabled trimesh-based open3d compatibility shim.", flush=True)

# 2. kaolin compatibility shim
try:
    from kaolin.utils.testing import check_tensor as _check_tensor  # noqa: F401
except Exception:
    import types
    _k_mod, _ku_mod, _kut_mod = (
        types.ModuleType("kaolin"),
        types.ModuleType("kaolin.utils"),
        types.ModuleType("kaolin.utils.testing"),
    )

    def _check_tensor_fn(tensor, shape=None, dtype=None, device=None, throw=True):
        if not isinstance(tensor, torch.Tensor):
            if throw:
                raise TypeError(f"Expected torch.Tensor, got {type(tensor)}")
            return False
        if shape is not None:
            if len(shape) != tensor.ndim:
                if throw:
                    raise ValueError(f"Expected {len(shape)}D tensor, got {tensor.ndim}D")
                return False
            for d_i, exp_d in enumerate(shape):
                if exp_d is not None and tensor.shape[d_i] != exp_d:
                    if throw:
                        raise ValueError(f"Shape mismatch at dim {d_i}: expected {shape}, got {tuple(tensor.shape)}")
                    return False
        if dtype is not None and tensor.dtype != dtype:
            if throw:
                raise ValueError(f"Expected dtype {dtype}, got {tensor.dtype}")
            return False
        return True

    _kut_mod.check_tensor = _check_tensor_fn
    _ku_mod.testing = _kut_mod
    _k_mod.utils = _ku_mod
    sys.modules["kaolin"] = _k_mod
    sys.modules["kaolin.utils"] = _ku_mod
    sys.modules["kaolin.utils.testing"] = _kut_mod
    print("Enabled kaolin compatibility shim.", flush=True)

os.environ["CUMM_DISABLE_JIT"] = "1"
os.environ["SPCONV_DISABLE_JIT"] = "1"
try:
    import pccm.utils
    pccm.utils.project_is_editable = lambda *a, **kw: False
except ImportError:
    pass

# 3. xformers.ops SDPA bridge
try:
    import xformers.ops as _xops  # noqa: F401
except Exception:
    import types
    import torch.nn.functional as F
    _xf_mod, _xops_mod, _fmha_mod = (
        types.ModuleType("xformers"),
        types.ModuleType("xformers.ops"),
        types.ModuleType("xformers.ops.fmha"),
    )

    class _BlockDiagonalMask:
        def __init__(self, q_seqlen, kv_seqlen=None):
            self.q_seqlen = list(q_seqlen)
            self.kv_seqlen = list(kv_seqlen) if kv_seqlen is not None else list(q_seqlen)

        @classmethod
        def from_seqlens(cls, q_seqlen, kv_seqlen=None):
            return cls(q_seqlen, kv_seqlen)

    def _memory_efficient_attention(q, k, v, attn_bias=None, p=0.0, scale=None):
        if attn_bias is None or len(attn_bias.q_seqlen) == 1:
            return F.scaled_dot_product_attention(
                q.transpose(1, 2), k.transpose(1, 2), v.transpose(1, 2), dropout_p=p, scale=scale
            ).transpose(1, 2)
        q_lens, kv_lens = attn_bias.q_seqlen, attn_bias.kv_seqlen
        q_0, k_0, v_0 = q[0], k[0], v[0]
        out = torch.empty((q_0.shape[0], q_0.shape[1], v_0.shape[2]), dtype=q.dtype, device=q.device)
        q_splits = torch.split(q_0, q_lens, dim=0)
        k_splits = torch.split(k_0, kv_lens, dim=0)
        v_splits = torch.split(v_0, kv_lens, dim=0)
        groups, q_offsets = {}, [0]
        for ql in q_lens:
            q_offsets.append(q_offsets[-1] + ql)
        for idx, pair in enumerate(zip(q_lens, kv_lens)):
            groups.setdefault(pair, []).append(idx)
        for _, indices in groups.items():
            qb = torch.stack([q_splits[i] for i in indices], dim=0).transpose(1, 2)
            kb = torch.stack([k_splits[i] for i in indices], dim=0).transpose(1, 2)
            vb = torch.stack([v_splits[i] for i in indices], dim=0).transpose(1, 2)
            ob = F.scaled_dot_product_attention(qb, kb, vb, dropout_p=p, scale=scale).transpose(1, 2)
            for b_idx, i in enumerate(indices):
                out[q_offsets[i]:q_offsets[i + 1]] = ob[b_idx]
        return out.unsqueeze(0)

    _fmha_mod.BlockDiagonalMask = _BlockDiagonalMask
    _xops_mod.fmha = _fmha_mod
    _xops_mod.memory_efficient_attention = _memory_efficient_attention
    _xf_mod.ops = _xops_mod
    sys.modules["xformers"] = _xf_mod
    sys.modules["xformers.ops"] = _xops_mod
    sys.modules["xformers.ops.fmha"] = _fmha_mod
    print("Enabled PyTorch SDPA bridge for xformers.ops.", flush=True)

from trellis.pipelines import TrellisImageTo3DPipeline
from trellis.utils import postprocessing_utils, render_utils

print(f"Loading {IMAGE_MODEL_ID}...", flush=True)
pipeline = TrellisImageTo3DPipeline.from_pretrained(IMAGE_MODEL_ID)
pipeline.cuda()
try:
    import rembg
    pipeline.rembg_session = rembg.new_session("u2net", providers=["CPUExecutionProvider"])
except Exception as e:
    print(f"rembg session note: {e}", flush=True)

REF_DIR = Path("/content/refs")
if not REF_DIR.exists() and Path("/content/refs_bundle.tar.gz").exists():
    with tarfile.open("/content/refs_bundle.tar.gz", "r:gz") as tar:
        tar.extractall("/content")
    print("Extracted /content/refs_bundle.tar.gz -> /content/refs", flush=True)
OUTPUT_ROOT = Path("/content/trellis_outputs")
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

ASSETS = [
    # 1. Scene props
    ("wooden_pier", "wooden_pier_ref.png", "木製碼頭 (Wooden Pier)"),
    ("pine_tree", "pine_tree_ref.png", "湖畔松樹 (Lakeside Pine Tree)"),
    ("lakeside_rock", "lakeside_rock_ref.png", "湖岸青苔岩石 (Lakeside Mossy Rock)"),
    # 2. First-person & fishing gear
    ("first_person_hands", "first_person_hands_ref.png", "第一人稱釣手雙手 (First-Person Hands)"),
    ("fishing_rod", "fishing_rod_ref.png", "紡車魚竿含捲線器 (Spinning Fishing Rod)"),
    ("fishing_bobber", "fishing_bobber_ref.png", "紅白浮標 (Fishing Bobber)"),
    ("earthworm_bait", "earthworm_bait_ref.png", "蚯蚓魚餌與魚鉤 (Earthworm Bait on Hook)"),
    # 3. Version 1 Fish Species
    ("largemouth_bass", "largemouth_bass_ref.png", "鱸魚 (Largemouth Bass · 0.5-3 kg)"),
    ("common_carp", "common_carp_ref.png", "鯉魚 (Common Carp · 1-8 kg)"),
    ("northern_pike", "northern_pike_ref.png", "狗魚 (Northern Pike · 3-15 kg)"),
    # 4. Reward prop
    ("gold_coin", "gold_coin_ref.png", "釣魚獎勵金幣 (Reward Gold Coin)"),
]

manifest = []

for idx, (asset_name, ref_filename, label) in enumerate(ASSETS, start=1):
    t0 = time.time()
    input_path = REF_DIR / ref_filename
    if not input_path.exists():
        raise FileNotFoundError(f"Missing reference image: {input_path}")

    out_dir = OUTPUT_ROOT / asset_name
    out_dir.mkdir(parents=True, exist_ok=True)
    glb_path = out_dir / f"{asset_name}.glb"
    ply_path = out_dir / f"{asset_name}_gaussian.ply"
    mp4_path = out_dir / f"{asset_name}_360_preview.mp4"
    sheet_path = out_dir / f"{asset_name}_views.png"

    if glb_path.exists() and glb_path.stat().st_size > 1024:
        print(f"[{idx}/{len(ASSETS)}] Skipping {asset_name} (already generated: {glb_path})", flush=True)
    else:
        input_img = Image.open(input_path)
        print(f"\n[{idx}/{len(ASSETS)}] Generating {label} [{asset_name}] from {input_path.name} ({input_img.size[0]}x{input_img.size[1]})...", flush=True)

        outputs = pipeline.run(
            input_img,
            seed=42,
            sparse_structure_sampler_params={"steps": 14, "cfg_strength": 7.5},
            slat_sampler_params={"steps": 14, "cfg_strength": 3.0},
        )

        gs = outputs["gaussian"][0]
        mesh = outputs["mesh"][0]

        gs.save_ply(str(ply_path))
        glb = postprocessing_utils.to_glb(
            gs,
            mesh,
            simplify=0.95,
            texture_size=1024,
        )
        glb.export(str(glb_path))

        num_frames = 96
        video_gs = render_utils.render_video(gs, num_frames=num_frames)["color"]
        video_mesh = render_utils.render_video(mesh, num_frames=num_frames)["normal"]
        video_combined = [np.concatenate([g, m], axis=1) for g, m in zip(video_gs, video_mesh)]
        imageio.mimsave(str(mp4_path), video_combined, fps=24)

        indices = [0, num_frames // 4, num_frames // 2, (3 * num_frames) // 4]
        top = np.concatenate([video_combined[indices[0]], video_combined[indices[1]]], axis=1)
        bot = np.concatenate([video_combined[indices[2]], video_combined[indices[3]]], axis=1)
        sheet = np.concatenate([top, bot], axis=0)
        Image.fromarray(sheet).save(sheet_path)

        del outputs, gs, mesh, glb, video_gs, video_mesh, video_combined
        gc.collect()
        torch.cuda.empty_cache()

        dt = time.time() - t0
        print(f"  -> Done {asset_name} in {dt:.1f}s | GLB: {glb_path.stat().st_size / (1024*1024):.2f} MB", flush=True)

    import trimesh
    tm = trimesh.load(str(glb_path), force="mesh")
    manifest.append({
        "asset_name": asset_name,
        "label": label,
        "glb_size_mb": round(glb_path.stat().st_size / (1024 * 1024), 2),
        "vertices": int(len(tm.vertices)),
        "faces": int(len(tm.faces)),
    })

manifest_path = OUTPUT_ROOT / "trellis_manifest.json"
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(f"\nWrote manifest to {manifest_path}", flush=True)

bundle_path = Path("/content/trellis_fishing_assets.tar.gz")
with tarfile.open(bundle_path, "w:gz") as tar:
    tar.add(str(OUTPUT_ROOT), arcname="trellis_outputs")
print(f"Bundled all 11 TRELLIS assets to {bundle_path} ({bundle_path.stat().st_size / (1024*1024):.2f} MB)", flush=True)

del pipeline
gc.collect()
torch.cuda.empty_cache()
print("Released TRELLIS pipeline VRAM cleanly.", flush=True)
