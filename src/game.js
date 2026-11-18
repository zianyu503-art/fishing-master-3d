import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import { FishingAudio } from "./audio.js";
import { loadAllFishingAssets, createWaterNormalTexture } from "./models.js";

const CLOUDFLARE_API_ORIGIN =
  window.FISHING_CF_API ||
  (typeof window !== "undefined" && window.location.hostname.endsWith(".workers.dev")
    ? ""
    : "https://fishing-master-3d.fishing-master-3d.workers.dev");

const SPECIES_DB = [
  {
    id: "largemouth_bass",
    name: "鱸魚",
    enName: "Largemouth Bass",
    thumb: "./refs/largemouth_bass_ref.png",
    difficulty: "容易",
    diffColor: "#34d399",
    minKg: 0.5,
    maxKg: 3.0,
    weightPower: 1.35,
    fightStrength: 0.78,
    staminaDrainRate: 21.0,
    reelSpeed: 3.5,
    baseGold: 95,
    xp: 35,
    spawnWeight: 0.34,
    desc: "棲息於翡翠湖淺灘與木樁暗影處的掠食魚類，咬訊乾脆，適合新手練習控線手感。",
  },
  {
    id: "rainbow_trout",
    name: "虹鱒",
    enName: "Rainbow Trout",
    thumb: "./refs/rainbow_trout_ref.webp",
    difficulty: "普通",
    diffColor: "#38bdf8",
    minKg: 0.8,
    maxKg: 5.5,
    weightPower: 1.4,
    fightStrength: 0.95,
    staminaDrainRate: 17.5,
    reelSpeed: 3.0,
    baseGold: 165,
    xp: 55,
    spawnWeight: 0.22,
    desc: "來自 Hugging Face 世界魚類庫的冷水迴游魚種，體側帶有彩虹斑紋且躍水洗鰓極為靈活。",
  },
  {
    id: "common_carp",
    name: "鯉魚",
    enName: "Common Carp",
    thumb: "./refs/common_carp_ref.png",
    difficulty: "普通",
    diffColor: "#fbbf24",
    minKg: 1.0,
    maxKg: 8.0,
    weightPower: 1.45,
    fightStrength: 1.08,
    staminaDrainRate: 15.0,
    reelSpeed: 2.7,
    baseGold: 210,
    xp: 70,
    spawnWeight: 0.18,
    desc: "體型厚實飽滿的底棲魚種，耐力持久且喜歡貼底發力拉扯魚線。",
  },
  {
    id: "golden_arowana",
    name: "傳奇金龍魚",
    enName: "Asian Arowana",
    thumb: "./refs/golden_arowana_ref.webp",
    difficulty: "稀有",
    diffColor: "#f59e0b",
    minKg: 1.8,
    maxKg: 8.5,
    weightPower: 1.5,
    fightStrength: 1.24,
    staminaDrainRate: 13.0,
    reelSpeed: 2.5,
    baseGold: 980,
    xp: 180,
    spawnWeight: 0.09,
    desc: "鱗片閃耀金色光澤的稀有觀賞魚皇，身價極高，上鉤後擅長暴衝躍出水面。",
  },
  {
    id: "northern_pike",
    name: "狗魚",
    enName: "Northern Pike",
    thumb: "./refs/northern_pike_ref.png",
    difficulty: "困難",
    diffColor: "#f87171",
    minKg: 3.0,
    maxKg: 15.0,
    weightPower: 1.55,
    fightStrength: 1.42,
    staminaDrainRate: 10.5,
    reelSpeed: 2.15,
    baseGold: 440,
    xp: 130,
    spawnWeight: 0.09,
    desc: "翡翠湖深水區的兇猛掠食霸主，爆發衝刺極猛，衝刺期間強行收線極易斷線！",
  },
  {
    id: "wels_catfish",
    name: "巨型湖鯰",
    enName: "Wels Catfish",
    thumb: "./refs/wels_catfish_ref.webp",
    difficulty: "困難",
    diffColor: "#fb923c",
    minKg: 4.0,
    maxKg: 32.0,
    weightPower: 1.6,
    fightStrength: 1.52,
    staminaDrainRate: 9.2,
    reelSpeed: 1.95,
    baseGold: 760,
    xp: 210,
    spawnWeight: 0.07,
    desc: "潛伏於翡翠湖深坑底部的巨無霸鯰魚，極為沉重，非常容易打破重量排行榜紀錄。",
  },
  {
    id: "electric_eel",
    name: "巨型電鰻",
    enName: "Electric Eel",
    thumb: "./refs/electric_eel_ref.webp",
    difficulty: "極稀有",
    diffColor: "#22d3ee",
    isElectric: true,
    minKg: 3.5,
    maxKg: 22.0,
    weightPower: 1.5,
    fightStrength: 1.58,
    staminaDrainRate: 9.8,
    reelSpeed: 2.05,
    baseGold: 1350,
    xp: 260,
    spawnWeight: 0.08,
    desc: "體內能釋放高壓藍電流的奇異電鰻！周身放電時切勿強拉，捕獲後電擊武器威力倍增。",
  },
  {
    id: "great_white_shark",
    name: "狂暴大白鯊",
    enName: "Great White Shark",
    thumb: "./refs/great_white_shark_ref.webp",
    difficulty: "傳說首領",
    diffColor: "#ef4444",
    isBoss: true,
    minKg: 65.0,
    maxKg: 360.0,
    weightPower: 1.4,
    fightStrength: 1.75,
    staminaDrainRate: 6.5,
    reelSpeed: 1.65,
    baseGold: 2200,
    xp: 480,
    spawnWeight: 0.06,
    desc: "誤入翡翠湖的頂級兇猛獵食者！上鉤後會撲咬攻擊玩家，按「⚡ 電擊反擊」將其電死即可收服！",
  },
];

const BAITS = [
  { id: "earthworm", name: "蚯蚓", bonusPike: 1.0, biteSpeed: 1.0, cost: 0, desc: "萬用自然活餌，全魚種皆有幾率咬鉤" },
  { id: "corn_dough", name: "香甜玉米餌", bonusCarp: 1.9, bonusTrout: 1.4, bonusArowana: 1.5, biteSpeed: 1.2, cost: 150, desc: "大幅提升鯉魚、虹鱒與金龍魚上鉤機率" },
  { id: "minnow_lure", name: "擬真小魚餌", bonusPike: 2.4, bonusBass: 1.4, bonusCatfish: 1.6, biteSpeed: 1.15, cost: 350, desc: "專攻大口黑鱸、狗魚與巨型湖鯰" },
  { id: "blood_chum", name: "深海血腥餌", bonusShark: 3.8, bonusEel: 2.8, bonusCatfish: 1.8, biteSpeed: 1.25, cost: 600, desc: "誘引狂暴大白鯊與高壓電鰻現身的獵殺特調餌" },
];

const ENV_ORDER = ["lakeside", "pier", "alpine"];
const ENV_TITLES = {
  lakeside: "翡翠湖 · 森林湖畔",
  pier: "翡翠湖 · 晨曦棧橋",
  alpine: "翡翠湖 · 高山群峰",
};

const LEVEL_TITLES = [
  "新手釣手",
  "湖畔釣客",
  "控線好手",
  "搏魚達人",
  "翡翠路亞師",
  "釣魚大師",
];

export class FishingMasterGame {
  constructor() {
    this.audio = new FishingAudio();
    this.canvasWrap = document.getElementById("game-viewport");
    this.ui = this._bindUI();

    // Persistent progression & angler profile
    const saved = this._loadSave();
    this.playerId = saved.playerId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `angler-${Date.now()}-${Math.floor(Math.random() * 9999)}`);
    this.playerName = saved.playerName || `翡翠釣客#${1000 + Math.floor(Math.random() * 8999)}`;
    this.coins = saved.coins ?? 1250;
    this.xp = saved.xp ?? 0;
    this.unlockedBaits = new Set(saved.unlockedBaits ?? ["earthworm"]);
    this.activeBaitId = saved.activeBaitId ?? "earthworm";
    this.compendium = saved.compendium ?? {};
    this.localLeaderboard = saved.localLeaderboard ?? [
      { player_id: "seed-1", player_name: "翡翠老船長", species_id: "great_white_shark", species_name: "狂暴大白鯊", weight_kg: 184.5, coins: 6850, level: 6, total_catches: 24 },
      { player_id: "seed-2", player_name: "高壓獵人阿強", species_id: "electric_eel", species_name: "巨型電鰻", weight_kg: 16.4, coins: 4220, level: 4, total_catches: 16 },
      { player_id: "seed-3", player_name: "路亞小柔", species_id: "wels_catfish", species_name: "巨型湖鯰", weight_kg: 22.8, coins: 2850, level: 3, total_catches: 11 },
    ];
    this._saveProgress();

    // Gameplay state machine: LOADING | IDLE | CHARGING | FLYING | WAITING | APPROACHING | NIBBLE | BITE | FIGHTING | SHOWCASE
    this.state = "LOADING";
    this.isPressingAction = false;
    this.castPower = 0;
    this.castDir = 1;
    this.tension = 0;
    this.stamina = 100;
    this.fishDist = 0;
    this.stateTimer = 0;
    this.nibblePulseTimer = 0;
    this.fishStruggling = false;
    this.struggleCycleTimer = 0;
    this.activeCatch = null;

    // Shark Attack & High-Voltage Electric Shock combat state
    this.playerHP = 100;
    this.sharkHP = 100;
    this.sharkAttackTimer = 2.4;
    this.sharkLunging = false;
    this.eelShockTimer = 2.5;
    this.eelShockActive = false;
    this.shockCooldown = 0;
    this.lightningTimer = 0;
    this.lightningArcs = [];

    // Environment state
    this.envIndex = 0;

    // Player first-person movement & multi-touch state on Wooden Pier
    this.keys = {};
    this.stickX = 0;
    this.stickY = 0;
    this.joystickPointerId = null;
    this.lookPointerId = null;
    this.lastLookX = 0;
    this.lastLookY = 0;
    this.actionPointerId = null;
    this.reelSpinDeg = 0;

    this.playerPos = new THREE.Vector3(0, 2.30, 30.4);
    this.yaw = 0;
    this.pitch = -0.13;
    this.targetYaw = 0;
    this.targetPitch = -0.13;

    // 3D collections
    this.lakeFishPool = [];
    this.hookedFishActor = null;
    this.ripples = [];
    this.splashParticles = [];
    this.water = null;
    this.mooredBoat = null;

    this._initThree();
    this._initTrophyRenderer();
    this._bindEvents();
    this._refreshTopHUD();
    this._bootAssets();
  }

  _bindUI() {
    const $ = (id) => document.getElementById(id);
    return {
      loadingScreen: $("loading-screen"),
      loadingBar: $("loading-bar-fill"),
      loadingText: $("loading-text"),
      spotName: $("ui-spot-name"),
      coins: $("ui-coins"),
      levelText: $("ui-level"),
      xpFill: $("ui-xp-fill"),
      baitName: $("ui-bait-name"),
      distPill: $("dist-pill"),
      dist: $("ui-dist"),
      promptBanner: $("ui-prompt"),
      subHint: $("ui-subhint"),
      castBox: $("cast-meter-box"),
      castFill: $("bar-cast"),
      castVal: $("val-cast"),
      combatPanel: $("combat-hud"),
      tensionFill: $("bar-tension"),
      tensionVal: $("val-tension"),
      staminaFill: $("bar-stamina"),
      staminaVal: $("val-stamina"),
      strikeRing: $("strike-qte"),
      btnAudio: $("btn-audio"),
      btnBook: $("btn-compendium"),
      btnLeaderboard: $("btn-leaderboard"),
      btnBait: $("btn-bait-shop"),
      btnEnvSwitch: $("btn-env-switch"),
      fxOverlay: $("fx-overlay"),
      bossCombatBars: $("boss-combat-bars"),
      sharkHpFill: $("bar-shark-hp"),
      sharkHpVal: $("val-shark-hp"),
      playerHpFill: $("bar-player-hp"),
      playerHpVal: $("val-player-hp"),
      btnElectricShock: $("btn-electric-shock"),
      joystickZone: $("joystick-zone"),
      joystickKnob: $("joystick-knob"),
      btnTouchAction: $("btn-touch-action"),
      touchRingProgress: $("touch-ring-progress"),
      touchReelIcon: $("touch-reel-icon"),
      touchActionLabel: $("touch-action-label"),
      touchActionSub: $("touch-action-sub"),
      btnCancelCast: $("btn-cancel-cast"),
      catchModal: $("catch-modal"),
      catchSpecies: $("catch-species"),
      catchBadge: $("catch-badge"),
      catchWeight: $("catch-weight"),
      catchGold: $("catch-gold"),
      catchXp: $("catch-xp"),
      catchRecord: $("catch-record"),
      btnContinue: $("btn-continue"),
      drawerModal: $("drawer-modal"),
      drawerTitle: $("drawer-title"),
      drawerBody: $("drawer-body"),
      btnDrawerClose: $("btn-drawer-close"),
      toast: $("game-toast"),
    };
  }

  _loadSave() {
    try {
      const raw = localStorage.getItem("fishing_master_3d_save_v1");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  _saveProgress() {
    try {
      localStorage.setItem(
        "fishing_master_3d_save_v1",
        JSON.stringify({
          playerId: this.playerId,
          playerName: this.playerName,
          coins: this.coins,
          xp: this.xp,
          unlockedBaits: Array.from(this.unlockedBaits),
          activeBaitId: this.activeBaitId,
          compendium: this.compendium,
          localLeaderboard: this.localLeaderboard,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  _getLevelInfo() {
    const level = Math.floor(this.xp / 150) + 1;
    const progress = (this.xp % 150) / 150;
    const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
    return { level, progress, title };
  }

  _initThree() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvasWrap.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Ultra-light atmospheric mist so distant photographic HDRI mountains & pine trees stay crisp
    this.scene.fog = new THREE.FogExp2(0xc8e3f0, 0.00035);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 800);
    this.camera.position.copy(this.playerPos);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    const hemi = new THREE.HemisphereLight(0xdff2fe, 0x2c4c3b, 1.05);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 2.25);
    this.sunLight.position.set(42, 68, -32);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 180;
    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    // First-Person Angler Rig attached to Camera
    this.fpRig = new THREE.Group();
    this.camera.add(this.fpRig);

    this.rodPivot = new THREE.Group();
    this.rodPivot.position.set(0.16, -0.27, -0.38);
    this.rodPivot.rotation.set(0.40, 0.10, 0.0);
    this.fpRig.add(this.rodPivot);

    // Floating Bobber + Underwater Dangling Earthworm Group
    this.bobberRig = new THREE.Group();
    this.bobberRig.visible = false;
    this.scene.add(this.bobberRig);

    // Cast Landing Aim Ring on Water
    this.aimMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.46, 40),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
    );
    this.aimMarker.rotation.x = -Math.PI / 2;
    this.aimMarker.position.y = 0.04;
    this.scene.add(this.aimMarker);

    // Catenary 3D Fishing Line
    this.linePointsCount = 24;
    const linePositions = new Float32Array(this.linePointsCount * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    this.fishingLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.9 })
    );
    this.fishingLine.frustumCulled = false;
    this.fishingLine.visible = false;
    this.scene.add(this.fishingLine);

    // Pool of expanding concentric water ripple rings
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.14, 0.21, 36),
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.scene.add(ring);
      this.ripples.push({ mesh: ring, age: 99, maxAge: 1.6 });
    }

    // Pool of 3D water splash droplets
    const dropGeo = new THREE.SphereGeometry(0.038, 6, 6);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(dropGeo, dropMat.clone());
      m.visible = false;
      this.scene.add(m);
      this.splashParticles.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
    }

    // 3D High-Voltage Lightning Arcs (`THREE.Line` jagged cyan/white bolts)
    this.lightningPtsCount = 10;
    for (let i = 0; i < 3; i++) {
      const pts = new Float32Array(this.lightningPtsCount * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({
        color: i === 0 ? 0xe0f2fe : 0x22d3ee,
        transparent: true,
        opacity: 0.95,
      });
      const bolt = new THREE.Line(geo, mat);
      bolt.frustumCulled = false;
      bolt.visible = false;
      this.scene.add(bolt);
      this.lightningArcs.push(bolt);
    }
  }

  _initTrophyRenderer() {
    const box = document.getElementById("trophy-3d-stage");
    const w = Math.min(460, Math.max(260, window.innerWidth - 76));
    const h = Math.round(w * 0.56);
    this.trophyRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.trophyRenderer.setSize(w, h);
    this.trophyRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.trophyRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.trophyRenderer.toneMappingExposure = 1.15;
    box.appendChild(this.trophyRenderer.domElement);

    this.trophyScene = new THREE.Scene();
    this.trophyScene.add(new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.55));
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.5);
    keyLight.position.set(3, 4, 5);
    this.trophyScene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(-4, 2, -3);
    this.trophyScene.add(rimLight);

    this.trophyCam = new THREE.PerspectiveCamera(42, w / h, 0.1, 25);
    this.trophyCam.position.set(0, 0.12, 2.05);
    this.trophyStageGroup = new THREE.Group();
    this.trophyScene.add(this.trophyStageGroup);
    this.trophyFishActor = null;
    this.trophyCoinMesh = null;
  }

  _vibrate(pattern) {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore haptic API restrictions
      }
    }
  }

  async _bootAssets() {
    try {
      this.assets = await loadAllFishingAssets((done, total, key) => {
        const pct = Math.round((done / total) * 100);
        this.ui.loadingBar.style.width = `${pct}%`;
        this.ui.loadingText.textContent = `載入 Hugging Face 實景環境與 TailorRig 模型 (${done}/${total})：${key}...`;
      });

      this._assembleEmeraldLakeWorld();
      this._assembleFirstPersonGear();

      this.ui.loadingScreen.style.opacity = "0";
      setTimeout(() => {
        this.ui.loadingScreen.style.display = "none";
      }, 420);

      this.state = "IDLE";
      this._setPrompt("長按右下輪盤拋竿", "");
      this.ui.promptBanner.classList.add("idle-soft");

      this.clock = new THREE.Clock();
      this._animate = this._animate.bind(this);
      requestAnimationFrame(this._animate);
    } catch (err) {
      console.error("Failed loading 3D assets:", err);
      this.ui.loadingText.textContent = `載入失敗：${err.message}`;
    }
  }

  applyLakeEnvironment(envKey) {
    const env = this.assets.hdrMaps[envKey];
    if (!env) return;

    this.scene.background = env.tex;

    if (this._envRT) this._envRT.dispose();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this._envRT = pmrem.fromEquirectangular(env.tex);
    this.scene.environment = this._envRT.texture;
    this.scene.environmentIntensity = 0.95;
    if (this.trophyScene) {
      this.trophyScene.environment = this._envRT.texture;
    }
    pmrem.dispose();

    const phi = THREE.MathUtils.degToRad(90 - env.sunElevation);
    const theta = THREE.MathUtils.degToRad(env.sunAzimuth);
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta).normalize();
    if (this.sunLight) {
      this.sunLight.position.copy(sunDir).multiplyScalar(80);
    }
    if (this.water && this.water.material && this.water.material.uniforms.sunDirection) {
      this.water.material.uniforms.sunDirection.value.copy(sunDir);
    }

    if (this.ui.spotName) {
      this.ui.spotName.textContent = ENV_TITLES[envKey] || "翡翠湖";
    }
  }

  _assembleEmeraldLakeWorld() {
    // 1. Deep Emerald Lakebed below planar water for realistic underwater refraction/fish depth
    const lakebed = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: 0x072322, roughness: 0.95 })
    );
    lakebed.rotation.x = -Math.PI / 2;
    lakebed.position.y = -2.6;
    lakebed.receiveShadow = true;
    this.scene.add(lakebed);

    // 2. Real Planar Mirror-Reflective Water (`Water.js`) with semi-transparent underwater fish visibility
    this.water = new Water(new THREE.PlaneGeometry(600, 600), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: createWaterNormalTexture(),
      sunDirection: new THREE.Vector3(0.5, 0.6, -0.6).normalize(),
      sunColor: 0xfffbeb,
      waterColor: 0x0a3d3a,
      distortionScale: 1.6,
      fog: false,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.0;
    this.water.material.transparent = true;
    this.water.material.fragmentShader = this.water.material.fragmentShader.replace(
      /(gl_FragColor\s*=\s*vec4\([\s\S]*?),\s*1\.0\s*\)\s*;/,
      "$1, 0.80 );"
    );
    this.water.material.needsUpdate = true;
    this.scene.add(this.water);

    // Apply initial Hugging Face 2K Lakeside HDRI (`lakeside_2k.hdr`)
    this.applyLakeEnvironment(ENV_ORDER[this.envIndex]);

    // 3. Place Foreground Wooden Pier extending out over the mirror water
    this.pierObject = this.assets.pier;
    this.pierObject.position.set(0, 0.82, 32.0);
    this.scene.add(this.pierObject);

    // 4. Moored Hugging Face Wooden Rowboat (`wooden-boat-55118b23.glb`) bobbing beside the pier
    this.mooredBoat = this.assets.boatTemplate.clone();
    this.mooredBoat.position.set(-4.6, -0.08, 28.5);
    this.mooredBoat.rotation.y = 0.25;
    this.scene.add(this.mooredBoat);

    // 5. Flanking Hugging Face Rocky Cliffs behind south shore (`rockcliff-3e3b2d1c.glb`)
    const cliffCoords = [
      [-16, -0.6, 39, 0.4],
      [17, -0.6, 40, -0.5],
      [-28, -0.8, 34, 1.1],
      [29, -0.8, 35, -1.2],
    ];
    cliffCoords.forEach(([x, y, z, ry]) => {
      const cliff = this.assets.cliffTemplate.clone();
      cliff.position.set(x, y, z);
      cliff.rotation.y = ry;
      this.scene.add(cliff);
    });

    // 6. Hugging Face Shoreline Reeds & Water Grass (`weeds-and-grass-7e2b98aa.glb`)
    const reedCoords = [
      [-2.8, -0.15, 34.5],
      [2.9, -0.15, 34.2],
      [-6.2, -0.12, 32.0],
      [5.8, -0.12, 33.0],
      [-9.2, -0.14, 30.8],
      [8.6, -0.14, 31.2],
    ];
    reedCoords.forEach(([x, y, z], i) => {
      const reeds = this.assets.reedsTemplate.clone();
      reeds.position.set(x, y, z);
      reeds.rotation.y = i * 1.15;
      this.scene.add(reeds);
    });

    // 7. Spawn 18 Live TailorRig Skinned Underwater Fish across all 8 species (including Shark & Electric Eel!)
    const poolSpec = [
      "largemouth_bass", "largemouth_bass", "largemouth_bass",
      "rainbow_trout", "rainbow_trout", "rainbow_trout",
      "common_carp", "common_carp",
      "golden_arowana", "golden_arowana",
      "northern_pike", "northern_pike",
      "wels_catfish", "wels_catfish",
      "electric_eel", "electric_eel",
      "great_white_shark", "great_white_shark",
    ];
    poolSpec.forEach((specId, idx) => {
      const actor = this.assets.fishFactory[specId]();
      const homeX = (Math.random() - 0.5) * 28;
      const isDeep = specId === "great_white_shark" || specId === "wels_catfish";
      const homeZ = isDeep ? 12.0 - Math.random() * 16.0 : 22.0 - Math.random() * 24.0;
      const depth = specId === "great_white_shark" ? -0.95 - Math.random() * 0.7 : -0.45 - Math.random() * 1.1;
      actor.group.position.set(homeX, depth, homeZ);
      const heading = Math.random() * Math.PI * 2;
      actor.group.rotation.y = heading;
      this.scene.add(actor.group);
      this.lakeFishPool.push({
        specId,
        actor,
        depth,
        speed: specId === "great_white_shark" ? 1.45 + Math.random() * 0.6 : 0.85 + Math.random() * 0.75,
        turnTarget: heading,
        turnTimer: 1 + Math.random() * 3,
        phaseOffset: idx * 1.7,
        busy: false,
      });
    });
  }

  _assembleFirstPersonGear() {
    // 1. TailorRig 49-joint First-Person Arms + Two-Bone IK attached to camera rig
    this.armsCtrl = this.assets.armsController;
    this.fpRig.add(this.armsCtrl.group);

    // 2. TailorRig 2-chain Skinned Fishing Rod (`rod_blank` + isolated `reel_aux`)
    this.rodCtrl = this.assets.rodController;
    this.rodPivot.add(this.rodCtrl.group);

    // 3. Bobber + Dangling Earthworm Bait
    this.bobberVisual = this.assets.bobberTemplate;
    this.wormVisual = this.assets.wormTemplate;
    this.wormVisual.position.set(0, -0.26, 0);
    this.bobberRig.add(this.bobberVisual);
    this.bobberRig.add(this.wormVisual);
  }

  _bindEvents() {
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Space" && !e.repeat) {
        this._handlePrimaryDown();
      } else if (e.code === "KeyE" && !e.repeat) {
        this._triggerElectricShock();
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      if (e.code === "Space") {
        this._handlePrimaryUp();
      }
    });

    window.addEventListener("contextmenu", (e) => e.preventDefault());

    // Channel A: Virtual Analog Joystick (`joystickPointerId`)
    const joyMaxR = 42;
    const updateStickFromPointer = (clientX, clientY) => {
      const rect = this.ui.joystickZone.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > joyMaxR) {
        dx = (dx / dist) * joyMaxR;
        dy = (dy / dist) * joyMaxR;
      }
      this.stickX = dx / joyMaxR;
      this.stickY = dy / joyMaxR;
      this.ui.joystickKnob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
    };
    const resetStick = () => {
      this.joystickPointerId = null;
      this.stickX = 0;
      this.stickY = 0;
      this.ui.joystickZone.classList.remove("is-moving");
      this.ui.joystickKnob.style.transform = "translate(-50%, -50%)";
    };
    this.ui.joystickZone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.audio.init();
      if (this.joystickPointerId !== null) return;
      this.joystickPointerId = e.pointerId;
      this.ui.joystickZone.classList.add("is-moving");
      try { this.ui.joystickZone.setPointerCapture(e.pointerId); } catch {}
      updateStickFromPointer(e.clientX, e.clientY);
    });
    this.ui.joystickZone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.joystickPointerId) return;
      updateStickFromPointer(e.clientX, e.clientY);
    });
    this.ui.joystickZone.addEventListener("pointerup", (e) => {
      if (e.pointerId === this.joystickPointerId) resetStick();
    });
    this.ui.joystickZone.addEventListener("pointercancel", (e) => {
      if (e.pointerId === this.joystickPointerId) resetStick();
    });

    // Channel B: Dedicated Camera Free-Look Drag on `#game-viewport` (`lookPointerId`)
    this.canvasWrap.addEventListener("pointerdown", (e) => {
      if (this.state === "SHOWCASE" || this.ui.drawerModal.style.display === "flex") return;
      if (e.button !== undefined && e.button !== 0 && e.button !== 2) return;
      this.audio.init();
      if (this.lookPointerId !== null) return;
      this.lookPointerId = e.pointerId;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
      try { this.canvasWrap.setPointerCapture(e.pointerId); } catch {}
    });
    this.canvasWrap.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.lookPointerId) return;
      const dx = e.clientX - this.lastLookX;
      const dy = e.clientY - this.lastLookY;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
      this.targetYaw = THREE.MathUtils.clamp(this.targetYaw - dx * 0.0045, -1.15, 1.15);
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - dy * 0.0036, -0.55, 0.35);
    });
    const endLookDrag = (e) => {
      if (e.pointerId === this.lookPointerId) {
        this.lookPointerId = null;
      }
    };
    this.canvasWrap.addEventListener("pointerup", endLookDrag);
    this.canvasWrap.addEventListener("pointercancel", endLookDrag);

    // Channel C: Primary Fishing Action Wheel (`#btn-touch-action`) + Strike QTE (`#strike-qte`)
    const startActionPress = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.audio.init();
      this._vibrate(18);
      if (this.actionPointerId !== null && this.actionPointerId !== e.pointerId) return;
      this.actionPointerId = e.pointerId;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      this._handlePrimaryDown();
    };
    const endActionPress = (e) => {
      if (e.pointerId !== this.actionPointerId) return;
      this.actionPointerId = null;
      this._handlePrimaryUp();
    };
    this.ui.btnTouchAction.addEventListener("pointerdown", startActionPress);
    this.ui.btnTouchAction.addEventListener("pointerup", endActionPress);
    this.ui.btnTouchAction.addEventListener("pointercancel", endActionPress);

    this.ui.strikeRing.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.audio.init();
      this._vibrate(25);
      if (this.state === "SHARK_AMBUSH") {
        this._triggerElectricShock();
        return;
      }
      this._handlePrimaryDown();
    });

    this.ui.btnCancelCast.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.audio.init();
      if (this.state === "WAITING" || this.state === "APPROACHING" || this.state === "NIBBLE") {
        this._vibrate(12);
        this._releaseApproachingFish();
        this._resetToIdle("已收竿！長按右側輪盤重新拋竿 🎣", "調整站位或方向後再拋竿");
      }
    });

    this.ui.btnAudio.onclick = () => {
      const on = this.audio.toggle();
      this.ui.btnAudio.classList.toggle("is-muted", !on);
      this.ui.btnAudio.innerHTML = on
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
    };

    if (this.ui.btnEnvSwitch) {
      this.ui.btnEnvSwitch.onclick = () => {
        if (!this.assets) return;
        this.envIndex = (this.envIndex + 1) % ENV_ORDER.length;
        const nextKey = ENV_ORDER[this.envIndex];
        this.applyLakeEnvironment(nextKey);
        this._showToast(`已切換湖景：${ENV_TITLES[nextKey]}`);
      };
    }

    this.ui.btnContinue.onclick = () => {
      this.ui.catchModal.style.display = "none";
      this._resetToIdle("長按右下輪盤拋竿", "");
    };

    this.ui.btnBook.onclick = () => this._openCompendiumDrawer();
    if (this.ui.btnLeaderboard) {
      this.ui.btnLeaderboard.onclick = () => this._openLeaderboardDrawer("trophy", "all");
    }
    this.ui.btnBait.onclick = () => this._openBaitDrawer();
    if (this.ui.btnElectricShock) {
      this.ui.btnElectricShock.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.audio.init();
        this._triggerElectricShock();
      });
    }
    this.ui.btnDrawerClose.onclick = () => {
      this.ui.drawerModal.style.display = "none";
    };
    this.ui.drawerModal.addEventListener("pointerdown", (e) => {
      if (e.target === this.ui.drawerModal) {
        this.ui.drawerModal.style.display = "none";
      }
    });
  }

  _handlePrimaryDown() {
    if (this.state === "LOADING" || this.state === "SHOWCASE" || this.ui.drawerModal.style.display === "flex") return;
    this.isPressingAction = true;

    if (this.state === "IDLE") {
      this.state = "CHARGING";
      this.castPower = 0.08;
      this.castDir = 1;
      this.ui.castBox.style.display = "block";
      this.aimMarker.visible = true;
      this._setPrompt("蓄力中... 放開輪盤拋出魚餌", "75%–92% 黃金力度");
    } else if (this.state === "BITE") {
      this._startFishFight();
    } else if (this.state === "WAITING" || this.state === "APPROACHING" || this.state === "NIBBLE") {
      this._showToast("等待咬鉤中，可點右下角「收竿重拋」");
    }
  }

  _handlePrimaryUp() {
    this.isPressingAction = false;
    if (this.state === "CHARGING") {
      this._launchCast();
    }
  }

  _computeLandingPoint(power) {
    const dist = 7.5 + power * 23.5;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return new THREE.Vector3(
      this.playerPos.x + forward.x * dist,
      0.02,
      this.playerPos.z - 1.4 + forward.z * dist
    );
  }

  _launchCast() {
    this.ui.castBox.style.display = "none";
    this.aimMarker.visible = false;
    this.state = "FLYING";
    this.flyProgress = 0;
    this.flyStart = new THREE.Vector3();
    this.rodCtrl.getTipWorldPosition(this.flyStart);
    this.flyEnd = this._computeLandingPoint(this.castPower);
    this.fishDist = this.playerPos.distanceTo(this.flyEnd);

    this.bobberRig.position.copy(this.flyStart);
    this.bobberRig.visible = true;
    this.fishingLine.visible = true;

    this.audio.playCastWhoosh(this.castPower);
    this._setPrompt("魚餌沿拋物線飛出...", `預計落水距離：${this.fishDist.toFixed(1)} m`);
  }

  _pickTargetFishSpecies() {
    const bait = BAITS.find((b) => b.id === this.activeBaitId) || BAITS[0];
    const deepBonus = this.fishDist > 19 ? 1.65 : 1.0;
    const weights = SPECIES_DB.map((sp) => {
      let w = sp.spawnWeight;
      if (sp.id === "largemouth_bass" && bait.bonusBass) w *= bait.bonusBass;
      if (sp.id === "rainbow_trout" && bait.bonusTrout) w *= bait.bonusTrout;
      if (sp.id === "common_carp") w *= (bait.bonusCarp || 1.0) * (this.fishDist > 15 ? 1.25 : 1.0);
      if (sp.id === "golden_arowana") w *= (bait.bonusArowana || 1.0) * (this.fishDist > 14 ? 1.3 : 1.0);
      if (sp.id === "northern_pike") w *= (bait.bonusPike || 1.0) * deepBonus;
      if (sp.id === "wels_catfish") w *= (bait.bonusCatfish || 1.0) * deepBonus;
      if (sp.id === "electric_eel") w *= (bait.bonusEel || 1.0) * deepBonus;
      if (sp.id === "great_white_shark") w *= (bait.bonusShark || 1.0) * (this.fishDist > 18 ? 1.75 : 0.75);
      return w;
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < SPECIES_DB.length; i++) {
      r -= weights[i];
      if (r <= 0) return SPECIES_DB[i];
    }
    return SPECIES_DB[0];
  }

  _triggerScreenFX(cls) {
    if (!this.ui.fxOverlay) return;
    this.ui.fxOverlay.classList.remove("flash-bite", "flash-shock");
    void this.ui.fxOverlay.offsetWidth;
    this.ui.fxOverlay.classList.add(cls);
    clearTimeout(this._fxTimer);
    this._fxTimer = setTimeout(() => {
      this.ui.fxOverlay?.classList.remove("flash-bite", "flash-shock");
    }, 240);
  }

  _updateLightningBolts(fromVec, toVec) {
    for (const bolt of this.lightningArcs) {
      bolt.visible = true;
      const attr = bolt.geometry.attributes.position;
      for (let i = 0; i < this.lightningPtsCount; i++) {
        const u = i / (this.lightningPtsCount - 1);
        const midEnv = Math.sin(u * Math.PI);
        const jitter = 0.55 * midEnv;
        attr.setXYZ(
          i,
          THREE.MathUtils.lerp(fromVec.x, toVec.x, u) + (Math.random() - 0.5) * jitter,
          THREE.MathUtils.lerp(fromVec.y, toVec.y, u) + (Math.random() - 0.5) * jitter * 0.8,
          THREE.MathUtils.lerp(fromVec.z, toVec.z, u) + (Math.random() - 0.5) * jitter
        );
      }
      attr.needsUpdate = true;
    }
  }

  _triggerElectricShock() {
    if (this.state === "SHARK_AMBUSH" && this.activeCatch) {
      this.lightningTimer = 0.45;
      this.audio.playElectricZap(1.35);
      this._triggerScreenFX("flash-shock");
      this._vibrate([35, 20, 50]);
      if (this.rodCtrl) {
        const tip = new THREE.Vector3();
        this.rodCtrl.getTipWorldPosition(tip);
        const target = this.hookedFishActor ? this.hookedFishActor.group.position : this.bobberRig.position;
        this._updateLightningBolts(tip, target);
      }
      this.ui.strikeRing.style.display = "none";
      this.ui.strikeRing.classList.remove("shock-qte");
      this.ui.strikeRing.textContent = "💦 揚竿！";
      this.ui.promptBanner.classList.remove("urgent");
      this._showToast("⚡ 瞬間電擊命中！成功電死狂暴大白鯊！");
      this._completeCatch({ electrocuted: true });
      return;
    }

    if (this.state !== "FIGHTING" || !this.activeCatch || this.shockCooldown > 0) return;
    const sp = this.activeCatch.species;
    const isShark = sp.id === "great_white_shark";
    const isEel = sp.id === "electric_eel";
    this.shockCooldown = isShark ? 1.2 : 2.2;
    this.lightningTimer = 0.30;

    this.audio.playElectricZap(isShark ? 1.15 : 0.95);
    this._triggerScreenFX("flash-shock");
    this._vibrate([25, 18, 35]);

    if (this.rodCtrl) {
      const tip = new THREE.Vector3();
      this.rodCtrl.getTipWorldPosition(tip);
      const target = this.hookedFishActor ? this.hookedFishActor.group.position : this.bobberRig.position;
      this._updateLightningBolts(tip, target);
    }
    this._spawnSplashBurst(this.bobberRig.position.x, this.bobberRig.position.z, 18, 1.1);
    this._spawnRipple(this.bobberRig.position.x, this.bobberRig.position.z, 3.6);

    if (isShark) {
      this.stamina = Math.max(0, this.stamina - 18);
      this.fishStruggling = false;
      this.tension = Math.max(12, this.tension - 16);
      this._showToast("⚡ 先把大白鯊拉上岸，牠撲過來的瞬間再電死牠！");
    } else if (isEel) {
      this.stamina = Math.max(0, this.stamina - 22);
      this.fishStruggling = false;
      this.tension = Math.max(10, this.tension - 15);
      this._showToast("⚡ 電擊壓制了電鰻高壓放電！");
    } else {
      this.stamina = Math.max(0, this.stamina - 14);
      this.fishStruggling = false;
      this.tension = Math.max(8, this.tension - 10);
      this._showToast("⚡ 電擊麻痺目標！趁現在收線！");
    }
  }

  _startSharkAmbush() {
    this.state = "SHARK_AMBUSH";
    this.ambushDuration = 1.95;
    this.ambushTimer = this.ambushDuration;
    this.ambushStartPos = this.hookedFishActor
      ? this.hookedFishActor.group.position.clone()
      : new THREE.Vector3(this.playerPos.x, -0.1, this.playerPos.z - 3.0);

    this.ui.combatPanel.classList.remove("is-visible", "danger-pulse");
    if (this.ui.bossCombatBars) this.ui.bossCombatBars.classList.remove("is-visible");
    if (this.ui.distPill) this.ui.distPill.classList.remove("is-visible");

    this.ui.strikeRing.classList.add("shock-qte");
    this.ui.strikeRing.textContent = "⚡ 瞬間電擊！";
    this.ui.strikeRing.style.display = "flex";
    this.ui.promptBanner.classList.add("urgent");
    this._setPrompt(
      "🦈 大白鯊衝上岸撲向你！瞬間按「⚡ 電擊」！",
      "點擊電擊鈕 / 中央藍圈 / 按 E 鍵把牠電死！"
    );

    this.audio.playSharkAttack();
    this._triggerScreenFX("flash-bite");
    this._vibrate([85, 35, 95]);
    this._spawnSplashBurst(this.ambushStartPos.x, this.ambushStartPos.z, 34, 1.5);
  }

  _spawnRipple(x, z, maxScale = 3.2) {
    const slot = this.ripples.find((r) => r.age >= r.maxAge) || this.ripples[0];
    slot.age = 0;
    slot.maxScale = maxScale;
    slot.mesh.position.set(x, 0.035, z);
    slot.mesh.scale.setScalar(0.5);
    slot.mesh.visible = true;
  }

  _spawnSplashBurst(x, z, count = 18, speedScale = 1.0) {
    let spawned = 0;
    for (const p of this.splashParticles) {
      if (p.life > 0) continue;
      p.life = 0.55 + Math.random() * 0.35;
      p.mesh.position.set(x + (Math.random() - 0.5) * 0.25, 0.06, z + (Math.random() - 0.5) * 0.25);
      const ang = Math.random() * Math.PI * 2;
      const spd = (1.2 + Math.random() * 2.2) * speedScale;
      p.vel.set(Math.cos(ang) * spd * 0.55, (2.4 + Math.random() * 2.6) * speedScale, Math.sin(ang) * spd * 0.55);
      p.mesh.visible = true;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  _releaseApproachingFish() {
    if (this.approachingPoolEntry) {
      this.approachingPoolEntry.busy = false;
      this.approachingPoolEntry = null;
    }
    if (this.hookedFishActor) {
      this.scene.remove(this.hookedFishActor.group);
      this.hookedFishActor = null;
    }
  }

  _startFishFight() {
    this.state = "FIGHTING";
    this.ui.strikeRing.style.display = "none";
    this.ui.promptBanner.classList.remove("urgent", "idle-soft");
    this.ui.combatPanel.classList.add("is-visible");

    const species = this.pendingSpecies || this._pickTargetFishSpecies();
    const u = Math.pow(Math.random(), species.weightPower);
    const weightKg = +(species.minKg + u * (species.maxKg - species.minKg)).toFixed(2);
    const sizeNorm = (weightKg - species.minKg) / (species.maxKg - species.minKg);
    this.activeCatch = { species, weightKg, sizeNorm };

    if (this.approachingPoolEntry) {
      this.approachingPoolEntry.busy = false;
      this.approachingPoolEntry.actor.group.position.y = -1.3;
      this.approachingPoolEntry = null;
    }

    this.hookedFishActor = this.assets.fishFactory[species.id]();
    this.hookedFishActor.setScaleMultiplier(0.85 + sizeNorm * 0.45);
    this.hookedFishActor.group.position.set(this.bobberRig.position.x, -0.22, this.bobberRig.position.z);
    this.scene.add(this.hookedFishActor.group);

    this.tension = 36;
    this.stamina = 100;
    this.fishStruggling = true;
    this.struggleCycleTimer = 1.8;
    this.wormVisual.visible = false;

    this.playerHP = 100;
    this.sharkHP = 100;
    this.sharkAttackTimer = 2.2;
    this.sharkLunging = false;
    this.eelShockTimer = 2.2;
    this.eelShockActive = false;
    this.shockCooldown = 0;
    this.lightningTimer = 0;

    if (species.id === "great_white_shark") {
      this.audio.playSharkAttack();
      this._triggerScreenFX("flash-bite");
      this._spawnSplashBurst(this.bobberRig.position.x, this.bobberRig.position.z, 32, 1.5);
      this._setPrompt(
        "🦈 狂暴大白鯊上鉤！拉上岸瞬間小心牠撲向你！",
        "將牠拉回岸邊時準備瞬間按「⚡ 電擊」！"
      );
    } else if (species.id === "electric_eel") {
      this.audio.playElectricZap(0.7);
      this._spawnSplashBurst(this.bobberRig.position.x, this.bobberRig.position.z, 24, 1.2);
      this._setPrompt(
        "⚡ 巨型電鰻上鉤！留意藍電流放電！",
        "放電時勿強行硬拉，可用「⚡ 電擊反擊」反制！"
      );
    } else {
      this.audio.playSplash(1.0);
      this._spawnSplashBurst(this.bobberRig.position.x, this.bobberRig.position.z, 24, 1.25);
      this._setPrompt(
        "🐟 魚兒上鉤！按住輪盤收線 · 張力過高時鬆手洩力！",
        `水下傳來沉重拉力（難度：${species.difficulty}）`
      );
    }
  }

  _completeCatch({ electrocuted = false } = {}) {
    this.state = "SHOWCASE";
    this.ui.combatPanel.classList.remove("is-visible", "danger-pulse");
    if (this.ui.bossCombatBars) this.ui.bossCombatBars.classList.remove("is-visible");
    if (this.ui.distPill) this.ui.distPill.classList.remove("is-visible");
    this.lightningArcs.forEach((b) => { b.visible = false; });
    this.fishingLine.visible = false;
    this.bobberRig.visible = false;
    this.wormVisual.visible = true;
    if (this.hookedFishActor) {
      this.scene.remove(this.hookedFishActor.group);
      this.hookedFishActor = null;
    }

    const { species, weightKg, sizeNorm } = this.activeCatch;
    let rankLabel = "標準體型";
    let rankBonus = 1.0;
    if (sizeNorm > 0.86) {
      rankLabel = "👑 翡翠湖魚王級！";
      rankBonus = 1.65;
    } else if (sizeNorm > 0.58) {
      rankLabel = "✨ 大物級 (Trophy)";
      rankBonus = 1.3;
    }

    const killBonus = electrocuted && species.id === "great_white_shark" ? 1.25 : 1.0;
    const earnedGold = Math.round(species.baseGold * (0.75 + sizeNorm * 0.85) * rankBonus * killBonus);
    const earnedXp = Math.round(species.xp * rankBonus * killBonus);
    this.coins += earnedGold;
    this.xp += earnedXp;

    const prev = this.compendium[species.id] || { count: 0, maxKg: 0 };
    const isNewRecord = weightKg > prev.maxKg;
    this.compendium[species.id] = {
      count: prev.count + 1,
      maxKg: Math.max(prev.maxKg, weightKg),
    };
    this._saveProgress();
    this._refreshTopHUD();
    this._submitCatchToLeaderboard({ species, weightKg });

    while (this.trophyStageGroup.children.length > 0) {
      this.trophyStageGroup.remove(this.trophyStageGroup.children[0]);
    }
    this.trophyFishActor = this.assets.fishFactory[species.id]();
    this.trophyFishActor.group.rotation.y = Math.PI * 0.48;
    this.trophyFishActor.group.position.set(-0.18, 0.02, 0);
    const fitMap = {
      great_white_shark: 0.44,
      electric_eel: 0.72,
      wels_catfish: 0.76,
      northern_pike: 0.92,
      golden_arowana: 1.15,
      common_carp: 1.15,
      rainbow_trout: 1.25,
      largemouth_bass: 1.32,
    };
    this.trophyFishActor.setScaleMultiplier(fitMap[species.id] || 1.1);
    this.trophyStageGroup.add(this.trophyFishActor.group);

    this.trophyCoinMesh = this.assets.coinTemplate.clone();
    this.trophyCoinMesh.position.set(0.68, 0.24, 0.18);
    this.trophyStageGroup.add(this.trophyCoinMesh);

    this.ui.catchSpecies.textContent = `${species.name} (${species.enName})`;
    this.ui.catchBadge.textContent =
      electrocuted && species.id === "great_white_shark"
        ? "⚡ 成功電死大白鯊！獲得 1.25x 獵鯊獎勵！"
        : `${species.difficulty} · ${rankLabel}`;
    this.ui.catchBadge.style.color = electrocuted ? "#22d3ee" : species.diffColor;
    this.ui.catchWeight.textContent = `${weightKg.toFixed(2)} kg`;
    this.ui.catchGold.textContent = `+${earnedGold} 金幣`;
    this.ui.catchXp.textContent = `+${earnedXp} XP`;
    this.ui.catchRecord.textContent = isNewRecord
      ? `🏆 新紀錄！（個人最大：${weightKg.toFixed(2)} kg ｜ 累計釣獲 ${prev.count + 1} 尾）`
      : `個人最大紀錄：${this.compendium[species.id].maxKg.toFixed(2)} kg ｜ 累計釣獲 ${prev.count + 1} 尾`;

    this.audio.playSuccessFanfare();
    this._vibrate([35, 30, 55]);
    this.ui.catchModal.style.display = "flex";
  }

  _resetToIdle(mainMsg = "長按右下輪盤拋竿", subMsg = "") {
    this.state = "IDLE";
    this.ui.strikeRing.style.display = "none";
    this.ui.strikeRing.classList.remove("shock-qte");
    this.ui.strikeRing.textContent = "💦 揚竿！";
    this.ui.promptBanner.classList.remove("urgent");
    this.ui.combatPanel.classList.remove("is-visible", "danger-pulse");
    if (this.ui.bossCombatBars) this.ui.bossCombatBars.classList.remove("is-visible");
    if (this.ui.distPill) this.ui.distPill.classList.remove("is-visible");
    this.lightningArcs.forEach((b) => { b.visible = false; });
    this.lightningTimer = 0;
    this.eelShockActive = false;
    this.bobberRig.visible = false;
    this.wormVisual.visible = true;
    this.fishingLine.visible = false;
    this.tension = 0;
    this.stamina = 100;
    this.ui.dist.textContent = "-- m";
    this._setPrompt(mainMsg, subMsg);
  }

  _setPrompt(mainText, subText = "") {
    this.ui.promptBanner.textContent = mainText;
    this.ui.promptBanner.classList.toggle("idle-soft", this.state === "IDLE");
    this.ui.subHint.textContent = subText;
  }

  _showToast(msg) {
    this.ui.toast.textContent = msg;
    this.ui.toast.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.ui.toast.classList.remove("show"), 2600);
  }

  _refreshTopHUD() {
    this.ui.coins.textContent = this.coins.toLocaleString();
    const { level, progress, title } = this._getLevelInfo();
    this.ui.levelText.textContent = `LV.${level}`;
    if (this.ui.levelText.parentElement) {
      this.ui.levelText.parentElement.title = `LV.${level} ${title}`;
    }
    this.ui.xpFill.style.width = `${Math.round(progress * 100)}%`;
    const bait = BAITS.find((b) => b.id === this.activeBaitId) || BAITS[0];
    this.ui.baitName.textContent = bait.name;
  }

  _openCompendiumDrawer() {
    const unlockedCount = SPECIES_DB.filter((sp) => Boolean(this.compendium[sp.id])).length;
    this.ui.drawerTitle.textContent = "📖 翡翠湖魚類圖鑑";
    const summaryHtml = `
      <div class="drawer-progress">
        <span>圖鑑收集進度</span>
        <b class="tabular" style="color:#34d399;">${unlockedCount} / ${SPECIES_DB.length} 魚種</b>
      </div>
    `;
    const itemsHtml = SPECIES_DB.map((sp) => {
      const rec = this.compendium[sp.id];
      return `
        <div class="drawer-item">
          <div style="display:flex;align-items:center;gap:12px;">
            <img class="species-thumb ${rec ? "" : "locked"}" src="${sp.thumb}" alt="${sp.name}" />
            <div>
              <div style="font-size:15.5px;font-weight:700;color:${sp.diffColor};">
                ${sp.name} <span style="font-size:12px;color:#94a3b8;font-weight:600;">${sp.enName} · ${sp.difficulty}</span>
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px;">體重區間：${sp.minKg}–${sp.maxKg} kg</div>
              <div style="font-size:12.5px;color:#cbd5e1;margin-top:4px;line-height:1.4;">${sp.desc}</div>
            </div>
          </div>
          <div style="text-align:right;min-width:96px;">
            ${
              rec
                ? `<div class="tabular" style="color:#34d399;font-weight:800;font-size:13.5px;">已獲 ${rec.count} 尾</div>
                   <div class="tabular" style="font-size:11.5px;color:#fbbf24;margin-top:2px;">最大 ${rec.maxKg.toFixed(2)} kg</div>`
                : `<div style="color:#64748b;font-size:12.5px;">尚未釣獲</div>`
            }
          </div>
        </div>
      `;
    }).join("");
    this.ui.drawerBody.innerHTML = summaryHtml + itemsHtml;
    this.ui.drawerModal.style.display = "flex";
  }

  _apiEndpoint(path) {
    return CLOUDFLARE_API_ORIGIN ? `${CLOUDFLARE_API_ORIGIN}${path}` : path;
  }

  async _submitCatchToLeaderboard({ species, weightKg } = {}) {
    const totalCatches = Object.values(this.compendium).reduce((acc, r) => acc + (r.count || 0), 0);
    const { level } = this._getLevelInfo();

    // Update local fallback record immediately
    const idx = this.localLeaderboard.findIndex((r) => r.player_id === this.playerId);
    const prevRec = idx >= 0 ? this.localLeaderboard[idx] : { best_weight_kg: 0, weight_kg: 0 };
    const prevBest = Math.max(prevRec.weight_kg || 0, prevRec.best_weight_kg || 0);
    const useNewBest = weightKg && weightKg >= prevBest;
    const nextRow = {
      player_id: this.playerId,
      player_name: this.playerName,
      species_id: useNewBest ? species.id : (prevRec.species_id || species?.id || ""),
      species_name: useNewBest ? species.name : (prevRec.species_name || species?.name || ""),
      weight_kg: useNewBest ? weightKg : prevBest,
      coins: this.coins,
      level,
      total_catches: totalCatches,
    };
    if (idx >= 0) this.localLeaderboard[idx] = nextRow;
    else this.localLeaderboard.push(nextRow);
    this._saveProgress();

    try {
      await fetch(this._apiEndpoint("/api/leaderboard"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: this.playerId,
          playerName: this.playerName,
          coins: this.coins,
          level,
          totalCatches,
          catch: species && weightKg ? { speciesId: species.id, weightKg } : null,
        }),
      });
    } catch {
      // Offline or local-only fallback already persisted
    }
  }

  async _openLeaderboardDrawer(tab = "trophy", speciesFilter = "all") {
    this.ui.drawerTitle.textContent = "🏆 翡翠湖全球排行榜";
    const filterButtons = tab === "trophy"
      ? `<div class="lb-filters">
          <button class="lb-filter-chip ${speciesFilter === "all" ? "active" : ""}" data-lb-sp="all">全部魚王</button>
          ${SPECIES_DB.map((sp) => `<button class="lb-filter-chip ${speciesFilter === sp.id ? "active" : ""}" data-lb-sp="${sp.id}">${sp.name}</button>`).join("")}
        </div>`
      : "";

    this.ui.drawerBody.innerHTML = `
      <div class="lb-nick-bar">
        <span style="font-size:12px;color:#94a3b8;white-space:nowrap;">釣手暱稱</span>
        <input id="lb-nick-input" type="text" maxlength="18" value="${this.playerName.replace(/"/g, "&quot;")}" />
        <button class="action-chip" id="lb-nick-save" type="button">儲存</button>
      </div>
      <div class="lb-tabs">
        <button class="lb-tab ${tab === "trophy" ? "active" : ""}" data-lb-tab="trophy" type="button">🐟 最大魚王榜</button>
        <button class="lb-tab ${tab === "wealth" ? "active" : ""}" data-lb-tab="wealth" type="button">🪙 總錢數排行</button>
      </div>
      ${filterButtons}
      <div id="lb-rows" style="min-height:140px;font-size:13px;color:#94a3b8;">正在讀取排行榜...</div>
    `;
    this.ui.drawerModal.style.display = "flex";

    this.ui.drawerBody.querySelectorAll("[data-lb-tab]").forEach((b) => {
      b.onclick = () => this._openLeaderboardDrawer(b.getAttribute("data-lb-tab"), speciesFilter);
    });
    this.ui.drawerBody.querySelectorAll("[data-lb-sp]").forEach((b) => {
      b.onclick = () => this._openLeaderboardDrawer("trophy", b.getAttribute("data-lb-sp"));
    });
    const saveBtn = document.getElementById("lb-nick-save");
    const nickInput = document.getElementById("lb-nick-input");
    if (saveBtn && nickInput) {
      saveBtn.onclick = async () => {
        const clean = nickInput.value.trim().slice(0, 18);
        if (!clean) return;
        this.playerName = clean;
        this._saveProgress();
        await this._submitCatchToLeaderboard({});
        this._showToast(`已更新釣手暱稱：${this.playerName}`);
        this._openLeaderboardDrawer(tab, speciesFilter);
      };
    }

    let entries = null;
    try {
      const qs = new URLSearchParams({ type: tab, species: speciesFilter });
      const res = await fetch(this._apiEndpoint(`/api/leaderboard?${qs.toString()}`));
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.entries)) entries = data.entries;
      }
    } catch {
      entries = null;
    }

    if (!entries) {
      let localRows = [...this.localLeaderboard];
      const selfIdx = localRows.findIndex((r) => r.player_id === this.playerId);
      if (selfIdx < 0) {
        localRows.push({
          player_id: this.playerId,
          player_name: this.playerName,
          coins: this.coins,
          level: this._getLevelInfo().level,
          total_catches: Object.values(this.compendium).reduce((a, r) => a + (r.count || 0), 0),
          species_id: "",
          species_name: "",
          weight_kg: 0,
        });
      }
      if (tab === "wealth") {
        entries = localRows.sort((a, b) => (b.coins || 0) - (a.coins || 0));
      } else {
        entries = localRows
          .filter((r) => (r.weight_kg || 0) > 0 && (speciesFilter === "all" || r.species_id === speciesFilter))
          .sort((a, b) => (b.weight_kg || 0) - (a.weight_kg || 0));
      }
    }

    const listEl = document.getElementById("lb-rows");
    if (!listEl) return;
    if (!entries.length) {
      listEl.innerHTML = `<div style="padding:26px;text-align:center;color:#64748b;">尚無此魚種上榜紀錄，快去挑戰吧！</div>`;
      return;
    }

    listEl.innerHTML = entries
      .map((row, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
        const isMe = row.player_id === this.playerId;
        if (tab === "wealth") {
          return `
            <div class="lb-row ${isMe ? "is-me" : ""}">
              <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                <div class="lb-rank tabular">${medal}</div>
                <div style="min-width:0;">
                  <div style="font-size:14px;font-weight:700;color:#f8fafc;">${row.player_name} ${isMe ? '<span style="color:#34d399;font-size:11px;">(你)</span>' : ""}</div>
                  <div class="lb-meta tabular">LV.${row.level || 1} · 累計釣獲 ${row.total_catches || 0} 尾</div>
                </div>
              </div>
              <div class="tabular" style="font-size:14.5px;font-weight:800;color:#fbbf24;white-space:nowrap;">🪙 ${Number(row.coins || 0).toLocaleString()}</div>
            </div>
          `;
        }
        return `
          <div class="lb-row ${isMe ? "is-me" : ""}">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;">
              <div class="lb-rank tabular">${medal}</div>
              <div style="min-width:0;">
                <div style="font-size:14px;font-weight:700;color:#f8fafc;">${row.player_name} ${isMe ? '<span style="color:#34d399;font-size:11px;">(你)</span>' : ""}</div>
                <div class="lb-meta">${row.species_name || "未知魚種"}</div>
              </div>
            </div>
            <div class="tabular" style="font-size:15px;font-weight:800;color:#38bdf8;white-space:nowrap;">${Number(row.weight_kg || 0).toFixed(2)} kg</div>
          </div>
        `;
      })
      .join("");
  }

  _openBaitDrawer() {
    this.ui.drawerTitle.textContent = "🪱 釣具箱 · 切換魚餌";
    this.ui.drawerBody.innerHTML = BAITS.map((b) => {
      const owned = this.unlockedBaits.has(b.id);
      const equipped = this.activeBaitId === b.id;
      return `
        <div class="drawer-item">
          <div>
            <div style="font-size:16px;font-weight:700;">${b.name} ${equipped ? '<span style="color:#34d399;font-size:12px;">[使用中]</span>' : ""}</div>
            <div style="font-size:13px;color:#cbd5e1;margin-top:3px;">${b.desc}</div>
          </div>
          <div>
            <button class="action-chip" data-bait="${b.id}">
              ${equipped ? "已裝備" : owned ? "切換裝備" : `🪙 ${b.cost} 解鎖`}
            </button>
          </div>
        </div>
      `;
    }).join("");

    this.ui.drawerBody.querySelectorAll("[data-bait]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-bait");
        const bait = BAITS.find((x) => x.id === id);
        if (!this.unlockedBaits.has(id)) {
          if (this.coins < bait.cost) {
            this._showToast("金幣不足！多釣幾條魚再來解鎖吧");
            return;
          }
          this.coins -= bait.cost;
          this.unlockedBaits.add(id);
        }
        this.activeBaitId = id;
        this._saveProgress();
        this._refreshTopHUD();
        this._openBaitDrawer();
      };
    });
    this.ui.drawerModal.style.display = "flex";
  }

  _updatePlayerOnPier(dt) {
    if (this.state === "IDLE" || this.state === "WAITING" || this.state === "APPROACHING") {
      const moveSpeed = 3.2 * dt;
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const moveX = (this.keys["KeyD"] ? 1 : 0) - (this.keys["KeyA"] ? 1 : 0) + this.stickX;
      const moveFwd = (this.keys["KeyW"] ? 1 : 0) - (this.keys["KeyS"] ? 1 : 0) - this.stickY;
      const len = Math.hypot(moveX, moveFwd);
      if (len > 0.06) {
        const clamped = Math.min(1, len);
        const nx = moveX / len;
        const nz = moveFwd / len;
        this.playerPos.addScaledVector(forward, nz * clamped * moveSpeed);
        this.playerPos.addScaledVector(right, nx * clamped * moveSpeed);
      }
      this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -1.45, 1.45);
      this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, 25.8, 36.2);
    }

    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 8.0);
    this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 8.0);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.position.copy(this.playerPos);
    this.camera.updateMatrixWorld(true);
  }

  _updateTouchControlsUI(dt) {
    const CIRC = 364;
    const ring = this.ui.touchRingProgress;
    const btn = this.ui.btnTouchAction;
    const icon = this.ui.touchReelIcon;
    const lbl = this.ui.touchActionLabel;
    const sub = this.ui.touchActionSub;
    if (!btn || !ring) return;

    const showCancel = this.state === "WAITING" || this.state === "APPROACHING" || this.state === "NIBBLE";
    const showDist = showCancel || this.state === "BITE" || this.state === "FIGHTING";
    if (this.ui.distPill) {
      this.ui.distPill.classList.toggle("is-visible", showDist);
    }
    if (this.ui.btnCancelCast) {
      this.ui.btnCancelCast.style.display = showCancel ? "inline-flex" : "none";
    }
    if (this.ui.btnElectricShock) {
      const showShock = this.state === "FIGHTING" || this.state === "SHARK_AMBUSH";
      const isAmbush = this.state === "SHARK_AMBUSH";
      this.ui.btnElectricShock.classList.toggle("is-visible", showShock);
      this.ui.btnElectricShock.classList.toggle("urgent-boss", isAmbush);
      this.ui.btnElectricShock.classList.toggle("on-cooldown", !isAmbush && this.shockCooldown > 0);
      this.ui.btnElectricShock.textContent = isAmbush ? "⚡ 瞬間電擊殺鯊！" : "⚡ 電擊反擊";
    }

    btn.classList.remove("state-idle", "state-charging", "state-waiting", "state-bite", "state-fighting");
    if (this.state === "CHARGING") {
      btn.classList.add("state-charging");
      icon.textContent = "🎯";
      icon.style.transform = "rotate(0deg)";
      lbl.textContent = `${Math.round(this.castPower * 100)}%`;
      sub.textContent = "放開拋竿";
      ring.style.strokeDashoffset = (CIRC * (1 - this.castPower)).toFixed(1);
      ring.style.stroke = this.castPower >= 0.75 && this.castPower <= 0.92 ? "#fbbf24" : "#38bdf8";
    } else if (this.state === "BITE") {
      btn.classList.add("state-bite");
      icon.textContent = "💦";
      icon.style.transform = "rotate(0deg)";
      lbl.textContent = "揚竿！";
      sub.textContent = "立即點擊";
      ring.style.strokeDashoffset = "0";
      ring.style.stroke = "#fef08a";
    } else if (this.state === "FIGHTING") {
      btn.classList.add("state-fighting");
      icon.textContent = "🔄";
      if (this.isPressingAction) {
        this.reelSpinDeg = (this.reelSpinDeg + dt * 420) % 360;
      }
      icon.style.transform = `rotate(${this.reelSpinDeg.toFixed(1)}deg)`;
      lbl.textContent = this.isPressingAction ? "收線中" : "放線洩力";
      sub.textContent = `張力 ${Math.round(this.tension)}%`;
      const tRatio = Math.min(1, this.tension / 100);
      ring.style.strokeDashoffset = (CIRC * (1 - tRatio)).toFixed(1);
      ring.style.stroke = this.tension >= 80 ? "#ef4444" : this.tension >= 55 ? "#fbbf24" : "#34d399";
    } else if (showCancel || this.state === "FLYING") {
      btn.classList.add("state-waiting");
      icon.textContent = "⏳";
      icon.style.transform = "rotate(0deg)";
      lbl.textContent = this.state === "NIBBLE" ? "魚兒試探" : "等待咬鉤";
      sub.textContent = "觀察浮標";
      ring.style.strokeDashoffset = CIRC.toFixed(1);
      ring.style.stroke = "#38bdf8";
    } else {
      btn.classList.add("state-idle");
      icon.textContent = "🎣";
      icon.style.transform = "rotate(0deg)";
      lbl.textContent = "按住拋竿";
      sub.textContent = "長按蓄力";
      ring.style.strokeDashoffset = CIRC.toFixed(1);
      ring.style.stroke = "#34d399";
    }
  }

  _updateEnvironment(dt, t) {
    // 1. Planar Mirror Water animation
    if (this.water && this.water.material.uniforms.time) {
      this.water.material.uniforms.time.value += dt * 0.55;
    }

    // 2. Gentle moored wooden boat bobbing beside the pier
    if (this.mooredBoat) {
      this.mooredBoat.position.y = -0.08 + 0.03 * Math.sin(t * 1.5);
      this.mooredBoat.rotation.z = 0.025 * Math.cos(t * 1.2);
    }

    // 3. Expanding surface ripple rings
    for (const r of this.ripples) {
      if (r.age >= r.maxAge) continue;
      r.age += dt;
      const u = r.age / r.maxAge;
      r.mesh.scale.setScalar(0.5 + u * (r.maxScale || 3.0));
      r.mesh.material.opacity = (1 - u) * 0.55;
      if (r.age >= r.maxAge) r.mesh.visible = false;
    }

    // 4. 3D Water Splash Particles
    for (const p of this.splashParticles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= 9.4 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.max(0, p.life * 1.3);
      if (p.life <= 0 || p.mesh.position.y < -0.05) {
        p.life = 0;
        p.mesh.visible = false;
      }
    }

    // 5. Autonomous TailorRig Underwater Fish School AI
    for (const f of this.lakeFishPool) {
      if (f.busy) continue;
      f.actor.updateSwim(t + f.phaseOffset, 4.2 * f.speed, 0.22);
      f.turnTimer -= dt;
      const pos = f.actor.group.position;
      if (f.turnTimer <= 0 || Math.abs(pos.x) > 18 || pos.z > 24.5 || pos.z < -8) {
        const toCenterAngle = Math.atan2(-pos.x + (Math.random() - 0.5) * 12, 12.0 - pos.z);
        f.turnTarget = toCenterAngle;
        f.turnTimer = 2.2 + Math.random() * 3.5;
      }
      let diff = f.turnTarget - f.actor.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      f.actor.group.rotation.y += diff * dt * 1.6;
      const yaw = f.actor.group.rotation.y;
      pos.x += Math.sin(yaw) * f.speed * dt;
      pos.z += Math.cos(yaw) * f.speed * dt;
      pos.y = f.depth + 0.05 * Math.sin(t * 1.4 + f.phaseOffset);
    }
  }

  _animate() {
    requestAnimationFrame(this._animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.getElapsedTime();

    this._updatePlayerOnPier(dt);
    this._updateEnvironment(dt, t);

    let targetBendY = 0.02;
    let targetBendZ = 0.0;
    let targetPivotPitch = 0.40;

    if (this.state === "IDLE") {
      targetPivotPitch = 0.40 + 0.014 * Math.sin(t * 1.8);
    } else if (this.state === "CHARGING") {
      this.castPower += this.castDir * dt * 0.88;
      if (this.castPower >= 1.0) {
        this.castPower = 1.0;
        this.castDir = -1;
      } else if (this.castPower <= 0.12) {
        this.castPower = 0.12;
        this.castDir = 1;
      }
      const pct = Math.round(this.castPower * 100);
      this.ui.castFill.style.width = `${pct}%`;
      this.ui.castVal.textContent = `${pct}%`;

      targetPivotPitch = 0.40 + 0.45 * this.castPower;
      targetBendY = -0.18 * this.castPower;

      const land = this._computeLandingPoint(this.castPower);
      this.aimMarker.position.set(land.x, 0.04, land.z);
      this.aimMarker.scale.setScalar(1.0 + 0.15 * Math.sin(t * 8));
      this.aimMarker.material.opacity = 0.72;
    } else if (this.state === "FLYING") {
      this.flyProgress = Math.min(1.0, this.flyProgress + dt * 1.38);
      this.bobberRig.position.lerpVectors(this.flyStart, this.flyEnd, this.flyProgress);
      this.bobberRig.position.y += Math.sin(this.flyProgress * Math.PI) * (2.6 + this.castPower * 2.8);
      targetPivotPitch = 0.24 + 0.16 * this.flyProgress;
      targetBendY = 0.14 * Math.sin(this.flyProgress * Math.PI * 2) * (1 - this.flyProgress);

      if (this.flyProgress >= 1.0) {
        this.state = "WAITING";
        const bait = BAITS.find((b) => b.id === this.activeBaitId) || BAITS[0];
        this.stateTimer = (1.6 + Math.random() * 2.0) / bait.biteSpeed;
        this.pendingSpecies = this._pickTargetFishSpecies();
        this.audio.playSplash(0.55);
        this._spawnRipple(this.flyEnd.x, this.flyEnd.z, 3.0);
        this._spawnSplashBurst(this.flyEnd.x, this.flyEnd.z, 10, 0.65);
        this.ui.dist.textContent = `${this.fishDist.toFixed(1)} m`;
        this._setPrompt("等待魚兒靠近...", "保持安靜，觀察水面浮標動靜");
      }
    } else if (this.state === "WAITING") {
      this.bobberRig.position.y = 0.03 * Math.sin(t * 2.5);
      this.bobberRig.rotation.z = 0.06 * Math.sin(t * 1.9);
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = "APPROACHING";
        const candidate =
          this.lakeFishPool.find((f) => !f.busy && f.specId === this.pendingSpecies.id) ||
          this.lakeFishPool.find((f) => !f.busy);
        if (candidate) {
          candidate.busy = true;
          this.approachingPoolEntry = candidate;
        }
        this.stateTimer = 2.2;
      }
    } else if (this.state === "APPROACHING") {
      this.bobberRig.position.y = 0.03 * Math.sin(t * 2.8);
      if (this.approachingPoolEntry) {
        const fg = this.approachingPoolEntry.actor.group;
        const targetPos = new THREE.Vector3(this.bobberRig.position.x, -0.32, this.bobberRig.position.z);
        const dir = targetPos.clone().sub(fg.position);
        const d = dir.length();
        if (d > 0.35) {
          dir.normalize();
          fg.rotation.y = Math.atan2(dir.x, dir.z);
          fg.position.addScaledVector(dir, Math.min(d, dt * 3.8));
          this.approachingPoolEntry.actor.updateSwim(t, 7.5, 0.28);
        }
      }
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = "NIBBLE";
        this.stateTimer = 1.6 + Math.random() * 1.3;
        this.nibblePulseTimer = 0;
        this._setPrompt("👀 魚兒靠近 · 浮標輕微晃動！", "先別急著拉，等待浮標猛力下沉！");
      }
    } else if (this.state === "NIBBLE") {
      this.bobberRig.position.y = -0.04 + 0.065 * Math.sin(t * 13.5);
      this.bobberRig.rotation.z = 0.16 * Math.sin(t * 10.0);
      if (this.approachingPoolEntry) {
        this.approachingPoolEntry.actor.updateSwim(t, 9.0, 0.32);
      }
      this.nibblePulseTimer -= dt;
      if (this.nibblePulseTimer <= 0) {
        this.nibblePulseTimer = 0.55;
        this.audio.playNibble();
        this._spawnRipple(this.bobberRig.position.x, this.bobberRig.position.z, 2.1);
      }
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = "BITE";
        this.stateTimer = 1.45;
        this.audio.playStrikeAlert();
        this._vibrate([45, 30, 65]);
        this._spawnRipple(this.bobberRig.position.x, this.bobberRig.position.z, 4.2);
        this._spawnSplashBurst(this.bobberRig.position.x, this.bobberRig.position.z, 20, 1.05);
        this.ui.strikeRing.style.display = "flex";
        this.ui.promptBanner.classList.add("urgent");
        this._setPrompt("💦 魚兒咬鉤！立即點擊揚竿！", "點擊中央圓環或右下角按鈕揚竿刺魚！");
      }
    } else if (this.state === "BITE") {
      this.bobberRig.position.y = -0.28 + 0.05 * Math.sin(t * 22);
      targetPivotPitch = 0.24;
      targetBendY = 0.22 + 0.04 * Math.sin(t * 18);
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this._releaseApproachingFish();
        this._resetToIdle("魚兒吐鉤游走了！按住右下輪盤再次拋竿", "在紅色揚竿提示出現的 1.4 秒內點擊即可刺魚上鉤");
      }
    } else if (this.state === "FIGHTING") {
      const sp = this.activeCatch.species;
      const isShark = sp.id === "great_white_shark";
      const isEel = sp.id === "electric_eel";
      this.shockCooldown = Math.max(0, this.shockCooldown - dt);

      if (this.ui.bossCombatBars) {
        this.ui.bossCombatBars.classList.remove("is-visible");
      }

      if (isEel) {
        this.eelShockTimer -= dt;
        if (this.eelShockTimer <= 0) {
          this.eelShockActive = !this.eelShockActive;
          this.eelShockTimer = this.eelShockActive ? 1.25 : 2.3;
          if (this.eelShockActive) {
            this.audio.playElectricZap(0.5);
            this._spawnRipple(this.bobberRig.position.x, this.bobberRig.position.z, 3.8);
          }
        }
        if (this.eelShockActive) {
          const pFish = this.hookedFishActor ? this.hookedFishActor.group.position : this.bobberRig.position;
          this._updateLightningBolts(
            new THREE.Vector3(pFish.x + (Math.random() - 0.5) * 1.4, 0.28, pFish.z + (Math.random() - 0.5) * 1.4),
            pFish
          );
        }
      }

      this.struggleCycleTimer -= dt;
      if (this.struggleCycleTimer <= 0) {
        this.fishStruggling = !this.fishStruggling;
        this.struggleCycleTimer = this.fishStruggling
          ? 1.3 + Math.random() * 1.5
          : 1.5 + Math.random() * 1.6;
        if (this.fishStruggling) {
          this.audio.playSplash(0.65);
          this._spawnSplashBurst(this.bobberRig.position.x, this.bobberRig.position.z, 12, 0.9);
          this._spawnRipple(this.bobberRig.position.x, this.bobberRig.position.z, 3.4);
        }
      }

      if (this.isPressingAction) {
        const eelBonusTension = isEel && this.eelShockActive ? 26.0 : 0;
        const tensionRise = (this.fishStruggling ? 52.0 : 24.0) * sp.fightStrength + eelBonusTension;
        this.tension += tensionRise * dt;
        const pullSpeed = sp.reelSpeed * (this.fishStruggling ? 0.52 : 1.18);
        this.fishDist = Math.max(isShark ? 2.1 : 0.8, this.fishDist - pullSpeed * dt);
        this.stamina = Math.max(0, this.stamina - sp.staminaDrainRate * dt);
        this.audio.tickReel(this.tension / 100);
        if (this.rodCtrl) this.rodCtrl.spinReel(dt, 14.0);
        if (isEel && this.eelShockActive && Math.random() < dt * 3.5) {
          this._triggerScreenFX("flash-shock");
        }
      } else {
        this.tension = Math.max(8, this.tension - 28.0 * dt);
        if (this.fishStruggling && this.stamina > 15) {
          this.fishDist = Math.min(34, this.fishDist + 1.35 * sp.fightStrength * dt);
        }
        this.stamina = Math.max(0, this.stamina - 3.5 * dt);
      }

      const swayAngle = this.yaw + 0.28 * Math.sin(t * (this.fishStruggling ? 3.2 : 1.5));
      const fx = this.playerPos.x - Math.sin(swayAngle) * this.fishDist;
      const fz = (this.playerPos.z - 1.2) - Math.cos(swayAngle) * this.fishDist;
      this.bobberRig.position.set(fx, -0.06 + 0.07 * Math.sin(t * 15), fz);

      if (this.hookedFishActor) {
        const fg = this.hookedFishActor.group;
        const jumpY = this.fishStruggling ? -0.08 + 0.08 * Math.sin(t * 12) : -0.24;
        fg.position.set(fx, jumpY, fz);
        fg.rotation.y = swayAngle + (this.fishStruggling ? Math.PI + 0.6 * Math.sin(t * 7) : 0.4 * Math.sin(t * 3));
        this.hookedFishActor.updateSwim(t, this.fishStruggling || isShark ? 15.0 : 7.0, 0.34);
      }

      if (this.lightningTimer > 0) {
        this.lightningTimer -= dt;
        if (this.rodCtrl) {
          const tip = new THREE.Vector3();
          this.rodCtrl.getTipWorldPosition(tip);
          const target = this.hookedFishActor ? this.hookedFishActor.group.position : this.bobberRig.position;
          this._updateLightningBolts(tip, target);
        }
      } else if (!(isEel && this.eelShockActive)) {
        this.lightningArcs.forEach((b) => { b.visible = false; });
      }

      const tNorm = Math.min(1, this.tension / 100);
      targetPivotPitch = 0.26 - tNorm * 0.14;
      targetBendY = 0.14 + tNorm * 0.42 + (this.fishStruggling ? 0.04 * Math.sin(t * 24) : 0);
      targetBendZ = 0.11 * Math.sin(t * 3.2);

      if (this.fishStruggling || this.tension > 72) {
        const shake = (0.012 + tNorm * 0.026) * (this.fishStruggling ? 1.25 : 0.6);
        this.camera.position.x += (Math.random() - 0.5) * shake;
        this.camera.position.y += (Math.random() - 0.5) * shake;
      }

      this.ui.dist.textContent = `${this.fishDist.toFixed(1)} m`;

      if (this.tension >= 100) {
        this.audio.playSnap();
        this._vibrate([90, 40, 90]);
        this._showToast("💥 張力超過 100%，魚線斷裂！");
        this._releaseApproachingFish();
        this._resetToIdle("💥 張力過高 · 魚線斷裂！按住右下輪盤重新拋竿", "當魚兒掙扎衝刺、張力變紅時，短暫鬆手即可安全降壓");
      } else if (!isShark && (this.fishDist <= 1.55 || (this.stamina <= 0 && this.fishDist <= 4.0))) {
        this._completeCatch();
      } else if (isShark && (this.fishDist <= 2.35 || (this.stamina <= 0 && this.fishDist <= 4.6))) {
        this._startSharkAmbush();
      }
    } else if (this.state === "SHARK_AMBUSH") {
      this.ambushTimer -= dt;
      const u = THREE.MathUtils.clamp(1 - this.ambushTimer / this.ambushDuration, 0, 1);
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const endPos = this.playerPos.clone().addScaledVector(forward, 0.72);
      endPos.y = this.playerPos.y - 0.36;

      if (this.hookedFishActor) {
        const fg = this.hookedFishActor.group;
        fg.position.lerpVectors(this.ambushStartPos, endPos, Math.pow(u, 0.85));
        fg.position.y += Math.sin(u * Math.PI) * 0.85;
        fg.rotation.y = this.yaw + Math.PI;
        fg.rotation.x = 0.25 * Math.cos(u * Math.PI);
        this.hookedFishActor.updateSwim(t, 20.0, 0.42);
        this.bobberRig.position.copy(fg.position);
      }

      targetPivotPitch = 0.62;
      this.camera.position.x += (Math.random() - 0.5) * 0.032;
      this.camera.position.y += (Math.random() - 0.5) * 0.032;

      if (this.ambushTimer <= 0) {
        this.coins = Math.max(0, this.coins - 120);
        this._saveProgress();
        this._refreshTopHUD();
        this.audio.playSharkAttack();
        this._triggerScreenFX("flash-bite");
        this._vibrate([140, 50, 140]);
        this._showToast("💥 被上岸撲咬的大白鯊撞傷！損失 120 金幣！");
        this._releaseApproachingFish();
        this._resetToIdle("🦈 慢了一步！大白鯊上岸撲咬後掙脫逃走了，下次瞬間按「⚡ 電擊」！", "");
      }
    }

    // Smoothly interpolate TailorRig rod pivot & 3-bone blank bend
    this.rodPivot.rotation.x += (targetPivotPitch - this.rodPivot.rotation.x) * Math.min(1, dt * 10);
    this._smoothBendY = (this._smoothBendY ?? 0) + (targetBendY - (this._smoothBendY ?? 0)) * Math.min(1, dt * 12);
    this._smoothBendZ = (this._smoothBendZ ?? 0) + (targetBendZ - (this._smoothBendZ ?? 0)) * Math.min(1, dt * 10);
    if (this.rodCtrl) {
      this.rodCtrl.setBend(this._smoothBendY, this._smoothBendZ);
    }

    // Solve Two-Bone IK on TailorRig 49-joint FPS Arms so hands grip the rod & turn the reel!
    if (this.armsCtrl && this.rodCtrl) {
      const rightGripWorld = new THREE.Vector3();
      const leftTargetWorld = new THREE.Vector3();
      const rodTipWorld = new THREE.Vector3();
      this.rodCtrl.getRightGripWorldPosition(rightGripWorld);
      if (this.state === "FIGHTING") {
        this.rodCtrl.getReelCrankWorldPosition(leftTargetWorld);
      } else {
        this.rodCtrl.getLeftButtWorldPosition(leftTargetWorld);
      }
      this.rodCtrl.getTipWorldPosition(rodTipWorld);
      this.armsCtrl.updateIK(this.camera, rightGripWorld, leftTargetWorld, rodTipWorld, this.state === "FIGHTING");
    }

    // Update Combat Meters & Danger Pulse
    const tInt = Math.min(100, Math.round(this.tension));
    this.ui.combatPanel.classList.toggle("danger-pulse", this.state === "FIGHTING" && tInt >= 80);
    this.ui.tensionFill.style.width = `${tInt}%`;
    if (tInt >= 80) {
      this.ui.tensionFill.style.background = "linear-gradient(90deg, #f97316, #ef4444)";
      this.ui.tensionVal.textContent = `${tInt}% · 危險！鬆手洩力`;
      this.ui.tensionVal.style.color = "#f87171";
    } else if (tInt >= 55) {
      this.ui.tensionFill.style.background = "linear-gradient(90deg, #10b981, #f59e0b)";
      this.ui.tensionVal.textContent = `${tInt}% · 緊繃`;
      this.ui.tensionVal.style.color = "#fbbf24";
    } else {
      this.ui.tensionFill.style.background = "linear-gradient(90deg, #059669, #34d399)";
      this.ui.tensionVal.textContent = `${tInt}% · 安全`;
      this.ui.tensionVal.style.color = "#34d399";
    }

    const sInt = Math.round(this.stamina);
    this.ui.staminaFill.style.width = `${sInt}%`;
    const stamStatus =
      this.state !== "FIGHTING"
        ? "待命"
        : sInt < 38
        ? "疲勞中"
        : this.fishStruggling
        ? "掙扎衝刺中！"
        : "拉鋸中";
    this.ui.staminaVal.textContent = `${sInt}% · ${stamStatus}`;

    // Update 3D Catenary Fishing Line from TailorRig rod_tip bone to Bobber
    if (this.fishingLine.visible && this.rodCtrl) {
      const tipWorld = new THREE.Vector3();
      this.rodCtrl.getTipWorldPosition(tipWorld);
      const endWorld = this.bobberRig.position;
      const posAttr = this.fishingLine.geometry.attributes.position;
      const sag =
        this.state === "FIGHTING"
          ? Math.max(0.015, (1 - this.tension / 100) * 0.28)
          : this.state === "FLYING"
          ? 0.12
          : 0.42;

      for (let i = 0; i < this.linePointsCount; i++) {
        const u = i / (this.linePointsCount - 1);
        const lx = THREE.MathUtils.lerp(tipWorld.x, endWorld.x, u);
        const lz = THREE.MathUtils.lerp(tipWorld.z, endWorld.z, u);
        const ly = THREE.MathUtils.lerp(tipWorld.y, endWorld.y + 0.08, u) - Math.sin(u * Math.PI) * sag;
        posAttr.setXYZ(i, lx, ly, lz);
      }
      posAttr.needsUpdate = true;
    }

    if (this.state === "SHOWCASE") {
      if (this.trophyFishActor) {
        this.trophyFishActor.updateSwim(t, 3.2, 0.16);
        this.trophyFishActor.group.rotation.y = Math.PI * 0.45 + Math.sin(t * 0.85) * 0.45;
      }
      if (this.trophyCoinMesh) {
        this.trophyCoinMesh.rotation.y = t * 1.8;
      }
      this.trophyRenderer.render(this.trophyScene, this.trophyCam);
    }

    this._updateTouchControlsUI(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.game = new FishingMasterGame();
});
