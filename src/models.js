import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const gltfLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();

export function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, (gltf) => resolve(gltf), undefined, reject);
  });
}

export function loadHDR(url) {
  return new Promise((resolve, reject) => {
    rgbeLoader.load(url, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      resolve(tex);
    }, undefined, reject);
  });
}

/**
 * Generates a tileable 512x512 normal map on an offscreen canvas for Three.js planar mirror `Water`.
 */
export function createWaterNormalTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const hField = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const h =
        0.42 * Math.sin(3 * u + 2 * v) +
        0.30 * Math.cos(5 * u - 4 * v + 0.7) +
        0.20 * Math.sin(9 * u + 7 * v - 1.2) +
        0.14 * Math.cos(15 * u - 11 * v + 2.1) +
        0.09 * Math.sin(23 * u + 19 * v);
      hField[y * size + x] = h;
    }
  }

  for (let y = 0; y < size; y++) {
    const yPrev = (y - 1 + size) % size;
    const yNext = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xPrev = (x - 1 + size) % size;
      const xNext = (x + 1) % size;
      const dx = (hField[y * size + xNext] - hField[y * size + xPrev]) * 2.4;
      const dy = (hField[yNext * size + x] - hField[yPrev * size + x]) * 2.4;
      const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + 1.0);
      const idx = (y * size + x) * 4;
      d[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function tuneMaterials(rootObj, { metalness = 0.03, roughness = 0.78 } = {}) {
  rootObj.traverse((c) => {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => {
        if ("metalness" in m) m.metalness = metalness;
        if ("roughness" in m) m.roughness = roughness;
        m.needsUpdate = true;
      });
    }
  });
}

export async function loadAllFishingAssets(onProgress) {
  const manifest = [
    // Real Hugging Face 32-bit Lakeside HDRIs (`TontonTremblay/env_map_hdri`)
    ["hdrLakeside", "outputs/hf_assets/lakeside_2k.hdr", "hdr"],
    ["hdrPier", "outputs/hf_assets/bell_park_pier_2k.hdr", "hdr"],
    ["hdrAlpine", "outputs/hf_assets/lakes_2k.hdr", "hdr"],
    // Hugging Face Photogrammetry / Textured Lakeside Props (`codepawl/objaverse-clean-glb`)
    ["hfBoat", "outputs/hf_assets/wooden-boat-55118b23.glb", "gltf"],
    ["hfCliff", "outputs/hf_assets/rockcliff-3e3b2d1c.glb", "gltf"],
    ["hfReeds", "outputs/hf_assets/weeds-and-grass-7e2b98aa.glb", "gltf"],
    // TailorRig SkinnedMesh Assets (`outputs/tailorrig/`)
    ["armsRigged", "outputs/tailorrig/angler_arms_tailorrig.glb", "gltf"],
    ["anglerCharacter", "outputs/hf_assets/angler_character.glb", "gltf"],
    ["rodRigged", "outputs/tailorrig/fishing_rod_tailorrig.glb", "gltf"],
    ["bassRigged", "outputs/tailorrig/largemouth_bass_tailorrig.glb", "gltf"],
    ["carpRigged", "outputs/tailorrig/common_carp_tailorrig.glb", "gltf"],
    ["pikeRigged", "outputs/tailorrig/northern_pike_tailorrig.glb", "gltf"],
    ["troutRigged", "outputs/tailorrig/rainbow_trout_tailorrig.glb", "gltf"],
    ["catfishRigged", "outputs/tailorrig/wels_catfish_tailorrig.glb", "gltf"],
    ["arowanaRigged", "outputs/tailorrig/golden_arowana_tailorrig.glb", "gltf"],
    ["eelRigged", "outputs/tailorrig/electric_eel_tailorrig.glb", "gltf"],
    ["sharkRigged", "outputs/tailorrig/great_white_shark_tailorrig.glb", "gltf"],
    ["blueTangRigged", "outputs/tailorrig/blue_tang_tailorrig.glb", "gltf"],
    ["piranhaRigged", "outputs/tailorrig/red_bellied_piranha_tailorrig.glb", "gltf"],
    ["salmonRigged", "outputs/tailorrig/sockeye_salmon_tailorrig.glb", "gltf"],
    ["lionfishRigged", "outputs/tailorrig/red_lionfish_tailorrig.glb", "gltf"],
    ["mahiRigged", "outputs/tailorrig/mahi_mahi_tailorrig.glb", "gltf"],
    ["tunaRigged", "outputs/tailorrig/yellowfin_tuna_tailorrig.glb", "gltf"],
    ["sturgeonRigged", "outputs/tailorrig/beluga_sturgeon_tailorrig.glb", "gltf"],
    ["sailfishRigged", "outputs/tailorrig/pacific_sailfish_tailorrig.glb", "gltf"],
    ["sunfishRigged", "outputs/tailorrig/ocean_sunfish_tailorrig.glb", "gltf"],
    ["hammerheadRigged", "outputs/tailorrig/hammerhead_shark_tailorrig.glb", "gltf"],
    // Core TRELLIS Game Props
    ["pier", "outputs/trellis_outputs/wooden_pier/wooden_pier.glb", "gltf"],
    ["bobber", "outputs/trellis_outputs/fishing_bobber/fishing_bobber.glb", "gltf"],
    ["worm", "outputs/trellis_outputs/earthworm_bait/earthworm_bait.glb", "gltf"],
    ["coin", "outputs/trellis_outputs/gold_coin/gold_coin.glb", "gltf"],
  ];

  let done = 0;
  const raw = {};
  await Promise.all(
    manifest.map(async ([key, url, kind]) => {
      raw[key] = kind === "hdr" ? await loadHDR(url) : (await loadGLTF(url)).scene;
      done += 1;
      if (onProgress) onProgress(done, manifest.length, key);
    })
  );

  tuneMaterials(raw.pier, { metalness: 0.02, roughness: 0.86 });
  tuneMaterials(raw.hfBoat, { metalness: 0.04, roughness: 0.78 });
  tuneMaterials(raw.hfCliff, { metalness: 0.03, roughness: 0.88 });
  tuneMaterials(raw.hfReeds, { metalness: 0.02, roughness: 0.82 });
  tuneMaterials(raw.bobber, { metalness: 0.08, roughness: 0.20 });
  tuneMaterials(raw.worm, { metalness: 0.06, roughness: 0.32 });
  tuneMaterials(raw.coin, { metalness: 0.82, roughness: 0.22 });

  return {
    hdrMaps: {
      lakeside: { name: "翡翠森林湖畔", tex: raw.hdrLakeside, sunElevation: 26, sunAzimuth: 42 },
      pier: { name: "晨曦木棧湖灣", tex: raw.hdrPier, sunElevation: 19, sunAzimuth: -35 },
      alpine: { name: "群峰高山翠湖", tex: raw.hdrAlpine, sunElevation: 32, sunAzimuth: 65 },
    },
    pier: buildPierAsset(raw.pier),
    boatTemplate: buildGroundedProp(raw.hfBoat, 4.6),
    cliffTemplate: buildGroundedProp(raw.hfCliff, 14.0),
    reedsTemplate: buildGroundedProp(raw.hfReeds, 2.2),
    rodController: buildTailorRigRodController(raw.rodRigged),
    armsController: buildTailorRigArmsController(raw.armsRigged),
    createRemoteAnglerActor: (opts) => buildRemoteAnglerActor(raw.anglerCharacter, raw.rodRigged, raw.bobber, opts),
    bobberTemplate: buildCleanBobber(raw.bobber),
    wormTemplate: buildCenteredProp(raw.worm, 0.16),
    coinTemplate: buildCenteredProp(raw.coin, 0.44),
    fishFactory: {
      largemouth_bass: () => createTailorRigFishActor(raw.bassRigged, 0.66),
      common_carp: () => createTailorRigFishActor(raw.carpRigged, 0.82),
      northern_pike: () => createTailorRigFishActor(raw.pikeRigged, 1.15),
      rainbow_trout: () => createTailorRigFishActor(raw.troutRigged, 0.72),
      wels_catfish: () => createTailorRigFishActor(raw.catfishRigged, 1.35),
      golden_arowana: () => createTailorRigFishActor(raw.arowanaRigged, 0.85),
      electric_eel: () => createTailorRigFishActor(raw.eelRigged, 1.45),
      great_white_shark: () => createTailorRigFishActor(raw.sharkRigged, 2.85),
      blue_tang: () => createTailorRigFishActor(raw.blueTangRigged, 0.48),
      red_bellied_piranha: () => createTailorRigFishActor(raw.piranhaRigged, 0.56),
      sockeye_salmon: () => createTailorRigFishActor(raw.salmonRigged, 0.84),
      red_lionfish: () => createTailorRigFishActor(raw.lionfishRigged, 0.62),
      mahi_mahi: () => createTailorRigFishActor(raw.mahiRigged, 1.28),
      yellowfin_tuna: () => createTailorRigFishActor(raw.tunaRigged, 1.72),
      beluga_sturgeon: () => createTailorRigFishActor(raw.sturgeonRigged, 2.35),
      pacific_sailfish: () => createTailorRigFishActor(raw.sailfishRigged, 2.20),
      ocean_sunfish: () => createTailorRigFishActor(raw.sunfishRigged, 1.85),
      hammerhead_shark: () => createTailorRigFishActor(raw.hammerheadRigged, 2.65),
    },
  };
}

function buildGroundedProp(sceneObj, targetMaxDim) {
  const clone = sceneObj.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = targetMaxDim / Math.max(size.x, size.y, size.z, 1e-4);

  const group = new THREE.Group();
  clone.position.set(-center.x, -box.min.y, -center.z);
  clone.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  group.add(clone);
  group.scale.setScalar(scale);
  return group;
}

function buildCenteredProp(sceneObj, targetMaxDim) {
  const clone = sceneObj.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = targetMaxDim / Math.max(size.x, size.y, size.z, 1e-4);

  const group = new THREE.Group();
  clone.position.sub(center);
  group.add(clone);
  group.scale.setScalar(scale);
  return group;
}

function buildPierAsset(pierScene) {
  const box = new THREE.Box3().setFromObject(pierScene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = 14.0 / size.x;

  const group = new THREE.Group();
  pierScene.position.set(-center.x, -box.max.y + 0.035, -center.z);
  pierScene.rotation.y = Math.PI / 2;
  pierScene.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  group.add(pierScene);
  group.scale.setScalar(scale);
  return group;
}

/**
 * TailorRig Skinned Fishing Rod Controller (`fishing_rod_tailorrig.glb`):
 *   - Primary Chain: `rod_butt` (+0.34 Z) -> `rod_grip` (+0.16 Z) -> `rod_blank_01..03` -> `rod_tip` (-0.50 Z)
 *   - Auxiliary Chain: `reel_body` -> `reel_crank` (isolated from rod blank flex!)
 */
function buildTailorRigRodController(rodScene, rodScale = 1.68) {
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(rodScene);
  model.traverse((c) => {
    if (c.isMesh) c.frustumCulled = false;
  });

  // Shift so `rod_grip` (z = +0.16) sits near local origin of `root`
  model.position.set(0, 0, -0.18);
  root.add(model);
  root.scale.setScalar(rodScale);

  const bones = {};
  model.traverse((b) => {
    if (b.isBone || b.name) bones[b.name] = b;
  });

  // Locator node right on the cork grip (for Right Hand IK) and butt/reel crank (for Left Hand IK)
  const rightGripAnchor = new THREE.Object3D();
  rightGripAnchor.position.set(0.0, 0.005, 0.02);
  if (bones.rod_grip) bones.rod_grip.add(rightGripAnchor);

  const leftButtAnchor = new THREE.Object3D();
  leftButtAnchor.position.set(0.0, -0.005, 0.14);
  if (bones.rod_butt) bones.rod_butt.add(leftButtAnchor);

  const reelCrankOrbit = new THREE.Object3D();
  reelCrankOrbit.position.set(-0.042, -0.014, 0.028);
  if (bones.reel_body) bones.reel_body.add(reelCrankOrbit);

  let crankAngle = 0;

  return {
    group: root,
    bones,
    setBend(downwardBend, sideBend = 0) {
      // Distribute smooth parabolic skeletal rotation across the 3 blank bones!
      const b1 = bones.rod_blank_01;
      const b2 = bones.rod_blank_02;
      const b3 = bones.rod_blank_03;
      if (b1 && b2 && b3) {
        b1.rotation.set(-downwardBend * 0.32, -sideBend * 0.28, 0);
        b2.rotation.set(-downwardBend * 0.52, -sideBend * 0.42, 0);
        b3.rotation.set(-downwardBend * 0.68, -sideBend * 0.55, 0);
      }
    },
    spinReel(dt, speed = 10.0) {
      crankAngle += dt * speed;
      if (bones.reel_crank) {
        bones.reel_crank.rotation.x = crankAngle;
      }
      reelCrankOrbit.position.set(
        -0.042,
        -0.014 + Math.sin(crankAngle) * 0.028,
        Math.cos(crankAngle) * 0.028
      );
    },
    getTipWorldPosition(outVec) {
      root.updateWorldMatrix(true, true);
      if (bones.rod_tip) return bones.rod_tip.getWorldPosition(outVec);
      return outVec.set(0, 0, -1);
    },
    getRightGripWorldPosition(outVec) {
      root.updateWorldMatrix(true, true);
      return rightGripAnchor.getWorldPosition(outVec);
    },
    getLeftButtWorldPosition(outVec) {
      root.updateWorldMatrix(true, true);
      return leftButtAnchor.getWorldPosition(outVec);
    },
    getReelCrankWorldPosition(outVec) {
      root.updateWorldMatrix(true, true);
      return reelCrankOrbit.getWorldPosition(outVec);
    },
  };
}

/**
 * Analytical Two-Bone IK solver for TailorRig arms where each limb bone extends along its local `+Y` axis!
 */
const _vRoot = new THREE.Vector3();
const _vMid = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _vTarget = new THREE.Vector3();
const _vPole = new THREE.Vector3();
const _dirA = new THREE.Vector3();
const _dirB = new THREE.Vector3();
const _parentQuatInv = new THREE.Quaternion();
const _worldQuat = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

function aimBonePlusYAtWorldPoint(bone, targetWorld, rollRad = 0) {
  bone.parent.updateWorldMatrix(true, false);
  bone.getWorldPosition(_vRoot);
  _dirA.subVectors(targetWorld, _vRoot);
  if (_dirA.lengthSq() < 1e-8) return;
  _dirA.normalize();

  bone.parent.getWorldQuaternion(_parentQuatInv);
  _parentQuatInv.invert();

  _worldQuat.setFromUnitVectors(_yAxis, _dirA);
  if (rollRad !== 0) {
    const twist = new THREE.Quaternion().setFromAxisAngle(_dirA, rollRad);
    _worldQuat.premultiply(twist);
  }
  bone.quaternion.copy(_parentQuatInv).multiply(_worldQuat);
  bone.updateMatrixWorld(true);
}

function solveTwoBoneIKPlusY(upperBone, lowerBone, handBone, targetWorld, poleWorld, upperRoll = 0) {
  upperBone.parent.updateWorldMatrix(true, true);
  upperBone.getWorldPosition(_vRoot);
  lowerBone.getWorldPosition(_vMid);
  handBone.getWorldPosition(_vEnd);

  const L1 = _vRoot.distanceTo(_vMid);
  const L2 = _vMid.distanceTo(_vEnd);
  const toTarget = _vTarget.subVectors(targetWorld, _vRoot);
  const maxReach = (L1 + L2) * 0.992;
  const minReach = Math.abs(L1 - L2) * 1.05;
  const dist = THREE.MathUtils.clamp(toTarget.length(), minReach, maxReach);
  const dirNorm = toTarget.clone().normalize();

  // Law of cosines at shoulder for elbow position in plane spanned by (dirNorm, poleDir)
  const cosAlpha = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  const poleVec = _vPole.subVectors(poleWorld, _vRoot);
  // Orthogonalize poleVec against dirNorm
  poleVec.addScaledVector(dirNorm, -poleVec.dot(dirNorm));
  if (poleVec.lengthSq() < 1e-6) poleVec.set(0, -1, 0);
  poleVec.normalize();

  const elbowWorld = _vRoot
    .clone()
    .addScaledVector(dirNorm, L1 * cosAlpha)
    .addScaledVector(poleVec, L1 * sinAlpha);

  aimBonePlusYAtWorldPoint(upperBone, elbowWorld, upperRoll);
  aimBonePlusYAtWorldPoint(lowerBone, targetWorld, upperRoll * 0.5);
}

/**
 * Hugging Face Rigged First-Person Angler Arms (`angler_arms_tailorrig.glb`, 49 TailorRig joints):
 *   - Oriented with `rotation.y = Math.PI` in camera space so shoulders sit behind camera (`+Z`)
 *     and forearms/hands extend FORWARD (`-Z`) toward the fishing rod & lake!
 *   - Uses Two-Bone IK + finger curl so Right Hand grips the cork handle and Left Hand grips the butt / cranks the reel!
 */
function buildTailorRigArmsController(armsScene) {
  const wrapper = new THREE.Group();
  const model = SkeletonUtils.clone(armsScene);
  model.traverse((c) => {
    if (c.isMesh) {
      c.frustumCulled = false;
      c.castShadow = false;
    }
  });

  // Character in GLB has shoulders at y ≈ +1.32, z ≈ -0.15 facing +Z.
  // Shift shoulders to local (0, 0, 0) and rotate 180° around Y (`Math.PI`) so character faces -Z (same as Three.js camera!!)!
  const orient = new THREE.Group();
  model.position.set(0, -1.33, 0.15);
  orient.rotation.y = Math.PI;
  orient.scale.setScalar(1.36);
  orient.add(model);
  wrapper.add(orient);

  // Place shoulders slightly lower & further back behind camera so upper sleeve cuffs never clip viewport corner
  wrapper.position.set(-0.03, -0.31, 0.17);

  const bones = {};
  model.traverse((b) => {
    if (b.isBone || b.name) bones[b.name] = b;
  });

  // Curl fingers into a natural cylindrical rod grip!
  const curlSideFingers = (suffix, curlAmount = 0.68) => {
    for (const fname of ["index", "middle", "ring", "pinky"]) {
      for (const seg of ["01", "02", "03"]) {
        const match = Object.keys(bones).find((k) => k.startsWith(`${fname}_${seg}_${suffix}`));
        if (match && bones[match]) {
          bones[match].rotation.x = curlAmount;
        }
      }
    }
    for (const seg of ["02", "03"]) {
      const tMatch = Object.keys(bones).find((k) => k.startsWith(`thumb_${seg}_${suffix}`));
      if (tMatch && bones[tMatch]) {
        bones[tMatch].rotation.x = curlAmount * 0.55;
      }
    }
  };
  curlSideFingers("r", 0.72);
  curlSideFingers("l", 0.62);

  const rightPoleLocal = new THREE.Vector3(0.36, -0.46, -0.12);
  const leftPoleLocal = new THREE.Vector3(-0.36, -0.46, -0.12);
  const rightPoleWorld = new THREE.Vector3();
  const leftPoleWorld = new THREE.Vector3();
  const rodDirTip = new THREE.Vector3();

  return {
    group: wrapper,
    bones,
    updateIK(camera, rightTargetWorld, leftTargetWorld, rodTipWorld, isCrankingReel = false) {
      wrapper.updateMatrixWorld(true);
      wrapper.updateWorldMatrix(true, true);
      rightPoleWorld.copy(rightPoleLocal).applyMatrix4(camera.matrixWorld);
      leftPoleWorld.copy(leftPoleLocal).applyMatrix4(camera.matrixWorld);

      if (bones.upperarm_r_020 && bones.lowerarm_r_021 && bones.hand_r_022) {
        solveTwoBoneIKPlusY(
          bones.upperarm_r_020,
          bones.lowerarm_r_021,
          bones.hand_r_022,
          rightTargetWorld,
          rightPoleWorld,
          -0.18
        );
        // Align right wrist cleanly along rod shaft
        rodDirTip.copy(rodTipWorld);
        aimBonePlusYAtWorldPoint(bones.hand_r_022, rodDirTip, -0.42);
      }

      if (bones.upperarm_l_02 && bones.lowerarm_l_03 && bones.hand_l_04) {
        solveTwoBoneIKPlusY(
          bones.upperarm_l_02,
          bones.lowerarm_l_03,
          bones.hand_l_04,
          leftTargetWorld,
          leftPoleWorld,
          0.35
        );
        aimBonePlusYAtWorldPoint(
          bones.hand_l_04,
          isCrankingReel ? rightTargetWorld : rodTipWorld,
          isCrankingReel ? 0.95 : 0.65
        );
      }
      curlSideFingers("r", 0.78);
      curlSideFingers("l", isCrankingReel ? 0.85 : 0.66);
    },
  };
}

function buildCleanBobber(bobberScene) {
  let srcMesh = null;
  bobberScene.traverse((c) => {
    if (c.isMesh && !srcMesh) srcMesh = c;
  });

  const srcGeo = srcMesh.geometry;
  const pos = srcGeo.attributes.position;
  const uv = srcGeo.attributes.uv;
  const norm = srcGeo.attributes.normal;
  const idx = srcGeo.index;

  const newIdx = [];
  if (idx) {
    const ia = idx.array;
    for (let i = 0; i < ia.length; i += 3) {
      const a = ia[i], b = ia[i + 1], c = ia[i + 2];
      if (pos.getZ(a) < -0.19 && pos.getZ(b) < -0.19 && pos.getZ(c) < -0.19) {
        newIdx.push(a, b, c);
      }
    }
  }

  const trimmedGeo = new THREE.BufferGeometry();
  trimmedGeo.setAttribute("position", pos.clone());
  if (norm) trimmedGeo.setAttribute("normal", norm.clone());
  if (uv) trimmedGeo.setAttribute("uv", uv.clone());
  if (newIdx.length > 60) {
    trimmedGeo.setIndex(newIdx);
  } else if (idx) {
    trimmedGeo.setIndex(idx.clone());
  }
  trimmedGeo.computeBoundingBox();
  const center = new THREE.Vector3();
  trimmedGeo.boundingBox.getCenter(center);
  trimmedGeo.translate(-center.x, -center.y, -center.z);

  const cleanMesh = new THREE.Mesh(trimmedGeo, srcMesh.material);
  const group = new THREE.Group();
  group.add(cleanMesh);
  group.scale.setScalar(0.36);
  return group;
}

/**
 * Builds articulated 3D oral anatomy (gums, palate, gullet, tongue & double-row razor teeth)
 * mounted on `bones.head` and `bones.jaw_lower` for Great White Shark jaw opening.
 */
function attachSharkOralAnatomy(bones) {
  if (!bones.head || !bones.jaw_lower) return null;

  const throatMat = new THREE.MeshStandardMaterial({
    color: 0x1b0205,
    roughness: 0.45,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const palateMat = new THREE.MeshStandardMaterial({
    color: 0x5c0a16,
    emissive: 0x180205,
    roughness: 0.28,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const gumMat = new THREE.MeshStandardMaterial({
    color: 0xa11e30,
    emissive: 0x240409,
    roughness: 0.24,
    metalness: 0.02,
  });
  const tongueMat = new THREE.MeshStandardMaterial({
    color: 0x871828,
    emissive: 0x1a0306,
    roughness: 0.26,
    metalness: 0.02,
  });
  const toothMat = new THREE.MeshStandardMaterial({
    color: 0xf7f3e8,
    emissive: 0x2a221a,
    roughness: 0.18,
    metalness: 0.06,
  });

  // Shift base triangular blade cone up by +0.5 so pivot sits at tooth root in gums
  const toothGeo = new THREE.ConeGeometry(0.55, 1.0, 3);
  toothGeo.translate(0, 0.5, 0);

  const archPoint = (rx, rz, yBase, yDrop, zOff, theta) =>
    new THREE.Vector3(
      rx * Math.sin(theta),
      yBase - yDrop * Math.cos(theta),
      zOff + rz * Math.cos(theta)
    );

  const buildGumArch = (rx, rz, yBase, yDrop, zOff, tubeRadius) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const u = -1 + (2 * i) / 16;
      pts.push(archPoint(rx, rz, yBase, yDrop, zOff, u * Math.PI * 0.5));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 24, tubeRadius, 8, false), gumMat);
  };

  const populateJawTeeth = (parentGroup, cfg) => {
    const {
      count,
      uMax,
      rx,
      rz,
      yBase,
      yDrop,
      zOff,
      hFront,
      hCorner,
      wFront,
      wCorner,
      thickness,
      isUpper,
      inwardTilt,
    } = cfg;
    const xAxis = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3();
    const basisMat = new THREE.Matrix4();
    const tiltQuat = new THREE.Quaternion();

    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0 : -uMax + (2 * uMax * i) / (count - 1);
      const theta = u * Math.PI * 0.5;
      const frontFactor = 1.0 - Math.abs(u) / Math.max(uMax, 1e-4);
      const h = THREE.MathUtils.lerp(hCorner, hFront, frontFactor);
      const w = THREE.MathUtils.lerp(wCorner, wFront, frontFactor);

      const pos = archPoint(rx, rz, yBase, yDrop, zOff, theta);
      // Tangent along arch & outward normal in XZ plane
      xAxis.set(rx * Math.cos(theta), 0, -rz * Math.sin(theta)).normalize();
      zAxis.crossVectors(xAxis, yAxis).normalize();
      basisMat.makeBasis(xAxis, yAxis, zAxis);

      const tooth = new THREE.Mesh(toothGeo, toothMat);
      tooth.position.copy(pos);
      tooth.quaternion.setFromRotationMatrix(basisMat);
      tiltQuat.setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        isUpper ? Math.PI + inwardTilt : -inwardTilt
      );
      tooth.quaternion.multiply(tiltQuat);
      tooth.scale.set(w, h, thickness);
      parentGroup.add(tooth);
    }
  };

  // 1. Upper Oral Group (mounted rigidly to `bones.head` at mesh (0, 0.015, 0.315))
  const upperOral = new THREE.Group();
  upperOral.name = "shark_upper_oral";

  const palateDome = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), palateMat);
  palateDome.scale.set(0.036, 0.015, 0.056);
  palateDome.position.set(0, 0.008, 0.044);
  upperOral.add(palateDome);

  const gulletGeo = new THREE.CylinderGeometry(0.035, 0.020, 0.088, 16);
  gulletGeo.rotateX(Math.PI / 2);
  const gullet = new THREE.Mesh(gulletGeo, throatMat);
  gullet.position.set(0, -0.008, -0.012);
  upperOral.add(gullet);

  const throatCap = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), throatMat);
  throatCap.position.set(0, -0.008, -0.052);
  upperOral.add(throatCap);

  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), palateMat);
    cheek.scale.set(0.007, 0.022, 0.028);
    cheek.position.set(side * 0.035, -0.008, 0.016);
    upperOral.add(cheek);
  }

  upperOral.add(buildGumArch(0.036, 0.092, -0.005, 0.003, 0.016, 0.0046));
  populateJawTeeth(upperOral, {
    count: 15,
    uMax: 0.88,
    rx: 0.036,
    rz: 0.092,
    yBase: -0.007,
    yDrop: 0.003,
    zOff: 0.016,
    hFront: 0.023,
    hCorner: 0.012,
    wFront: 0.0072,
    wCorner: 0.0042,
    thickness: 0.003,
    isUpper: true,
    inwardTilt: 0.21,
  });
  populateJawTeeth(upperOral, {
    count: 11,
    uMax: 0.80,
    rx: 0.030,
    rz: 0.078,
    yBase: -0.004,
    yDrop: 0.003,
    zOff: 0.016,
    hFront: 0.019,
    hCorner: 0.010,
    wFront: 0.0062,
    wCorner: 0.0038,
    thickness: 0.0026,
    isUpper: true,
    inwardTilt: 0.38,
  });
  bones.head.add(upperOral);

  // 2. Lower Oral Group (mounted rigidly to `bones.jaw_lower` at mesh (0, 0.005, 0.320))
  const lowerOral = new THREE.Group();
  lowerOral.name = "shark_lower_oral";

  const lowerFloor = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), palateMat);
  lowerFloor.scale.set(0.033, 0.012, 0.048);
  lowerFloor.position.set(0, -0.011, 0.042);
  lowerOral.add(lowerFloor);

  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), tongueMat);
  tongue.scale.set(0.021, 0.009, 0.038);
  tongue.position.set(0, -0.001, 0.038);
  lowerOral.add(tongue);

  lowerOral.add(buildGumArch(0.032, 0.084, 0.001, 0.003, 0.014, 0.0042));
  populateJawTeeth(lowerOral, {
    count: 13,
    uMax: 0.85,
    rx: 0.032,
    rz: 0.084,
    yBase: 0.003,
    yDrop: 0.003,
    zOff: 0.014,
    hFront: 0.019,
    hCorner: 0.010,
    wFront: 0.0060,
    wCorner: 0.0036,
    thickness: 0.0026,
    isUpper: false,
    inwardTilt: 0.18,
  });
  populateJawTeeth(lowerOral, {
    count: 9,
    uMax: 0.76,
    rx: 0.026,
    rz: 0.070,
    yBase: 0.001,
    yDrop: 0.003,
    zOff: 0.014,
    hFront: 0.015,
    hCorner: 0.0085,
    wFront: 0.0050,
    wCorner: 0.0032,
    thickness: 0.0024,
    isUpper: false,
    inwardTilt: 0.35,
  });
  bones.jaw_lower.add(lowerOral);

  upperOral.visible = false;
  lowerOral.visible = false;

  return {
    setJawOpen(open01) {
      const o = THREE.MathUtils.clamp(open01, 0, 1);
      bones.jaw_lower.rotation.x = o * 1.12;
      const show = o > 0.025;
      upperOral.visible = show;
      lowerOral.visible = show;
      const emerge = 0.86 + 0.14 * Math.min(1, o / 0.25);
      upperOral.scale.setScalar(emerge);
      lowerOral.scale.setScalar(emerge);
    },
  };
}

/**
 * TailorRig Skinned Fish Actor (`*_tailorrig.glb` — 9 bones across 4 kinematic chains,
 * plus 10th `jaw_lower` joint for `great_white_shark`).
 */
function createTailorRigFishActor(templateScene, baseLengthMeters) {
  const clone = SkeletonUtils.clone(templateScene);
  clone.traverse((c) => {
    if (c.isMesh) c.frustumCulled = false;
  });

  const bones = {};
  clone.traverse((b) => {
    if (b.isBone || b.name) bones[b.name] = b;
  });

  const oralRig = attachSharkOralAnatomy(bones);

  const group = new THREE.Group();
  group.add(clone);
  group.scale.setScalar(baseLengthMeters);

  return {
    group,
    bones,
    setScaleMultiplier(mult) {
      group.scale.setScalar(baseLengthMeters * mult);
    },
    setJawOpen(open01) {
      if (oralRig) oralRig.setJawOpen(open01);
    },
    updateSwim(timeSec, speed = 4.5, yawAmp = 0.22) {
      const p = timeSec * speed;
      if (bones.head) bones.head.rotation.y = -yawAmp * 0.18 * Math.sin(p);
      if (bones.spine_01) bones.spine_01.rotation.y = yawAmp * 0.42 * Math.sin(p - 0.7);
      if (bones.spine_02) bones.spine_02.rotation.y = yawAmp * 0.75 * Math.sin(p - 1.4);
      if (bones.tail_peduncle) bones.tail_peduncle.rotation.y = yawAmp * 1.12 * Math.sin(p - 2.1);
      if (bones.caudal_fin) bones.caudal_fin.rotation.y = yawAmp * 1.35 * Math.sin(p - 2.7);
      if (bones.pectoral_l) bones.pectoral_l.rotation.z = 0.18 * Math.sin(p * 0.8);
      if (bones.pectoral_r) bones.pectoral_r.rotation.z = -0.18 * Math.sin(p * 0.8);
      if (bones.dorsal_fin) bones.dorsal_fin.rotation.z = 0.08 * Math.sin(p - 1.0);
    },
  };
}

/**
 * Full-body Hugging Face Rigged Human Angler (`angler_character.glb`) with TailorRig Rod,
 * Two-Bone IK limbs, world-space bobber & curved line, and crisp 3D nameplate + speech bubble.
 */
function buildRemoteAnglerActor(charScene, rodScene, bobberScene, opts = {}) {
  const group = new THREE.Group();
  const charClone = SkeletonUtils.clone(charScene);
  charClone.traverse((c) => {
    if (c.isMesh) {
      c.frustumCulled = false;
      c.castShadow = true;
      c.receiveShadow = true;
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          if ("metalness" in m) m.metalness = Math.min(m.metalness ?? 0.05, 0.08);
          if ("roughness" in m) m.roughness = Math.max(m.roughness ?? 0.65, 0.45);
          m.needsUpdate = true;
        });
      }
    }
  });

  // Normalize so boots stand cleanly at local y = 0, total height = 1.78m, facing -Z (lakeward)
  charClone.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(charClone);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);
  const scale = 1.78 / Math.max(rawSize.y, 1e-4);

  const modelOrient = new THREE.Group();
  charClone.position.set(-rawCenter.x * scale, -rawBox.min.y * scale, -rawCenter.z * scale);
  charClone.scale.setScalar(scale);
  // Source GLB faces +Z (eyes & toes +Z); rotate 180° around Y so facing direction matches -Z yaw=0!
  modelOrient.rotation.y = Math.PI;
  modelOrient.add(charClone);
  group.add(modelOrient);

  const findBone = (prefix) => {
    let found = null;
    charClone.traverse((b) => {
      if (!found && b.name && b.name.startsWith(prefix)) found = b;
    });
    return found;
  };
  const b = {
    hips: findBone("Hips"),
    spine: findBone("Spine_"),
    spine2: findBone("Spine2"),
    head: findBone("Head_"),
    lArm: findBone("LeftArm"),
    lForeArm: findBone("LeftForeArm"),
    lHand: findBone("LeftHand_"),
    rArm: findBone("RightArm"),
    rForeArm: findBone("RightForeArm"),
    rHand: findBone("RightHand_"),
    lUpLeg: findBone("LeftUpLeg"),
    lLeg: findBone("LeftLeg_"),
    lFoot: findBone("LeftFoot"),
    rUpLeg: findBone("RightUpLeg"),
    rLeg: findBone("RightLeg_"),
    rFoot: findBone("RightFoot"),
  };

  // Subtle jacket/vest color accent per player ID so teammates are visually distinct
  const accentColor = opts.accentColor || "#34d399";
  const topMeshes = [];
  charClone.traverse((c) => {
    if (c.isMesh && c.material && /Top|Shirt|Jacket/i.test(c.material.name || "")) {
      topMeshes.push(c);
    }
  });
  if (topMeshes.length > 0 && opts.tintColor) {
    topMeshes.forEach((m) => {
      m.material = m.material.clone();
      m.material.color.lerp(new THREE.Color(opts.tintColor), 0.35);
    });
  }

  // Attach TailorRig fishing rod in front of torso/chest (`facing -Z`)
  const rodCtrl = buildTailorRigRodController(rodScene, 1.28);
  const leftHandleAnchor = new THREE.Object3D();
  leftHandleAnchor.position.set(0.0, -0.01, 0.11);
  rodCtrl.group.add(leftHandleAnchor);

  const rodPivot = new THREE.Group();
  rodPivot.position.set(0.14, 1.12, -0.38);
  rodPivot.rotation.set(0.26, -0.22, 0.04);
  rodPivot.add(rodCtrl.group);
  group.add(rodPivot);

  // World-space bobber & dynamic curved fishing line (14 pts)
  const bobberMesh = buildCleanBobber(bobberScene);
  bobberMesh.visible = false;
  const lineSegs = 14;
  const linePosArr = new Float32Array(lineSegs * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePosArr, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.72,
  });
  const lineMesh = new THREE.Line(lineGeo, lineMat);
  lineMesh.frustumCulled = false;
  lineMesh.visible = false;

  // Floating Nameplate + Speech Bubble Canvas Sprite above head
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 160;
  const labelCtx = labelCanvas.getContext("2d");
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const labelSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: labelTex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
  );
  labelSprite.position.set(0, 2.15, 0);
  labelSprite.scale.set(1.65, 0.52, 1);
  labelSprite.renderOrder = 10;
  group.add(labelSprite);

  let lastLabelSig = "";
  const redrawLabel = ({ name, level, statusIcon, bubbleText }) => {
    const sig = `${name}|${level}|${statusIcon}|${bubbleText || ""}`;
    if (sig === lastLabelSig) return;
    lastLabelSig = sig;
    const ctx = labelCtx;
    ctx.clearRect(0, 0, 512, 160);

    if (bubbleText) {
      ctx.font = "700 24px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
      const bw = Math.min(470, Math.max(150, ctx.measureText(bubbleText).width + 44));
      const bx = (512 - bw) * 0.5;
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(bx, 10, bw, 52, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bubbleText.slice(0, 24), 256, 36);
    }

    const pillText = `${statusIcon || "🎣"} LV.${level || 1}  ${name || "翡翠釣客"}`;
    ctx.font = "800 26px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
    const pw = Math.min(480, Math.max(180, ctx.measureText(pillText).width + 46));
    const px = (512 - pw) * 0.5;
    ctx.fillStyle = "rgba(8, 15, 28, 0.84)";
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(px, 84, pw, 56, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pillText, 256, 112);
    labelTex.needsUpdate = true;
  };

  let curName = opts.name || "翡翠釣客";
  let curLevel = opts.level || 1;
  let bubbleText = "";
  let bubbleExpireAt = 0;
  let attachedScene = null;
  let smoothPos = new THREE.Vector3(opts.x || 0, 0.32, opts.z || 29.8);
  let smoothYaw = opts.yaw || 0;
  let walkBlend = 0;
  let walkPhase = 0;

  group.position.copy(smoothPos);
  group.rotation.y = smoothYaw;
  redrawLabel({ name: curName, level: curLevel, statusIcon: "🎣", bubbleText: "" });

  const _vRGrip = new THREE.Vector3();
  const _vLButt = new THREE.Vector3();
  const _vTip = new THREE.Vector3();
  const _vRPole = new THREE.Vector3();
  const _vLPole = new THREE.Vector3();
  const _vLFootTgt = new THREE.Vector3();
  const _vRFootTgt = new THREE.Vector3();
  const _vLKneePole = new THREE.Vector3();
  const _vRKneePole = new THREE.Vector3();

  const hipsRestRot = b.hips ? b.hips.rotation.clone() : null;
  const spine2RestRot = b.spine2 ? b.spine2.rotation.clone() : null;

  return {
    group,
    bobberMesh,
    lineMesh,
    attachToScene(scene) {
      attachedScene = scene;
      scene.add(group);
      scene.add(bobberMesh);
      scene.add(lineMesh);
    },
    showBubble(text, durationSec = 4.5) {
      bubbleText = text;
      bubbleExpireAt = performance.now() * 0.001 + durationSec;
    },
    update(dt, timeSec, netState) {
      const targetX = THREE.MathUtils.clamp(Number(netState?.x) || 0, -1.45, 1.45);
      const targetZ = THREE.MathUtils.clamp(Number(netState?.z) || 29.8, 25.8, 36.2);
      const targetYaw = Number(netState?.yaw) || 0;
      curName = netState?.name || curName;
      curLevel = Number(netState?.level) || curLevel;

      const dx = targetX - smoothPos.x;
      const dz = targetZ - smoothPos.z;
      const stepDist = Math.hypot(dx, dz);
      const lerpAlpha = Math.min(1, dt * 10.0);
      smoothPos.x += dx * lerpAlpha;
      smoothPos.z += dz * lerpAlpha;
      smoothPos.y = 0.32;

      let dyaw = targetYaw - smoothYaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      smoothYaw += dyaw * lerpAlpha;

      const moving = stepDist > 0.012;
      walkBlend += ((moving ? 1 : 0) - walkBlend) * Math.min(1, dt * 8.0);
      if (moving) walkPhase += dt * 9.5;

      group.position.copy(smoothPos);
      group.position.y = 0.32 + Math.abs(Math.sin(walkPhase)) * 0.028 * walkBlend;
      group.rotation.y = smoothYaw;

      const st = netState?.state || "IDLE";
      const stateIcon =
        st === "SHARK_AMBUSH" ? "🦈" :
        st === "FIGHTING" ? "🔥" :
        st === "WAITING" || st === "BITE" ? "🌊" :
        st === "CHARGING" || st === "FLYING" ? "⚡" : "🎣";
      if (bubbleText && performance.now() * 0.001 > bubbleExpireAt) {
        bubbleText = "";
      }
      redrawLabel({ name: curName, level: curLevel, statusIcon: stateIcon, bubbleText });

      // Rod pose & bend matched to peer state
      let targetRodPitch = 0.28 + Math.sin(timeSec * 1.4) * 0.025;
      let targetBend = Number(netState?.rodBend) || 0;
      if (st === "CHARGING") {
        targetRodPitch = 1.05 + Math.sin(timeSec * 8) * 0.05;
        targetBend = 0.14;
      } else if (st === "FLYING") {
        targetRodPitch = -0.18;
        targetBend = 0.22;
      } else if (st === "WAITING" || st === "BITE") {
        targetRodPitch = 0.34 + Math.sin(timeSec * 2.0) * 0.03;
      } else if (st === "FIGHTING") {
        targetRodPitch = 0.68 + Math.sin(timeSec * 6.5) * 0.16;
        targetBend = Math.max(0.28, targetBend);
        rodCtrl.spinReel(dt, 11.0);
      } else if (st === "SHARK_AMBUSH") {
        targetRodPitch = 1.15;
        targetBend = 0.42;
      }
      rodPivot.rotation.x += (targetRodPitch - rodPivot.rotation.x) * Math.min(1, dt * 10.0);
      rodCtrl.setBend(targetBend, st === "FIGHTING" ? 0.12 * Math.sin(timeSec * 4.5) : 0);

      // Subtle torso twist when casting/fighting
      if (b.spine2 && spine2RestRot) {
        const torsoLean = st === "CHARGING" ? -0.18 : st === "FIGHTING" ? -0.14 : 0.04;
        b.spine2.rotation.x = spine2RestRot.x + torsoLean;
      }
      if (b.hips && hipsRestRot) {
        b.hips.rotation.y = hipsRestRot.y + Math.sin(walkPhase) * 0.05 * walkBlend;
      }

      // Two-Bone IK for both legs (natural standing / pier walking stride)
      group.updateWorldMatrix(true, true);
      if (b.lUpLeg && b.lLeg && b.lFoot && b.rUpLeg && b.rLeg && b.rFoot) {
        const lSwing = Math.sin(walkPhase) * 0.22 * walkBlend;
        const rSwing = Math.sin(walkPhase + Math.PI) * 0.22 * walkBlend;
        const lLift = Math.max(0, Math.cos(walkPhase)) * 0.10 * walkBlend;
        const rLift = Math.max(0, Math.cos(walkPhase + Math.PI)) * 0.10 * walkBlend;
        // Remember facing -Z -> left side is -X, right side is +X
        _vLFootTgt.set(-0.11, 0.15 + lLift, -lSwing).applyMatrix4(group.matrixWorld);
        _vRFootTgt.set(0.11, 0.15 + rLift, -rSwing).applyMatrix4(group.matrixWorld);
        _vLKneePole.set(-0.12, 0.52, -0.55).applyMatrix4(group.matrixWorld);
        _vRKneePole.set(0.12, 0.52, -0.55).applyMatrix4(group.matrixWorld);
        solveTwoBoneIKPlusY(b.lUpLeg, b.lLeg, b.lFoot, _vLFootTgt, _vLKneePole, 0);
        solveTwoBoneIKPlusY(b.rUpLeg, b.rLeg, b.rFoot, _vRFootTgt, _vRKneePole, 0);
      }

      // Two-Bone IK for both arms gripping the TailorRig fishing rod cleanly in front of chest!
      rodCtrl.getRightGripWorldPosition(_vRGrip);
      leftHandleAnchor.getWorldPosition(_vLButt);
      rodCtrl.getTipWorldPosition(_vTip);
      _vRPole.set(0.46, 1.02, -0.08).applyMatrix4(group.matrixWorld);
      _vLPole.set(-0.42, 1.02, -0.14).applyMatrix4(group.matrixWorld);
      if (b.rArm && b.rForeArm && b.rHand) {
        solveTwoBoneIKPlusY(b.rArm, b.rForeArm, b.rHand, _vRGrip, _vRPole, 0);
        aimBonePlusYAtWorldPoint(b.rHand, _vTip, -0.35);
      }
      if (b.lArm && b.lForeArm && b.lHand) {
        solveTwoBoneIKPlusY(b.lArm, b.lForeArm, b.lHand, _vLButt, _vLPole, 0);
        aimBonePlusYAtWorldPoint(b.lHand, _vRGrip, 0.45);
      }

      // Update world-space bobber & parabolic fishing line
      const bob = netState?.bobber;
      if (bob && Number.isFinite(bob.x) && Number.isFinite(bob.z) && st !== "IDLE" && st !== "SHOWCASE") {
        bobberMesh.visible = true;
        bobberMesh.position.set(bob.x, Number.isFinite(bob.y) ? bob.y : 0.02, bob.z);
        lineMesh.visible = true;
        const posAttr = lineGeo.attributes.position;
        const sag = st === "FIGHTING" ? 0.05 : 0.35;
        for (let i = 0; i < lineSegs; i++) {
          const u = i / (lineSegs - 1);
          const lx = THREE.MathUtils.lerp(_vTip.x, bobberMesh.position.x, u);
          const lz = THREE.MathUtils.lerp(_vTip.z, bobberMesh.position.z, u);
          const ly =
            THREE.MathUtils.lerp(_vTip.y, bobberMesh.position.y + 0.06, u) -
            Math.sin(u * Math.PI) * sag;
          posAttr.setXYZ(i, lx, ly, lz);
        }
        posAttr.needsUpdate = true;
      } else {
        bobberMesh.visible = false;
        lineMesh.visible = false;
      }
    },
    dispose() {
      if (attachedScene) {
        attachedScene.remove(group);
        attachedScene.remove(bobberMesh);
        attachedScene.remove(lineMesh);
      } else {
        group.removeFromParent();
        bobberMesh.removeFromParent();
        lineMesh.removeFromParent();
      }
      labelTex.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
}
