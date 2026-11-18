# 🎣《釣魚大師 3D》(Fishing Master 3D) — 3D 模型資產庫與翡翠湖分層地圖

本專案依據《釣魚大師 3D》遊戲設計方案，透過 **Google Colab CLI (`colab`)** 在雲端 NVIDIA L4 GPU 上完成全套 3D 資產與分層地圖建模：

1. **翡翠湖 3D 分層互動地圖 (`outputs/emerald_lake_map/`)**
   - 採用 **全景深度估計 (`Depth-Anything-V2-Large`) + 語義世界分層 (`SegFormer ADE20K`)** 管線重建，確保瀏覽器遊戲中的**地形河床**與**動態水面**完全分離：
     - `Terrain_Shoreline_And_Lakebed`：`160m × 160m` 連續環湖山林地形與水下 `-6.8m` 河床盆地（含 `2048×2048` PBR Albedo / Normal 貼圖與 `16-bit` 高度圖）。
     - `Water_Surface`：`Y = 0.0m` 獨立高細分（`128×128`）半透明翡翠綠水面網格，可直接掛載 WebGL 即時波紋 Shader、浮標落水射線檢測（Raycast）與水花特效。
     - `Sky_Horizon_Dome`：無縫 360° 晴天湖畔遠山天空穹頂。
   - 提供兩種版本：
     - `emerald_lake_map.glb`：純淨三層分離地圖（適合在程式碼中動態生成樹木、碼頭與魚群）。
     - `emerald_lake_complete_scene.glb`：已預先擺放好木製碼頭、環湖松樹林（glTF Instancing）、湖岸青苔巨石與水下魚群的完整場景。

2. **11 件獨立高精度 3D 模型 (`outputs/trellis_outputs/<asset>/`)**
   - 參照 `TRELLIS_3D_Generation_Colab.ipynb`，使用 **`microsoft/TRELLIS-image-large`** 生成，每件均包含 `.glb`（`1024×1024` 烘焙貼圖網格）、`_gaussian.ply`（3DGS 點雲）、`_360_preview.mp4`（360° 環繞預覽）與 `_views.png`（四視圖）：
     - **場景物件**：`wooden_pier`（木製碼頭）、`pine_tree`（隨風擺動的松樹）、`lakeside_rock`（湖岸青苔岩石）
     - **第一人稱與核心釣具**：`first_person_hands`（第一人稱釣手雙手）、`fishing_rod`（紡車魚竿含捲線器）、`fishing_bobber`（紅白浮標）、`earthworm_bait`（蚯蚓魚餌連魚鉤）
     - **第一版魚類**：`largemouth_bass`（鱸魚 · 容易 0.5–3 kg）、`common_carp`（鯉魚 · 普通 1–8 kg）、`northern_pike`（狗魚 · 困難 3–15 kg）
     - **結算獎勵**：`gold_coin`（躍魚浮雕金幣）

## 快速預覽

在專案根目錄啟動靜態伺服器即可於瀏覽器遊玩：

```bash
python3 -m http.server 8765 -d /Users/alex/.gemini/antigravity/scratch/fishing-master-3d
```
開啟 `http://localhost:8765/index.html` 即可開始垂釣。
