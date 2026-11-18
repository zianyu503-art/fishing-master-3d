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
    ["rodRigged", "outputs/tailorrig/fishing_rod_tailorrig.glb", "gltf"],
    ["bassRigged", "outputs/tailorrig/largemouth_bass_tailorrig.glb", "gltf"],
    ["carpRigged", "outputs/tailorrig/common_carp_tailorrig.glb", "gltf"],
    ["pikeRigged", "outputs/tailorrig/northern_pike_tailorrig.glb", "gltf"],
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
    bobberTemplate: buildCleanBobber(raw.bobber),
    wormTemplate: buildCenteredProp(raw.worm, 0.16),
    coinTemplate: buildCenteredProp(raw.coin, 0.44),
    fishFactory: {
      largemouth_bass: () => createTailorRigFishActor(raw.bassRigged, 0.66),
      common_carp: () => createTailorRigFishActor(raw.carpRigged, 0.82),
      northern_pike: () => createTailorRigFishActor(raw.pikeRigged, 1.15),
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
function buildTailorRigRodController(rodScene) {
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(rodScene);
  model.traverse((c) => {
    if (c.isMesh) c.frustumCulled = false;
  });

  // Shift so `rod_grip` (z = +0.16) sits near local origin of `root`
  model.position.set(0, 0, -0.18);
  root.add(model);
  root.scale.setScalar(1.68);

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
 * TailorRig Skinned Fish Actor (`*_tailorrig.glb` — 9 bones across 4 kinematic chains:
 * `fish_root`, `head`, `spine_01`, `spine_02`, `tail_peduncle`, `caudal_fin`, `dorsal_fin`, `pectoral_l/r`).
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

  const group = new THREE.Group();
  group.add(clone);
  group.scale.setScalar(baseLengthMeters);

  return {
    group,
    bones,
    setScaleMultiplier(mult) {
      group.scale.setScalar(baseLengthMeters * mult);
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
