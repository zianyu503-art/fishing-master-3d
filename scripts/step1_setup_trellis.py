"""Step 1: Check GPU and install Microsoft TRELLIS + CUDA rendering dependencies.
Adapted from TRELLIS_3D_Generation_Colab.ipynb (Cell 1).
"""
import os
import subprocess
import sys
from pathlib import Path

import torch

if not torch.cuda.is_available():
    raise RuntimeError("No CUDA GPU detected!")

gpu_name = torch.cuda.get_device_name(0)
cc_major, cc_minor = torch.cuda.get_device_capability(0)
vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
print(f"GPU: {gpu_name} (CC {cc_major}.{cc_minor}, VRAM: {vram_gb:.1f} GB)")
print(f"PyTorch: {torch.__version__} | CUDA: {torch.version.cuda} | Python: {sys.version.split()[0]}")

WORK_DIR = Path("/content/TRELLIS")
if not (WORK_DIR / "trellis").exists():
    if WORK_DIR.exists():
        import shutil
        shutil.rmtree(WORK_DIR)
    print("Cloning microsoft/TRELLIS...", flush=True)
    subprocess.run(
        ["git", "clone", "--recursive", "https://github.com/microsoft/TRELLIS.git", str(WORK_DIR)],
        check=True,
    )

os.chdir(WORK_DIR)
if str(WORK_DIR) not in sys.path:
    sys.path.insert(0, str(WORK_DIR))

marker_file = WORK_DIR / ".colab_deps_installed"
if not marker_file.exists():
    print("Installing base Python dependencies...", flush=True)
    subprocess.run(
        [
            sys.executable, "-m", "pip", "install",
            "easydict", "opencv-python-headless", "scipy", "ninja", "rembg", "onnxruntime",
            "trimesh", "open3d", "pyvista", "pymeshfix", "igraph", "xatlas",
            "imageio", "imageio-ffmpeg", "plyfile", "tqdm", "einops", "transformers", "accelerate",
            "huggingface_hub", "gradio==4.44.1", "gradio_litmodel3d==0.0.1",
        ],
        check=False,
    )

    print("Installing utils3d...", flush=True)
    subprocess.run(
        [
            sys.executable, "-m", "pip", "install",
            "git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8",
        ],
        check=True,
    )

    print("Installing spconv-cu118...", flush=True)
    subprocess.run([sys.executable, "-m", "pip", "install", "spconv-cu118"], check=True)

    # Patch pccm so prebuilt spconv doesn't trigger ninja JIT recompilation on Colab Python 3.12/3.13
    for py_ver in ("python3.11", "python3.12", "python3.13"):
        pccm_utils = Path(f"/usr/local/lib/{py_ver}/dist-packages/pccm/utils.py")
        if pccm_utils.exists():
            txt = pccm_utils.read_text()
            if "return False  # patched for colab" not in txt:
                pccm_utils.write_text(
                    txt.replace(
                        "def project_is_editable(package_name: str) -> bool:",
                        "def project_is_editable(package_name: str) -> bool:\n    return False  # patched for colab",
                    )
                )

    print("Installing nvdiffrast, diffoctreerast, and diff-gaussian-rasterization...", flush=True)
    subprocess.run(
        [
            sys.executable, "-m", "pip", "install", "--no-build-isolation",
            "git+https://github.com/NVlabs/nvdiffrast.git",
        ],
        check=True,
    )
    subprocess.run(
        [
            sys.executable, "-m", "pip", "install", "--no-build-isolation",
            "git+https://github.com/JeffreyXiang/diffoctreerast.git",
        ],
        check=True,
    )
    subprocess.run(
        [
            sys.executable, "-m", "pip", "install", "--no-build-isolation",
            "git+https://github.com/autonomousvision/mip-splatting.git#subdirectory=submodules/diff-gaussian-rasterization",
        ],
        check=True,
    )

    marker_file.write_text("ok")
    print("TRELLIS environment setup complete!")
else:
    print("TRELLIS environment already installed, skipping.")
