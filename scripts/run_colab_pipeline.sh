#!/usr/bin/env bash
set -euo pipefail

COLAB="/Users/alex/.local/bin/colab"
ROOT="/Users/alex/.gemini/antigravity/scratch/fishing-master-3d"
SCRIPTS="$ROOT/scripts"
OUT="$ROOT/outputs"
mkdir -p "$OUT"

echo ">>> [1/4] Running Step 2: Microsoft TRELLIS Image-to-3D for all 11 Fishing Master 3D assets..."
"$COLAB" exec -s fishing3d --timeout 0 -f "$SCRIPTS/step2_generate_all_trellis_assets.py"

echo ">>> [2/4] Downloading & extracting 11 TRELLIS 3D models..."
"$COLAB" download -s fishing3d /content/trellis_fishing_assets.tar.gz "$OUT/trellis_fishing_assets.tar.gz"
tar -xzf "$OUT/trellis_fishing_assets.tar.gz" -C "$OUT"

echo ">>> [3/4] Running Step 3: Emerald Lake Disentangled 3D World Map Generation..."
"$COLAB" exec -s fishing3d --timeout 0 -f "$SCRIPTS/step3_generate_emerald_lake_world.py"

echo ">>> [4/4] Downloading & extracting Emerald Lake 3D World Map..."
"$COLAB" download -s fishing3d /content/emerald_lake_map.tar.gz "$OUT/emerald_lake_map.tar.gz"
tar -xzf "$OUT/emerald_lake_map.tar.gz" -C "$OUT"

echo ">>> Stopping Colab session fishing3d to save compute units..."
"$COLAB" stop -s fishing3d

echo ">>> ALL DONE! Contents of $OUT:"
ls -lh "$OUT/trellis_outputs" "$OUT/emerald_lake_map"
