import * as THREE from 'three';
import { NEON_COLORS } from './constants';
import {
  LiveryId,
  NeonColorId,
  PaintSwatch,
  UpgradeLevels,
  VehicleAccessoryId,
  VehicleConfig,
  WheelStyleConfig,
} from '../types/game';
import {
  createCoinTexture,
  createDirtOverlayTexture,
  createLicensePlateTexture,
  createLiveryTexture,
  createRallyLightCoverTexture,
  createSoftGlowTexture,
  createTireBumpTexture,
  createWeatheredPaintBumpTexture,
} from './textures';

export interface CoiloverShockRig {
  group: THREE.Group;
  setCompression: (length: number) => void;
}

export interface VehicleRig3D {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  wheelRearGroup: THREE.Group;
  wheelFrontGroup: THREE.Group;
  wheelRearSpin: THREE.Group;
  wheelFrontSpin: THREE.Group;
  shockRear: CoiloverShockRig;
  shockFront: CoiloverShockRig;
  armRear: THREE.Group;
  armFront: THREE.Group;
  driverTorso: THREE.Group;
  driverHead: THREE.Group;
  riderLeanGroup: THREE.Group | null;
  activeWing: THREE.Group | null;
  headlightSpot: THREE.SpotLight | null;
  headlightCones: THREE.Mesh[];
  brakeLightMat: THREE.MeshStandardMaterial;
  dirtMat: THREE.MeshStandardMaterial;
  nitroGlow: THREE.Group;
  backfireGlow: THREE.Group;
  neonPoolMesh: THREE.Mesh | null;
  neonLight: THREE.PointLight | null;
  tireShadowRear: THREE.Mesh;
  tireShadowFront: THREE.Mesh;
  chassisAoShadow: THREE.Mesh;
  whipMastGroup: THREE.Group | null;
  whipFlag: THREE.Mesh | null;
  dispose: () => void;
}

export interface GhostRig3D {
  root: THREE.Group;
  wheelRear: THREE.Mesh;
  wheelFront: THREE.Mesh;
  dispose: () => void;
}

function makeTube(points: [number, number, number][], radius: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    'catmullrom',
    0.16,
  );
  return new THREE.TubeGeometry(curve, 24, radius, 8, false);
}

function buildWheelMesh(
  radius: number,
  width: number,
  style: WheelStyleConfig,
  isBike: boolean,
  tireBumpTex: THREE.CanvasTexture,
  caliperColor: string,
  isDonk = false,
): THREE.Group {
  const wheel = new THREE.Group();

  const tireMat = new THREE.MeshStandardMaterial({
    color: style.tireColor,
    roughness: 0.88,
    metalness: 0.04,
    bumpMap: tireBumpTex,
    bumpScale: 0.055,
  });
  const treadMat = new THREE.MeshStandardMaterial({
    color: '#1b1e23',
    roughness: 0.94,
    metalness: 0.04,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: isDonk ? '#f8fafc' : style.rimColor,
    roughness: isDonk ? 0.08 : Math.min(0.28, style.roughness),
    metalness: isDonk ? 0.96 : Math.max(0.78, style.metalness),
  });
  const innerBarrelMat = new THREE.MeshStandardMaterial({
    color: '#181c24',
    roughness: 0.42,
    metalness: 0.72,
  });
  const hubMat = new THREE.MeshStandardMaterial({
    color: '#2e3540',
    roughness: 0.3,
    metalness: 0.86,
  });
  const rotorMat = new THREE.MeshStandardMaterial({
    color: '#aeb6c4',
    roughness: 0.25,
    metalness: 0.92,
  });
  const boltMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.2,
    metalness: 0.95,
  });
  const caliperMat = new THREE.MeshStandardMaterial({
    color: caliperColor,
    roughness: 0.35,
    metalness: 0.4,
  });

  // Main contoured tire carcass
  const tireGeo = new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, width, 32);
  tireGeo.rotateX(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheel.add(tire);

  // Sculpted sidewall torus shoulders
  const sideRatio = isDonk ? 0.86 : 0.73;
  const sideTube = isDonk ? 0.09 : 0.21;
  const sideGeo = new THREE.TorusGeometry(radius * sideRatio, radius * sideTube, 12, 32);
  const sideF = new THREE.Mesh(sideGeo, tireMat);
  sideF.position.z = width * 0.32;
  const sideB = new THREE.Mesh(sideGeo, tireMat);
  sideB.position.z = -width * 0.32;
  wheel.add(sideF, sideB);

  // Aggressive mud-terrain knobby tread blocks + outer side-biter teeth
  const lugCount = isBike || isDonk ? 22 : 20;
  const lugGeo = new THREE.BoxGeometry(
    isBike || isDonk ? 0.05 : 0.145,
    isDonk ? 0.04 : 0.095,
    width * (isBike ? 0.62 : 0.48),
  );
  const sideBiterGeo = new THREE.BoxGeometry(0.085, 0.065, 0.05);
  for (let i = 0; i < lugCount; i++) {
    const a = (i / lugCount) * Math.PI * 2;
    const lug = new THREE.Mesh(lugGeo, treadMat);
    const zShift = isBike ? 0 : i % 2 === 0 ? width * 0.2 : -width * 0.2;
    lug.position.set(
      Math.cos(a) * radius * 0.94,
      Math.sin(a) * radius * 0.94,
      zShift,
    );
    lug.rotation.z = a + Math.PI / 2;
    lug.rotation.y = isBike || isDonk ? 0 : i % 2 === 0 ? 0.22 : -0.22;
    lug.castShadow = true;
    wheel.add(lug);

    if (!isBike && !isDonk) {
      [-width * 0.48, width * 0.48].forEach((sbz) => {
        const biter = new THREE.Mesh(sideBiterGeo, treadMat);
        biter.position.set(
          Math.cos(a) * radius * 0.86,
          Math.sin(a) * radius * 0.86,
          sbz,
        );
        biter.rotation.z = a + Math.PI / 2;
        wheel.add(biter);
      });
    }
  }

  // Deep-dish stepped alloy rim barrel (oversized 28" dish on Leonida Donk)
  const rimRadius = radius * (isDonk ? 0.78 : 0.54);
  const rimLipGeo = new THREE.TorusGeometry(rimRadius * 0.96, 0.048, 10, 28);
  const lipF = new THREE.Mesh(rimLipGeo, rimMat);
  lipF.position.z = width * 0.37;
  const lipB = new THREE.Mesh(rimLipGeo, rimMat);
  lipB.position.z = -width * 0.37;
  wheel.add(lipF, lipB);

  // Outer polished deep dish step + recessed dark inner barrel
  const dishRing = new THREE.Mesh(
    new THREE.CylinderGeometry(rimRadius * 0.98, rimRadius * 0.88, width * 0.2, 28, 1, true),
    rimMat,
  );
  dishRing.rotation.x = Math.PI / 2;
  dishRing.position.z = width * 0.26;
  wheel.add(dishRing);

  const rimGeo = new THREE.CylinderGeometry(rimRadius * 0.88, rimRadius * 0.88, width * 0.68, 28);
  rimGeo.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, isDonk ? rimMat : innerBarrelMat);
  wheel.add(rim);

  // Brake rotor disc + caliper tucked inside wheel barrel
  const rotor = new THREE.Mesh(
    new THREE.CylinderGeometry(rimRadius * 0.72, rimRadius * 0.72, 0.05, 22),
    rotorMat,
  );
  rotor.rotation.x = Math.PI / 2;
  rotor.position.z = -width * 0.04;
  wheel.add(rotor);

  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(rimRadius * 0.36, rimRadius * 0.5, 0.12),
    caliperMat,
  );
  caliper.position.set(-rimRadius * 0.45, rimRadius * 0.32, width * 0.05);
  caliper.rotation.z = 0.5;
  wheel.add(caliper);

  // Sculpted recessed wheel spokes
  const spokeCount = isDonk ? 10 : style.spokeCount;
  const spokeGeo = new THREE.BoxGeometry(rimRadius * 1.72, isDonk ? 0.048 : 0.072, width * 0.14);
  for (let s = 0; s < spokeCount; s++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.z = (s / spokeCount) * Math.PI;
    spoke.position.z = width * 0.19;
    wheel.add(spoke);
  }

  // Beadlock / outer lip bolts around rim perimeter
  const beadCount = 12;
  const boltGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 6);
  boltGeo.rotateX(Math.PI / 2);
  for (let b = 0; b < beadCount; b++) {
    const a = (b / beadCount) * Math.PI * 2;
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(
      Math.cos(a) * rimRadius * 0.9,
      Math.sin(a) * rimRadius * 0.9,
      width * 0.39,
    );
    wheel.add(bolt);
  }

  // Center locking hub & 5 lug nuts
  const hubGeo = new THREE.CylinderGeometry(rimRadius * 0.31, rimRadius * 0.35, width * 0.74, 16);
  hubGeo.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, isDonk ? rimMat : hubMat);
  hub.position.z = width * 0.04;
  wheel.add(hub);

  for (let l = 0; l < 5; l++) {
    const a = (l / 5) * Math.PI * 2;
    const lugNut = new THREE.Mesh(boltGeo, boltMat);
    lugNut.position.set(
      Math.cos(a) * rimRadius * 0.21,
      Math.sin(a) * rimRadius * 0.21,
      width * 0.36,
    );
    wheel.add(lugNut);
  }

  return wheel;
}

function buildCoiloverShock(
  paintAccent: string,
  suspensionLevel = 1,
): CoiloverShockRig {
  const g = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    metalness: 0.94,
    roughness: 0.12,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#1e2430',
    metalness: 0.82,
    roughness: 0.24,
  });
  const coilMat = new THREE.MeshStandardMaterial({
    color: paintAccent === '#ff6954' ? '#dc2626' : paintAccent,
    metalness: 0.36,
    roughness: 0.22,
  });
  const goldAnodizeMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    metalness: 0.85,
    roughness: 0.2,
  });

  // Fixed-thickness bottom axle eyelet & telescoping chrome piston rod (anchored at y = 0)
  const lowerEyelet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.08, 10),
    bodyMat,
  );
  lowerEyelet.rotation.x = Math.PI / 2;
  g.add(lowerEyelet);

  const lowerPerch = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.045, 12), shaftMat);
  lowerPerch.position.y = 0.09;
  g.add(lowerPerch);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.62, 10), shaftMat);
  rod.position.y = 0.32;
  g.add(rod);

  // Rigid upper shock body + threaded collar + remote piggyback reservoir (anchored at top mount y = length)
  const upperBody = new THREE.Group();
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.44, 12), bodyMat);
  sleeve.position.y = -0.22;
  upperBody.add(sleeve);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.055, 12), goldAnodizeMat);
  collar.position.y = -0.14;
  upperBody.add(collar);

  const topEyelet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.08, 10),
    bodyMat,
  );
  topEyelet.rotation.x = Math.PI / 2;
  upperBody.add(topEyelet);

  if (suspensionLevel >= 3) {
    const reservoir = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.046, 0.26, 10),
      goldAnodizeMat,
    );
    reservoir.position.set(-0.11, -0.16, 0.02);
    const resCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), bodyMat);
    resCap.position.set(-0.11, -0.02, 0.02);
    upperBody.add(reservoir, resCap);
  }
  g.add(upperBody);

  // Separate coil spring assembly scaled cleanly between lower perch and upper collar
  const springGroup = new THREE.Group();
  springGroup.position.y = 0.11;
  const wireThickness = suspensionLevel >= 4 ? 0.028 : 0.023;
  const coilCount = 7;
  for (let i = 0; i < coilCount; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.092, wireThickness, 8, 16), coilMat);
    ring.rotation.x = Math.PI / 2 + 0.13;
    ring.position.y = 0.035 + i * 0.095;
    springGroup.add(ring);
  }
  g.add(springGroup);

  const setCompression = (length: number) => {
    const clampedLen = Math.max(0.42, Math.min(1.45, length));
    upperBody.position.y = clampedLen;
    const springSpan = Math.max(0.24, clampedLen - 0.25);
    springGroup.scale.y = springSpan / 0.66;
  };
  setCompression(0.76);

  return { group: g, setCompression };
}

function buildDriver(
  isBike: boolean,
  isFullFaceAero: boolean,
  accentHex: string,
  primaryHex: string,
): {
  root: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
} {
  const driver = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({
    color: isBike ? '#161d2b' : '#252c38',
    roughness: 0.74,
    metalness: 0.08,
  });
  const jeansMat = new THREE.MeshStandardMaterial({
    color: '#18202e',
    roughness: 0.84,
    metalness: 0.04,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: '#0f131a',
    roughness: 0.52,
    metalness: 0.18,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#dba07c',
    roughness: 0.62,
    metalness: 0.02,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#17191e',
    roughness: 0.48,
    metalness: 0.14,
  });
  const harnessMat = new THREE.MeshStandardMaterial({
    color: '#dc2626',
    roughness: 0.58,
    metalness: 0.08,
  });
  const buckleMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.22,
    metalness: 0.88,
  });

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.32), jeansMat);
  pelvis.position.set(0, 0.06, 0);
  driver.add(pelvis);

  [-0.11, 0.11].forEach((zLeg) => {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.28, 5, 10), jeansMat);
    thigh.position.set(isBike ? 0.12 : 0.2, 0.04, zLeg);
    thigh.rotation.z = isBike ? -1.15 : -1.38;
    driver.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.26, 5, 10), jeansMat);
    shin.position.set(isBike ? 0.15 : 0.4, -0.14, zLeg);
    shin.rotation.z = isBike ? 0.25 : -0.22;
    driver.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.11), bootMat);
    boot.position.set(isBike ? 0.14 : 0.48, -0.28, zLeg);
    driver.add(boot);
  });

  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.12, 0);
  driver.add(torsoGroup);

  const chest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.188, 0.144, 0.43, 14),
    suitMat,
  );
  chest.position.set(0, 0.22, 0);
  chest.scale.set(0.84, 1, 1.15);
  chest.rotation.z = isBike ? -0.46 : -0.1;
  chest.castShadow = true;
  torsoGroup.add(chest);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.105, 0.032, 6, 14),
    suitMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(isBike ? 0.09 : 0.02, 0.43, 0);
  torsoGroup.add(collar);

  // 4-point racing harness straps + center aluminum quick-release camlock
  [-0.088, 0.088].forEach((zStrap) => {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.36, 0.052),
      isBike ? suitMat : harnessMat,
    );
    strap.position.set(isBike ? 0.1 : 0.088, 0.24, zStrap);
    strap.rotation.z = isBike ? -0.46 : -0.1;
    torsoGroup.add(strap);
  });
  if (!isBike) {
    const camlock = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 10), buckleMat);
    camlock.rotation.z = Math.PI / 2;
    camlock.position.set(0.11, 0.14, 0);
    torsoGroup.add(camlock);
  }

  [-0.2, 0.2].forEach((zSide) => {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), suitMat);
    shoulder.position.set(isBike ? 0.06 : 0.0, 0.36, zSide);
    torsoGroup.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.2, 5, 8), suitMat);
    upperArm.position.set(isBike ? 0.18 : 0.14, 0.28, zSide);
    upperArm.rotation.z = isBike ? -0.95 : -0.92;
    torsoGroup.add(upperArm);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.044, 0.2, 5, 8),
      suitMat,
    );
    forearm.position.set(isBike ? 0.34 : 0.32, 0.24, zSide * 0.85);
    forearm.rotation.z = isBike ? -1.42 : -1.25;
    torsoGroup.add(forearm);

    const glove = new THREE.Mesh(
      new THREE.SphereGeometry(0.054, 10, 8),
      gloveMat,
    );
    glove.position.set(isBike ? 0.46 : 0.44, 0.26, zSide * 0.72);
    torsoGroup.add(glove);
  });

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.13, 12), suitMat);
  neck.position.set(isBike ? 0.1 : 0.02, 0.46, 0);
  torsoGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(isBike ? 0.14 : 0.03, isBike ? 0.54 : 0.59, 0);
  torsoGroup.add(headGroup);

  const balaclava = new THREE.Mesh(new THREE.SphereGeometry(0.142, 16, 14), bootMat);
  balaclava.scale.set(1.02, 1.08, 0.88);
  headGroup.add(balaclava);

  const lowerFace = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), skinMat);
  lowerFace.position.set(0.055, -0.025, 0);
  headGroup.add(lowerFace);

  // Motorsport Helmet + Tinted Visor (All 7 Vehicles)
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: isBike || isFullFaceAero ? primaryHex : '#f1f5f9',
    roughness: 0.18,
    metalness: 0.32,
    clearcoat: 0.95,
  });
  const helmetTrimMat = new THREE.MeshStandardMaterial({
    color: '#11161d',
    roughness: 0.55,
    metalness: 0.22,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: '#0b1322',
    roughness: 0.06,
    metalness: 0.72,
    clearcoat: 1.0,
    iridescence: isFullFaceAero ? 0.9 : 0.45,
  });

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.68),
    helmetMat,
  );
  shell.position.y = 0.018;
  shell.castShadow = true;
  headGroup.add(shell);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.036, 0.056),
    new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.25 }),
  );
  stripe.position.set(-0.02, 0.192, 0);
  headGroup.add(stripe);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.115, 0.09, 0.265),
    visorMat,
  );
  visor.position.set(0.142, 0.028, 0);
  headGroup.add(visor);

  if (isFullFaceAero) {
    const chinBar = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.1, 0.27), helmetMat);
    chinBar.position.set(0.125, -0.09, 0);
    headGroup.add(chinBar);
  } else {
    // Rally/off-road sun peak + rubber goggle strap + cheek pads
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.25), helmetTrimMat);
    peak.position.set(0.16, 0.115, 0);
    peak.rotation.z = 0.16;
    headGroup.add(peak);

    const goggleStrap = new THREE.Mesh(
      new THREE.TorusGeometry(0.182, 0.02, 6, 18),
      helmetTrimMat,
    );
    goggleStrap.rotation.x = Math.PI / 2;
    goggleStrap.position.set(-0.01, 0.02, 0);
    headGroup.add(goggleStrap);
  }

  return { root: driver, torsoGroup, headGroup };
}

export function buildVehicle3D(
  config: VehicleConfig,
  paint: PaintSwatch,
  wheelStyle: WheelStyleConfig,
  withSpotLight: boolean,
  accessories: VehicleAccessoryId[] = ['lightbar'],
  neonColorId: NeonColorId = 'off',
  liveryId: LiveryId = 'clean',
  maxAniso = 8,
  upgrades?: UpgradeLevels,
): VehicleRig3D {
  const hasAcc = (id: VehicleAccessoryId) => accessories.includes(id);
  const upEngine = upgrades?.engine ?? 1;
  const upSusp = upgrades?.suspension ?? 1;
  const upTires = upgrades?.tires ?? 1;
  const upAwd = upgrades?.awd ?? 1;
  const upFuel = upgrades?.fuel ?? 1;

  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const tireBumpTex = createTireBumpTexture(maxAniso);
  const paintBumpTex = createWeatheredPaintBumpTexture(maxAniso);
  const rallyCoverTex = createRallyLightCoverTexture(maxAniso);
  const plateTex = createLicensePlateTexture('JACK-06', maxAniso);
  const neonGlowTex = createSoftGlowTexture();
  const dirtTex = createDirtOverlayTexture(maxAniso);
  const disposableTextures: THREE.Texture[] = [
    tireBumpTex,
    paintBumpTex,
    rallyCoverTex,
    plateTex,
    neonGlowTex,
    dirtTex,
  ];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: paint.primary,
    metalness: paint.metalness,
    roughness: paint.roughness,
    clearcoat: paint.clearcoat,
    clearcoatRoughness: 0.14,
    bumpMap: paintBumpTex,
    bumpScale: 0.012,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: paint.secondary,
    metalness: 0.42,
    roughness: 0.38,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: '#191d25',
    metalness: 0.78,
    roughness: 0.36,
  });
  const forgedCarbonMat = new THREE.MeshStandardMaterial({
    color: '#141821',
    metalness: 0.38,
    roughness: 0.58,
  });
  const matteTrimMat = new THREE.MeshStandardMaterial({
    color: '#13161d',
    metalness: 0.16,
    roughness: 0.84,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#edf2f7',
    metalness: 0.95,
    roughness: 0.12,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#d8eefc',
    metalness: 0.04,
    roughness: 0.05,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.34,
  });
  const interiorMat = new THREE.MeshStandardMaterial({
    color: '#1b1f27',
    roughness: 0.8,
    metalness: 0.1,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#fffef0',
    emissive: '#ffe994',
    emissiveIntensity: 2.6,
    roughness: 0.1,
  });
  const haloDrlMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#38bdf8',
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: '#ff2424',
    emissive: '#dc2626',
    emissiveIntensity: 0.7,
    roughness: 0.18,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    map: plateTex,
    roughness: 0.35,
    metalness: 0.15,
  });
  const dirtMat = new THREE.MeshStandardMaterial({
    map: dirtTex,
    color: '#5c3a1e',
    transparent: true,
    opacity: 0,
    roughness: 0.96,
    metalness: 0.02,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const isBike = config.id === 'superbike';
  const isCheetah = config.id === 'cheetah_vc';
  const isDonk = config.id === 'donk_leonida';
  const bodyDepth = isBike ? 0.54 : isCheetah ? 1.76 : 1.62;

  // Primary sculpted chassis body silhouette
  const shape = new THREE.Shape();
  if (config.id === 'ranger') {
    shape.moveTo(-1.82, -0.14);
    shape.lineTo(1.84, -0.14);
    shape.lineTo(1.9, 0.36);
    shape.lineTo(1.12, 0.48);
    shape.lineTo(0.84, 0.74);
    shape.lineTo(0.16, 0.74);
    shape.lineTo(0.08, 0.3);
    shape.lineTo(-0.92, 0.3);
    shape.lineTo(-1.0, 0.7);
    shape.lineTo(-1.84, 0.7);
    shape.closePath();
  } else if (config.id === 'monster') {
    shape.moveTo(-2.02, -0.16);
    shape.lineTo(2.04, -0.16);
    shape.lineTo(2.1, 0.5);
    shape.lineTo(1.12, 0.6);
    shape.lineTo(0.76, 1.08);
    shape.lineTo(-0.46, 1.08);
    shape.lineTo(-0.62, 0.56);
    shape.lineTo(-2.02, 0.56);
    shape.closePath();
  } else if (config.id === 'buggy') {
    shape.moveTo(-1.62, -0.12);
    shape.lineTo(1.66, -0.12);
    shape.lineTo(1.74, 0.18);
    shape.lineTo(0.78, 0.38);
    shape.lineTo(-1.18, 0.36);
    shape.lineTo(-1.66, 0.12);
    shape.closePath();
  } else if (config.id === 'muscle') {
    shape.moveTo(-2.08, -0.15);
    shape.lineTo(2.08, -0.15);
    shape.lineTo(2.16, 0.24);
    shape.lineTo(0.96, 0.45);
    shape.lineTo(0.42, 0.9);
    shape.lineTo(-0.88, 0.9);
    shape.lineTo(-1.86, 0.42);
    shape.lineTo(-2.08, 0.36);
    shape.closePath();
  } else if (isCheetah) {
    // Sleek GTA 6 Leonida wedge mid-engine supercar profile
    shape.moveTo(-2.04, -0.14);
    shape.lineTo(2.05, -0.14);
    shape.lineTo(2.15, 0.14);
    shape.lineTo(1.18, 0.34);
    shape.lineTo(0.44, 0.74);
    shape.lineTo(-0.56, 0.74);
    shape.lineTo(-1.55, 0.42);
    shape.lineTo(-2.06, 0.35);
    shape.closePath();
  } else if (isDonk) {
    // Classic GTA 6 Leonida boxy 2-door hi-riser coupe silhouette
    shape.moveTo(-2.12, -0.12);
    shape.lineTo(2.12, -0.12);
    shape.lineTo(2.14, 0.38);
    shape.lineTo(0.96, 0.44);
    shape.lineTo(0.56, 0.96);
    shape.lineTo(-0.76, 0.96);
    shape.lineTo(-1.12, 0.44);
    shape.lineTo(-2.12, 0.42);
    shape.closePath();
  } else {
    // Superbike fairing
    shape.moveTo(-1.16, 0.04);
    shape.lineTo(1.06, 0.08);
    shape.lineTo(1.26, 0.54);
    shape.lineTo(0.56, 0.74);
    shape.lineTo(-0.08, 0.64);
    shape.lineTo(-0.68, 0.44);
    shape.lineTo(-1.28, 0.7);
    shape.closePath();
  }

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: bodyDepth,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.065,
    bevelSegments: 4,
  });
  bodyGeo.translate(0, 0, -bodyDepth * 0.5);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  chassisGroup.add(bodyMesh);

  // Hood Sculpted Power Bulge + Heat-Extractor Louvers (4-wheelers)
  if (!isBike) {
    const hoodX = config.id === 'buggy' ? 1.05 : isCheetah ? 1.45 : 1.32;
    const hoodY =
      config.id === 'monster'
        ? 0.59
        : config.id === 'buggy'
          ? 0.32
          : isCheetah
            ? 0.31
            : 0.48;
    const bulge = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.08, bodyDepth * 0.52),
      liveryId === 'carbon_hood' ? forgedCarbonMat : paintMat,
    );
    bulge.position.set(hoodX, hoodY, 0);
    bulge.rotation.z = isCheetah ? -0.18 : -0.06;
    chassisGroup.add(bulge);

    // Sculpted dual hood intake louvers
    [-bodyDepth * 0.16, bodyDepth * 0.16].forEach((lz) => {
      for (let slot = 0; slot < 3; slot++) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.18), matteTrimMat);
        louver.position.set(hoodX - 0.12 + slot * 0.13, hoodY + 0.038, lz);
        louver.rotation.z = -0.22;
        chassisGroup.add(louver);
      }
    });

    // Engine Upgrade Visuals (supercharger intake scoop / twin-scroll manifold)
    if (upEngine >= 3 && config.id !== 'muscle' && !isCheetah) {
      const scoop = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.13 + Math.min(0.08, (upEngine - 3) * 0.015), 0.36),
        upEngine >= 6 ? chromeMat : forgedCarbonMat,
      );
      scoop.position.set(hoodX - 0.04, hoodY + 0.08, 0);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.28), brakeLightMat);
      mouth.position.set(hoodX + 0.18, hoodY + 0.09, 0);
      chassisGroup.add(scoop, mouth);
    }
  }

  // Underbody Steel Frame Rails & Skid Plate
  const skidMesh = new THREE.Mesh(
    new THREE.BoxGeometry(config.chassisLength * 0.92, 0.18, bodyDepth * 0.8),
    darkMetalMat,
  );
  skidMesh.position.set(0, -0.17, 0);
  skidMesh.castShadow = true;
  chassisGroup.add(skidMesh);

  // Livery Graphics Overlay (Vice Stripes, Carbon Hood, VCPD Interceptor, Sunset Rally, Sticker Bomb, Viper Stripe)
  if (liveryId === 'sticker_bomb' || liveryId === 'viper_stripe') {
    const liveryTex = createLiveryTexture(liveryId, paint.primary, paint.accent, maxAniso);
    if (liveryId === 'viper_stripe') {
      liveryTex.center.set(0.5, 0.5);
      liveryTex.rotation = Math.PI / 2;
    } else {
      liveryTex.repeat.set(1.5, 1);
    }
    disposableTextures.push(liveryTex);

    const liveryMat = new THREE.MeshPhysicalMaterial({
      map: liveryTex,
      color: '#ffffff',
      metalness: liveryId === 'viper_stripe' ? paint.metalness : 0.14,
      roughness: liveryId === 'viper_stripe' ? 0.18 : 0.32,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    if (isBike) {
      [-bodyDepth * 0.5 - 0.068, bodyDepth * 0.5 + 0.068].forEach((zSide) => {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.42), liveryMat);
        panel.position.set(0.1, 0.4, zSide);
        if (zSide < 0) panel.rotation.y = Math.PI;
        chassisGroup.add(panel);
      });
      const tankWrap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.36), liveryMat);
      tankWrap.position.set(0.38, 0.68, 0);
      tankWrap.rotation.z = -0.18;
      chassisGroup.add(tankWrap);
    } else {
      const topY = isCheetah ? 0.77 : isDonk ? 0.99 : config.id === 'monster' ? 1.1 : 0.88;
      const hoodY = isCheetah ? 0.34 : isDonk ? 0.47 : config.id === 'monster' ? 0.59 : 0.5;
      const hoodSkin = new THREE.Mesh(
        new THREE.BoxGeometry(1.06, 0.04, bodyDepth * 0.88),
        liveryMat,
      );
      hoodSkin.position.set(1.36, hoodY, 0);
      hoodSkin.rotation.z = isCheetah ? -0.18 : -0.06;
      chassisGroup.add(hoodSkin);

      const roofCap = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.04, bodyDepth * 0.82),
        liveryMat,
      );
      roofCap.position.set(-0.08, topY, 0);
      chassisGroup.add(roofCap);

      const deckCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.04, bodyDepth * 0.86),
        liveryMat,
      );
      deckCap.position.set(-1.46, isCheetah ? 0.42 : isDonk ? 0.45 : 0.48, 0);
      deckCap.rotation.z = isCheetah ? 0.16 : 0.04;
      chassisGroup.add(deckCap);

      if (liveryId === 'sticker_bomb') {
        // Wrap aggressive GTA 6 street-art collage onto both door flanks & front fenders too
        [-bodyDepth * 0.5 - 0.068, bodyDepth * 0.5 + 0.068].forEach((zSide) => {
          const flank = new THREE.Mesh(
            new THREE.PlaneGeometry(config.chassisLength * 0.72, 0.44),
            liveryMat,
          );
          flank.position.set(-0.05, 0.16, zSide);
          if (zSide < 0) flank.rotation.y = Math.PI;
          chassisGroup.add(flank);
        });
      }
    }
  } else if (!isBike && liveryId !== 'clean') {
    if (liveryId === 'vice_stripes') {
      const cyanMat = new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#0891b2',
        emissiveIntensity: 0.25,
        roughness: 0.22,
      });
      const pinkMat = new THREE.MeshStandardMaterial({
        color: '#ec4899',
        emissive: '#be185d',
        emissiveIntensity: 0.25,
        roughness: 0.22,
      });
      const topY = isCheetah ? 0.77 : isDonk ? 0.99 : config.id === 'monster' ? 1.1 : 0.86;
      const stripeL = config.chassisLength * 0.52;
      const roofStripeC = new THREE.Mesh(new THREE.BoxGeometry(stripeL * 0.45, 0.035, 0.14), cyanMat);
      roofStripeC.position.set(-0.08, topY, -0.12);
      const roofStripeP = new THREE.Mesh(new THREE.BoxGeometry(stripeL * 0.45, 0.035, 0.14), pinkMat);
      roofStripeP.position.set(-0.08, topY, 0.12);
      chassisGroup.add(roofStripeC, roofStripeP);

      const hoodY = isCheetah ? 0.34 : isDonk ? 0.47 : 0.5;
      const hC = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.035, 0.14), cyanMat);
      hC.position.set(1.38, hoodY, -0.12);
      hC.rotation.z = isCheetah ? -0.18 : -0.06;
      const hP = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.035, 0.14), pinkMat);
      hP.position.set(1.38, hoodY, 0.12);
      hP.rotation.z = isCheetah ? -0.18 : -0.06;
      chassisGroup.add(hC, hP);
    } else if (liveryId === 'carbon_hood') {
      const hoodSkin = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.04, bodyDepth * 0.86),
        forgedCarbonMat,
      );
      hoodSkin.position.set(1.36, isCheetah ? 0.32 : 0.48, 0);
      hoodSkin.rotation.z = isCheetah ? -0.18 : -0.06;
      chassisGroup.add(hoodSkin);

      const roofCap = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.04, bodyDepth * 0.8),
        forgedCarbonMat,
      );
      roofCap.position.set(-0.08, isCheetah ? 0.77 : isDonk ? 0.99 : 0.93, 0);
      chassisGroup.add(roofCap);
    } else if (liveryId === 'leonida_interceptor') {
      const doorWhite = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.25 });
      const goldBadge = new THREE.MeshStandardMaterial({
        color: '#facc15',
        metalness: 0.8,
        roughness: 0.25,
      });
      const doorPanel = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.36, bodyDepth + 0.16),
        doorWhite,
      );
      doorPanel.position.set(-0.08, 0.18, 0);
      chassisGroup.add(doorPanel);

      const badgeBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.52, 0.07, bodyDepth + 0.18),
        goldBadge,
      );
      badgeBar.position.set(-0.08, 0.24, 0);
      chassisGroup.add(badgeBar);
    } else if (liveryId === 'sunset_rally') {
      const goldMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.28 });
      const coralMat = new THREE.MeshStandardMaterial({ color: '#fb7185', roughness: 0.28 });
      const flankBand = new THREE.Mesh(
        new THREE.BoxGeometry(config.chassisLength * 0.72, 0.11, bodyDepth + 0.15),
        goldMat,
      );
      flankBand.position.set(0, 0.16, 0);
      const flankAccent = new THREE.Mesh(
        new THREE.BoxGeometry(config.chassisLength * 0.64, 0.06, bodyDepth + 0.16),
        coralMat,
      );
      flankAccent.position.set(-0.1, 0.07, 0);
      chassisGroup.add(flankBand, flankAccent);
    }
  }

  // Dynamic Off-Road Mud & Grime Splatter Overlay Shells (driven by distance & landings)
  if (!isBike) {
    [-bodyDepth * 0.5 - 0.072, bodyDepth * 0.5 + 0.072].forEach((zSide) => {
      const sideDirt = new THREE.Mesh(
        new THREE.PlaneGeometry(config.chassisLength * 0.88, 0.56),
        dirtMat,
      );
      sideDirt.position.set(0, 0.14, zSide);
      if (zSide < 0) sideDirt.rotation.y = Math.PI;
      chassisGroup.add(sideDirt);
    });
    const frontDirt = new THREE.Mesh(
      new THREE.PlaneGeometry(bodyDepth * 0.9, 0.44),
      dirtMat,
    );
    frontDirt.rotation.y = Math.PI / 2;
    frontDirt.position.set(config.chassisLength * 0.5 + 0.074, 0.12, 0);
    chassisGroup.add(frontDirt);

    const rearDirt = new THREE.Mesh(
      new THREE.PlaneGeometry(bodyDepth * 0.9, 0.42),
      dirtMat,
    );
    rearDirt.rotation.y = -Math.PI / 2;
    rearDirt.position.set(-config.chassisLength * 0.5 - 0.074, 0.12, 0);
    chassisGroup.add(rearDirt);
  } else {
    [-bodyDepth * 0.5 - 0.072, bodyDepth * 0.5 + 0.072].forEach((zSide) => {
      const bikeDirt = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.48), dirtMat);
      bikeDirt.position.set(0, 0.34, zSide);
      if (zSide < 0) bikeDirt.rotation.y = Math.PI;
      chassisGroup.add(bikeDirt);
    });
  }

  // Cabin Interior (Bucket Seat + Bolsters + Dash + Center Console + Shifter)
  if (!isBike) {
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.52), interiorMat);
    seatBase.position.set(config.headX + 0.06, 0.34, 0);
    chassisGroup.add(seatBase);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.68, 0.5), interiorMat);
    seatBack.position.set(config.headX - 0.18, 0.68, 0);
    seatBack.rotation.z = 0.2;
    chassisGroup.add(seatBack);

    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.24), secondaryMat);
    headrest.position.set(config.headX - 0.25, 1.06, 0);
    headrest.rotation.z = 0.16;
    chassisGroup.add(headrest);

    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.26, bodyDepth * 0.88),
      interiorMat,
    );
    dash.position.set(0.58, 0.44, 0);
    chassisGroup.add(dash);

    const gaugePod = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.11, 0.38),
      new THREE.MeshStandardMaterial({
        color: '#0f172a',
        emissive: '#38bdf8',
        emissiveIntensity: 0.75,
      }),
    );
    gaugePod.position.set(0.43, 0.54, 0);
    chassisGroup.add(gaugePod);

    const shifterStick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8), chromeMat);
    shifterStick.position.set(0.24, 0.42, 0.16);
    shifterStick.rotation.z = -0.2;
    chassisGroup.add(shifterStick);

    const shiftKnob = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), secondaryMat);
    shiftKnob.position.set(0.27, 0.54, 0.16);
    chassisGroup.add(shiftKnob);

    [-bodyDepth * 0.55, bodyDepth * 0.55].forEach((mz) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.14), matteTrimMat);
      arm.position.set(0.54, 0.68, mz);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.16), matteTrimMat);
      housing.position.set(0.5, 0.71, mz + Math.sign(mz) * 0.08);
      chassisGroup.add(arm, housing);
    });
  }

  // Sharp Panel Shutlines, Door Handles & Rocker Trim (all enclosed 4-wheelers)
  if (!isBike && config.id !== 'buggy') {
    [-bodyDepth * 0.5 - 0.068, bodyDepth * 0.5 + 0.068].forEach((zSide) => {
      // Door handle
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.045), matteTrimMat);
      handle.position.set(-0.22, isCheetah ? 0.16 : 0.25, zSide);
      chassisGroup.add(handle);

      // Vertical front & rear door shutline seams
      const seamF = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.52, 0.02), matteTrimMat);
      seamF.position.set(0.46, isCheetah ? 0.08 : 0.14, zSide);
      const seamR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.52, 0.02), matteTrimMat);
      seamR.position.set(-0.48, isCheetah ? 0.08 : 0.14, zSide);
      // Horizontal lower body crease trim
      const rubStrip = new THREE.Mesh(
        new THREE.BoxGeometry(config.chassisLength * 0.68, 0.045, 0.025),
        matteTrimMat,
      );
      rubStrip.position.set(-0.04, isCheetah ? -0.02 : 0.02, zSide);
      chassisGroup.add(seamF, seamR, rubStrip);
    });
  }

  // Ranger & Monster heavy off-road hardware (Riveted Fender Flares, Stinger Bumper, Fog Pods, Grille)
  if (config.id === 'ranger' || config.id === 'monster') {
    const archClearanceRadius = config.wheelRadius * (1 + Math.min(0.08, upTires * 0.008)) + 0.14;
    const rivetGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6);
    rivetGeo.rotateX(Math.PI / 2);
    [-config.wheelbase * 0.5, config.wheelbase * 0.5].forEach((wx) => {
      [-bodyDepth * 0.55, bodyDepth * 0.55].forEach((wz) => {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(archClearanceRadius, 0.105, 8, 20, Math.PI),
          matteTrimMat,
        );
        arch.position.set(wx, -0.01, wz);
        arch.castShadow = true;
        chassisGroup.add(arch);

        // Exposed silver fender flare rivets
        for (let r = 1; r <= 5; r++) {
          const ang = (r / 6) * Math.PI;
          const riv = new THREE.Mesh(rivetGeo, chromeMat);
          riv.position.set(
            wx + Math.cos(ang) * (archClearanceRadius - 0.01),
            -0.01 + Math.sin(ang) * (archClearanceRadius - 0.01),
            wz + Math.sign(wz) * 0.095,
          );
          chassisGroup.add(riv);
        }
      });
    });

    [-bodyDepth * 0.54, bodyDepth * 0.54].forEach((sz) => {
      const slider = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.085, 0.15), darkMetalMat);
      slider.position.set(0, -0.14, sz);
      chassisGroup.add(slider);
    });

    const frontX = config.id === 'ranger' ? 1.98 : 2.16;
    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.24, bodyDepth * 1.14),
      darkMetalMat,
    );
    bumper.position.set(frontX, 0.0, 0);
    bumper.castShadow = true;
    chassisGroup.add(bumper);

    // Front Bumper Winch Drum + Fairlead Roller Assembly
    const winchBase = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.42), matteTrimMat);
    winchBase.position.set(frontX + 0.11, 0.06, 0);
    const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 12), chromeMat);
    winchDrum.rotation.x = Math.PI / 2;
    winchDrum.position.set(frontX + 0.14, 0.1, 0);
    const fairlead = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.22), chromeMat);
    fairlead.position.set(frontX + 0.19, 0.02, 0);
    chassisGroup.add(winchBase, winchDrum, fairlead);

    // Welded steel stinger guard & twin bumper fog pods
    const bullBar = new THREE.Mesh(
      makeTube(
        [
          [frontX + 0.06, 0.08, -0.46],
          [frontX + 0.24, 0.42, -0.34],
          [frontX + 0.24, 0.42, 0.34],
          [frontX + 0.06, 0.08, 0.46],
        ],
        0.042,
      ),
      darkMetalMat,
    );
    chassisGroup.add(bullBar);

    const fogMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      emissive: '#fef3c7',
      emissiveIntensity: 1.4,
      roughness: 0.18,
    });
    [-0.22, 0.22].forEach((fz) => {
      const podShell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.1, 12),
        darkMetalMat,
      );
      podShell.rotation.z = Math.PI / 2;
      podShell.position.set(frontX + 0.12, 0.24, fz);
      const podLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, 0.04, 12),
        fogMat,
      );
      podLens.rotation.z = Math.PI / 2;
      podLens.position.set(frontX + 0.16, 0.24, fz);
      chassisGroup.add(podShell, podLens);
    });

    [-0.44, 0.44].forEach((tz) => {
      const hook = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.022, 6, 10),
        new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4, metalness: 0.5 }),
      );
      hook.position.set(frontX + 0.18, -0.02, tz);
      chassisGroup.add(hook);
    });

    const radCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.38, bodyDepth * 0.94),
      matteTrimMat,
    );
    radCore.position.set(frontX - 0.06, 0.28, 0);
    chassisGroup.add(radCore);

    for (let s = -3; s <= 3; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.048), darkMetalMat);
      slat.position.set(frontX - 0.02, 0.28, s * 0.1);
      chassisGroup.add(slat);
    }

    const rearBumper = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.2, bodyDepth * 1.1),
      darkMetalMat,
    );
    rearBumper.position.set(-config.chassisLength * 0.52, 0.02, 0);
    chassisGroup.add(rearBumper);

    if (config.id === 'ranger') {
      const spareBracket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.24), darkMetalMat);
      spareBracket.position.set(-1.92, 0.38, 0);
      chassisGroup.add(spareBracket);
      const spare = buildWheelMesh(
        config.wheelRadius * 0.82,
        0.34,
        wheelStyle,
        false,
        tireBumpTex,
        '#dc2626',
      );
      spare.rotation.y = Math.PI / 2;
      spare.position.set(-2.06, 0.38, 0);
      chassisGroup.add(spare);
    }
  }

  // Cheetah VC (GTA 6 Leonida Widebody Supercar) Hardware
  if (isCheetah) {
    // Widebody riveted fender flares + side skirts
    [-config.wheelbase * 0.5, config.wheelbase * 0.5].forEach((wx) => {
      [-bodyDepth * 0.54, bodyDepth * 0.54].forEach((wz) => {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(config.wheelRadius * 1.15, 0.09, 8, 18, Math.PI),
          forgedCarbonMat,
        );
        arch.position.set(wx, -0.05, wz);
        chassisGroup.add(arch);
      });
    });

    // Side carbon aero skirts & side intake vents
    [-bodyDepth * 0.56, bodyDepth * 0.56].forEach((sz) => {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.07, 0.16), forgedCarbonMat);
      skirt.position.set(0, -0.15, sz);
      chassisGroup.add(skirt);

      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.12), matteTrimMat);
      intake.position.set(-0.78, 0.18, sz * 0.94);
      chassisGroup.add(intake);
    });

    // Front carbon splitter + intercooler grille
    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.05, bodyDepth * 1.14),
      forgedCarbonMat,
    );
    splitter.position.set(2.08, -0.13, 0);
    chassisGroup.add(splitter);

    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.16, bodyDepth * 0.65),
      matteTrimMat,
    );
    grille.position.set(2.14, 0.02, 0);
    chassisGroup.add(grille);

    // Mid-engine clear glass louver + visible twin-turbo V8 plenum block
    const turboEngine = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.22, 0.62),
      new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: 0.72, roughness: 0.28 }),
    );
    turboEngine.position.set(-1.12, 0.36, 0);
    chassisGroup.add(turboEngine);

    const glassEngineBay = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.04, 0.78),
      glassMat,
    );
    glassEngineBay.position.set(-1.14, 0.56, 0);
    glassEngineBay.rotation.z = 0.28;
    chassisGroup.add(glassEngineBay);

    // Swan-neck carbon GT Active Aero Wing
    [-0.48, 0.48].forEach((wz) => {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.05), darkMetalMat);
      pylon.position.set(-1.95, 0.55, wz);
      pylon.rotation.z = 0.18;
      chassisGroup.add(pylon);
    });
    const activeWingGroup = new THREE.Group();
    activeWingGroup.name = 'activeWingGroup';
    activeWingGroup.position.set(-2.04, 0.78, 0);
    const gtWing = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.055, bodyDepth * 1.18),
      forgedCarbonMat,
    );
    gtWing.rotation.z = 0.12;
    activeWingGroup.add(gtWing);
    [-bodyDepth * 0.59, bodyDepth * 0.59].forEach((ez) => {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.03), forgedCarbonMat);
      endplate.position.set(0, -0.02, ez);
      activeWingGroup.add(endplate);
    });
    chassisGroup.add(activeWingGroup);

    // Rear diffuser fins + Full-width LED taillight bar
    const diffuser = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.16, bodyDepth * 1.02),
      forgedCarbonMat,
    );
    diffuser.position.set(-2.04, -0.1, 0);
    chassisGroup.add(diffuser);

    const rearLedBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.075, bodyDepth * 0.92),
      brakeLightMat,
    );
    rearLedBar.position.set(-2.09, 0.26, 0);
    chassisGroup.add(rearLedBar);
  }

  // Leonida Donk (GTA 6 Vice City Hi-Riser) Chrome Trim & Classic Body Hardware
  if (isDonk) {
    const frontBumper = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.18, bodyDepth * 1.12),
      chromeMat,
    );
    frontBumper.position.set(2.15, -0.02, 0);
    chassisGroup.add(frontBumper);

    const rearBumper = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.18, bodyDepth * 1.12),
      chromeMat,
    );
    rearBumper.position.set(-2.15, -0.02, 0);
    chassisGroup.add(rearBumper);

    const chromeGrille = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.22, bodyDepth * 0.7),
      chromeMat,
    );
    chromeGrille.position.set(2.15, 0.22, 0);
    chassisGroup.add(chromeGrille);

    // Chrome side body beltline molding
    [-bodyDepth * 0.56, bodyDepth * 0.56].forEach((sz) => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(3.85, 0.055, 0.04),
        chromeMat,
      );
      strip.position.set(0, 0.14, sz);
      chassisGroup.add(strip);
    });

    // Classic horizontal rear chrome taillight cluster
    const rearBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.12, bodyDepth * 0.88),
      brakeLightMat,
    );
    rearBar.position.set(-2.14, 0.26, 0);
    chassisGroup.add(rearBar);
  }

  // Tubular Roll Cage + Roof LED Lightbar
  if (config.hasRollCage) {
    const cageH = config.id === 'buggy' ? 1.12 : 1.44;
    const cageZ = bodyDepth * 0.45;
    [-cageZ, cageZ].forEach((zSide) => {
      const sideTube = new THREE.Mesh(
        makeTube(
          [
            [-1.18, 0.64, zSide],
            [-0.96, cageH, zSide],
            [0.34, cageH, zSide],
            [0.84, 0.68, zSide],
          ],
          0.055,
        ),
        darkMetalMat,
      );
      sideTube.castShadow = true;
      chassisGroup.add(sideTube);
    });

    [
      [-0.96, cageH],
      [0.34, cageH],
    ].forEach(([cx, cy]) => {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, cageZ * 2, 8),
        darkMetalMat,
      );
      bar.rotation.x = Math.PI / 2;
      bar.position.set(cx, cy, 0);
      chassisGroup.add(bar);
    });

    [-cageZ * 0.92, cageZ * 0.92].forEach((gz) => {
      const strut = new THREE.Mesh(
        makeTube(
          [
            [-0.94, cageH - 0.04, gz],
            [-1.38, 0.72, gz * 0.85],
          ],
          0.036,
        ),
        darkMetalMat,
      );
      chassisGroup.add(strut);
    });

    if (config.id !== 'buggy' && hasAcc('lightbar')) {
      // Heavy tubular expedition roof rack + recovery gear + 4 X-taped rally floodlights
      const rackY = cageH + 0.08;
      const rackFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.56, 0.06, bodyDepth * 0.84),
        darkMetalMat,
      );
      rackFrame.position.set(-0.28, rackY, 0);
      chassisGroup.add(rackFrame);

      [-bodyDepth * 0.41, bodyDepth * 0.41].forEach((rz) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.14, 0.045), darkMetalMat);
        rail.position.set(-0.28, rackY + 0.09, rz);
        chassisGroup.add(rail);
      });
      const rearRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.14, bodyDepth * 0.84),
        darkMetalMat,
      );
      rearRail.position.set(-1.05, rackY + 0.09, 0);
      chassisGroup.add(rearRail);

      // Strapped orange/charcoal traction recovery boards + cargo pack inside rack
      const cargoPack = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.13, bodyDepth * 0.58),
        new THREE.MeshStandardMaterial({ color: '#1e242d', roughness: 0.85 }),
      );
      cargoPack.position.set(-0.46, rackY + 0.09, 0);
      const recoveryBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.05, 0.34),
        new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.72 }),
      );
      recoveryBoard.position.set(-0.42, rackY + 0.18, 0.18);
      chassisGroup.add(cargoPack, recoveryBoard);

      // 4 Iconic Round X-Taped Rally Floodlights along roof rack brow
      const rallyFaceMat = new THREE.MeshStandardMaterial({
        map: rallyCoverTex,
        roughness: 0.35,
        metalness: 0.25,
      });
      for (let l = 0; l < 4; l++) {
        const lz = -0.45 + l * 0.3;
        const can = new THREE.Mesh(
          new THREE.CylinderGeometry(0.125, 0.11, 0.14, 14),
          darkMetalMat,
        );
        can.rotation.z = Math.PI / 2;
        can.position.set(0.45, rackY + 0.14, lz);
        can.castShadow = true;

        const face = new THREE.Mesh(new THREE.CircleGeometry(0.118, 16), rallyFaceMat);
        face.rotation.y = Math.PI / 2;
        face.position.set(0.525, rackY + 0.14, lz);
        chassisGroup.add(can, face);
      }
    }
  } else if (!isBike && hasAcc('lightbar')) {
    const barHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, bodyDepth * 0.65),
      darkMetalMat,
    );
    barHousing.position.set(-0.05, isCheetah ? 0.8 : isDonk ? 1.03 : 0.98, 0);
    chassisGroup.add(barHousing);
    for (let l = -2; l <= 2; l++) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.12), headlightMat);
      pod.position.set(0.02, isCheetah ? 0.8 : isDonk ? 1.03 : 0.98, l * 0.19);
      chassisGroup.add(pod);
    }
  }

  // Optional Selectable Accessories: Steel Bull Bar, River Snorkel, Rally Whip Flag
  if (!isBike && hasAcc('bullbar')) {
    const fx = config.chassisLength * 0.5 + 0.2;
    const guardBar = new THREE.Mesh(
      makeTube(
        [
          [fx, -0.04, -0.62],
          [fx + 0.16, 0.48, -0.52],
          [fx + 0.16, 0.48, 0.52],
          [fx, -0.04, 0.62],
        ],
        0.045,
      ),
      chromeMat,
    );
    chassisGroup.add(guardBar);

    const amberMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#f59e0b',
      emissiveIntensity: 1.5,
    });
    [-0.24, 0.24].forEach((fz) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 10), amberMat);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(fx + 0.15, 0.3, fz);
      chassisGroup.add(pod);
    });
  }

  if (!isBike && hasAcc('snorkel')) {
    const snorkelTube = new THREE.Mesh(
      makeTube(
        [
          [0.95, 0.36, bodyDepth * 0.52],
          [0.78, 0.65, bodyDepth * 0.53],
          [0.54, 1.32, bodyDepth * 0.48],
        ],
        0.052,
      ),
      matteTrimMat,
    );
    chassisGroup.add(snorkelTube);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.14), matteTrimMat);
    cap.position.set(0.51, 1.38, bodyDepth * 0.48);
    chassisGroup.add(cap);
  }

  let whipMastGroup: THREE.Group | null = null;
  let whipFlag: THREE.Mesh | null = null;
  if (hasAcc('whip_flag') || config.id === 'buggy' || config.id === 'ranger' || config.id === 'monster') {
    const mastX = -config.chassisLength * 0.46;
    const mastZ = isBike ? -0.14 : -bodyDepth * 0.42;
    whipMastGroup = new THREE.Group();
    whipMastGroup.position.set(mastX, 0.42, mastZ);
    chassisGroup.add(whipMastGroup);

    const springBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.042, 0.12, 8),
      darkMetalMat,
    );
    springBase.position.set(0, 0.06, 0);
    whipMastGroup.add(springBase);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.022, 1.38, 6),
      chromeMat,
    );
    mast.position.set(0, 0.75, 0);
    whipMastGroup.add(mast);

    if (hasAcc('whip_flag')) {
      whipFlag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.48, 0.24, 4, 1),
        new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#991b1b',
          emissiveIntensity: 0.35,
          side: THREE.DoubleSide,
          roughness: 0.58,
        }),
      );
      whipFlag.position.set(-0.24, 1.32, 0);
      whipMastGroup.add(whipFlag);
    } else {
      const tipBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 8, 8),
        new THREE.MeshStandardMaterial({ color: paint.accent, roughness: 0.3 }),
      );
      tipBall.position.set(0, 1.44, 0);
      whipMastGroup.add(tipBall);
    }
  }

  // Windshield Glass + A-Pillar & Roof Header Frame (No floating glass)
  if (
    config.id === 'ranger' ||
    config.id === 'monster' ||
    config.id === 'muscle' ||
    isCheetah ||
    isDonk
  ) {
    const wsGroup = new THREE.Group();
    wsGroup.position.set(
      config.id === 'muscle' ? 0.68 : isCheetah ? 0.72 : isDonk ? 0.74 : 0.66,
      isCheetah ? 0.56 : 0.96,
      0,
    );
    wsGroup.rotation.z = config.id === 'muscle' ? 0.78 : isCheetah ? 1.02 : isDonk ? 0.48 : 0.38;
    const wsH = isCheetah ? 0.56 : 0.62;
    const wsW = bodyDepth * 0.86;
    const ws = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, wsH, wsW),
      glassMat,
    );
    wsGroup.add(ws);

    // Left & right A-pillars + top/bottom frame bars
    [-wsW * 0.5, wsW * 0.5].forEach((pz) => {
      const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.068, wsH + 0.04, 0.065), matteTrimMat);
      aPillar.position.set(0, 0, pz);
      wsGroup.add(aPillar);
    });
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.055, wsW + 0.06), matteTrimMat);
    topBar.position.set(0, wsH * 0.5, 0);
    const cowlBar = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, wsW + 0.06), matteTrimMat);
    cowlBar.position.set(0, -wsH * 0.5, 0);
    wsGroup.add(topBar, cowlBar);

    chassisGroup.add(wsGroup);
  }

  // Muscle Supercharger Blower + Dual Stripes + Rear Ducktail Spoiler
  if (config.id === 'muscle') {
    const blower = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.26, 0.46), chromeMat);
    blower.position.set(1.25, 0.5, 0);
    chassisGroup.add(blower);

    const intakeScoop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.36), brakeLightMat);
    intakeScoop.position.set(1.48, 0.56, 0);
    chassisGroup.add(intakeScoop);

    [-0.19, 0.19].forEach((zOff) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.04, 0.18), secondaryMat);
      stripe.position.set(0.1, 0.44, zOff);
      chassisGroup.add(stripe);
    });

    const spoiler = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.12, bodyDepth * 0.98),
      matteTrimMat,
    );
    spoiler.position.set(-1.95, 0.48, 0);
    spoiler.rotation.z = -0.35;
    chassisGroup.add(spoiler);
  }

  // Buggy rear engine block + wing
  if (config.id === 'buggy') {
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.64), darkMetalMat);
    engine.position.set(-1.18, 0.52, 0);
    chassisGroup.add(engine);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, bodyDepth * 1.18), secondaryMat);
    wing.position.set(-1.42, 1.14, 0);
    wing.rotation.z = 0.2;
    chassisGroup.add(wing);
  }

  // Superbike USD Gold Forks & Engine Block
  if (isBike) {
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.42, 0.38), darkMetalMat);
    engineBlock.position.set(0.05, 0.18, 0);
    chassisGroup.add(engineBlock);

    [-0.15, 0.15].forEach((fz) => {
      const fork = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.85, 10),
        new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.88, roughness: 0.2 }),
      );
      fork.position.set(0.75, 0.12, fz);
      fork.rotation.z = 0.42;
      chassisGroup.add(fork);
    });
  }

  // Leonida "JACK-06" License Plates (Rear & Front on 4-wheelers)
  if (!isBike) {
    const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.42), plateMat);
    rearPlate.position.set(-config.chassisLength * 0.5 - 0.09, 0.08, 0);
    chassisGroup.add(rearPlate);

    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.4), plateMat);
    frontPlate.position.set(config.chassisLength * 0.5 + 0.09, 0.06, 0);
    chassisGroup.add(frontPlate);
  } else {
    const bikePlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.28), plateMat);
    bikePlate.position.set(-1.28, 0.52, 0);
    bikePlate.rotation.z = -0.35;
    chassisGroup.add(bikePlate);
  }

  // Headlights + Halo LED DRL Rings + Light Cones + Reactive Brake Lights
  const headX = isBike ? 1.18 : config.chassisLength * 0.5 + 0.05;
  const headY = isCheetah ? 0.16 : 0.29;
  const headZOffsets = isBike ? [0] : [-bodyDepth * 0.34, bodyDepth * 0.34];
  const headlightCones: THREE.Mesh[] = [];

  headZOffsets.forEach((hz) => {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 14), chromeMat);
    housing.rotation.z = Math.PI / 2;
    housing.position.set(headX - 0.02, headY, hz);
    chassisGroup.add(housing);

    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14), headlightMat);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(headX + 0.01, headY, hz);
    chassisGroup.add(lamp);

    // Halo LED DRL ring (GTA 6 signature crisp daytime running ring)
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 8, 20), haloDrlMat);
    halo.rotation.y = Math.PI / 2;
    halo.position.set(headX + 0.045, headY, hz);
    chassisGroup.add(halo);

    const coneMat = new THREE.MeshBasicMaterial({
      color: '#fff6cc',
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 9.5, 14, 1, true), coneMat);
    cone.rotation.z = Math.PI / 2;
    cone.position.set(headX + 4.8, headY - 0.12, hz);
    cone.visible = false;
    chassisGroup.add(cone);
    headlightCones.push(cone);

    if (!isBike) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.24), brakeLightMat);
      tail.position.set(-config.chassisLength * 0.5 - 0.02, isCheetah ? 0.26 : 0.28, hz);
      chassisGroup.add(tail);
    }
  });

  if (isBike) {
    const bikeTail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.18), brakeLightMat);
    bikeTail.position.set(-1.26, 0.65, 0);
    chassisGroup.add(bikeTail);
  }

  // Dual / Quad Upgraded Exhaust Pipes + Bore Tips
  const exhaustOffsets = isBike
    ? upEngine >= 4
      ? [-0.18, 0.18]
      : [0.18]
    : isCheetah || upEngine >= 5
      ? [-bodyDepth * 0.3, -bodyDepth * 0.2, bodyDepth * 0.2, bodyDepth * 0.3]
      : [-bodyDepth * 0.28, bodyDepth * 0.28];
  const pipeRadiusScale = 1 + Math.min(0.25, (upEngine - 1) * 0.03);
  exhaustOffsets.forEach((ez) => {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075 * pipeRadiusScale, 0.095 * pipeRadiusScale, 0.58, 12),
      chromeMat,
    );
    pipe.rotation.z = Math.PI / 2 - 0.1;
    pipe.position.set(-config.chassisLength * 0.5 - 0.16, -0.02, ez);
    chassisGroup.add(pipe);

    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052 * pipeRadiusScale, 0.052 * pipeRadiusScale, 0.06, 10),
      matteTrimMat,
    );
    bore.rotation.z = Math.PI / 2 - 0.1;
    bore.position.set(-config.chassisLength * 0.5 - 0.44, -0.05, ez);
    chassisGroup.add(bore);
  });

  // Auxiliary Fuel Tank Upgrade Visual (RotopaX red expedition pack at lv >= 3)
  if (!isBike && upFuel >= 3) {
    const auxPack = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.32, 0.14),
      new THREE.MeshPhysicalMaterial({ color: '#dc2626', roughness: 0.35, clearcoat: 0.5 }),
    );
    auxPack.position.set(-config.chassisLength * 0.34, 0.54, bodyDepth * 0.54);
    const auxCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.3 }),
    );
    auxCap.position.set(-config.chassisLength * 0.34 + 0.14, 0.71, bodyDepth * 0.54);
    chassisGroup.add(auxPack, auxCap);
  }

  // Backfire Exhaust Pop Flames (flashes orange/amber on upshifts & throttle release)
  const backfireGlow = new THREE.Group();
  const bfMatOuter = new THREE.MeshBasicMaterial({
    color: '#fb923c',
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const bfMatCore = new THREE.MeshBasicMaterial({
    color: '#fef08a',
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const primaryExhaustZ = isBike ? [0.18] : [-bodyDepth * 0.28, bodyDepth * 0.28];
  primaryExhaustZ.forEach((ez) => {
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.72, 10), bfMatOuter);
    outer.rotation.z = Math.PI / 2;
    outer.position.set(-config.chassisLength * 0.5 - 0.75, -0.06, ez);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 8), bfMatCore);
    core.rotation.z = Math.PI / 2;
    core.position.set(-config.chassisLength * 0.5 - 0.62, -0.06, ez);
    backfireGlow.add(outer, core);
  });
  backfireGlow.visible = false;
  chassisGroup.add(backfireGlow);

  // Nitro Afterburner Plume
  const nitroGlow = new THREE.Group();
  const outerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 1.35, 12),
    new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  outerFlame.rotation.z = Math.PI / 2;
  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.85, 10),
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  innerFlame.rotation.z = Math.PI / 2;
  innerFlame.position.x = 0.2;
  nitroGlow.add(outerFlame, innerFlame);
  nitroGlow.position.set(-config.chassisLength * 0.5 - 1.0, -0.06, isBike ? 0.18 : bodyDepth * 0.28);
  nitroGlow.visible = false;
  chassisGroup.add(nitroGlow);

  // Soft Grounded Per-Tire Contact Shadows & Chassis Ambient Occlusion Footprint (No Fake White/Cyan Blob!)
  const makeShadowDisc = (w: number, d: number, opacity: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({
        map: neonGlowTex,
        color: '#03060c',
        transparent: true,
        opacity,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  const tireShadowW = config.wheelRadius * 2.4;
  const tireShadowD = isBike ? 0.72 : bodyDepth * 1.58;
  const tireShadowRear = makeShadowDisc(tireShadowW, tireShadowD, 0.64);
  const tireShadowFront = makeShadowDisc(tireShadowW, tireShadowD, 0.64);
  const chassisAoShadow = makeShadowDisc(
    config.chassisLength * 1.08,
    isBike ? 0.9 : bodyDepth * 1.52,
    0.46,
  );
  root.add(tireShadowRear, tireShadowFront, chassisAoShadow);

  // Optional Underbody Neon Underglow Kit (strictly off by default; casts subtle downward PointLight + soft radial spill when toggled on)
  let neonPoolMesh: THREE.Mesh | null = null;
  let neonLight: THREE.PointLight | null = null;
  if (neonColorId !== 'off') {
    const neonHex = NEON_COLORS.find((n) => n.id === neonColorId)?.hex ?? '#22d3ee';
    const neonBarMat = new THREE.MeshBasicMaterial({ color: neonHex });
    const railOffsets = isBike ? [0] : [-bodyDepth * 0.42, bodyDepth * 0.42];
    railOffsets.forEach((nz) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(config.chassisLength * 0.78, 0.04, 0.055),
        neonBarMat,
      );
      rail.position.set(0, -0.22, nz);
      chassisGroup.add(rail);
    });

    neonLight = new THREE.PointLight(neonHex, 5.2, 4.4, 1.8);
    neonLight.position.set(0, -0.26, 0);
    chassisGroup.add(neonLight);

    neonPoolMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(config.chassisLength * 1.05, bodyDepth * 1.65),
      new THREE.MeshBasicMaterial({
        map: neonGlowTex,
        color: neonHex,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    neonPoolMesh.rotation.x = -Math.PI / 2;
    neonPoolMesh.position.set(0, 0.03, 0);
    root.add(neonPoolMesh);
  }

  // Articulated Helmeted Driver (with Rider Lean Group on Superbike)
  const driver = buildDriver(isBike, isBike || isCheetah, paint.accent, paint.primary);
  let riderLeanGroup: THREE.Group | null = null;
  if (isBike) {
    riderLeanGroup = new THREE.Group();
    riderLeanGroup.position.set(config.headX, 0.56, 0);
    riderLeanGroup.add(driver.root);
    chassisGroup.add(riderLeanGroup);
  } else {
    driver.root.position.set(config.headX, isCheetah ? 0.26 : 0.42, 0);
    chassisGroup.add(driver.root);
  }

  // Sport Steering Wheel & Column
  if (!isBike) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.36, 8), darkMetalMat);
    col.position.set(0.48, isCheetah ? 0.4 : 0.54, 0);
    col.rotation.z = 1.1;
    chassisGroup.add(col);

    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 8, 16), matteTrimMat);
    sw.position.set(0.36, isCheetah ? 0.48 : 0.62, 0);
    sw.rotation.y = Math.PI / 2;
    sw.rotation.x = 0.45;
    chassisGroup.add(sw);
  }

  let headlightSpot: THREE.SpotLight | null = null;
  if (withSpotLight) {
    headlightSpot = new THREE.SpotLight('#fff6d1', 20, 42, Math.PI / 4.6, 0.55, 1.25);
    headlightSpot.position.set(headX + 0.1, headY + 0.08, 0);
    headlightSpot.target.position.set(headX + 15, -1.6, 0);
    chassisGroup.add(headlightSpot);
    chassisGroup.add(headlightSpot.target);
  }

  // Dual-Wheel Axles (Tire radius/width respond visibly to Tires upgrade) + 4WD Front Diff + Telescoping Coilovers
  const tireScaleBonus = 1 + Math.min(0.085, Math.max(0, upTires - 1) * 0.009);
  const wheelWidth =
    (isBike ? 0.32 : config.id === 'monster' ? 0.74 : isCheetah ? 0.5 : 0.46) *
    (1 + Math.min(0.14, Math.max(0, upTires - 1) * 0.015));
  const wheelRearGroup = new THREE.Group();
  const wheelFrontGroup = new THREE.Group();
  const caliperColor = paint.id === 'frontier_red' ? '#facc15' : '#ef4444';

  const wheelRearSpin = buildWheelMesh(
    config.wheelRadius * config.rearWheelScale * tireScaleBonus,
    wheelWidth,
    wheelStyle,
    isBike,
    tireBumpTex,
    caliperColor,
    isDonk,
  );
  const wheelFrontSpin = buildWheelMesh(
    config.wheelRadius * config.frontWheelScale * tireScaleBonus,
    wheelWidth,
    wheelStyle,
    isBike,
    tireBumpTex,
    caliperColor,
    isDonk,
  );

  const axleSpread = isBike ? [0] : [-bodyDepth * 0.54, bodyDepth * 0.54];
  const makeAxle = (spinModel: THREE.Group, targetGroup: THREE.Group, showFront4wd: boolean) => {
    const spinContainer = new THREE.Group();
    axleSpread.forEach((zPos, idx) => {
      const clone = idx === 0 ? spinModel : spinModel.clone();
      clone.position.z = zPos;
      spinContainer.add(clone);
    });
    if (!isBike) {
      const axleShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(showFront4wd ? 0.085 : 0.072, showFront4wd ? 0.085 : 0.072, bodyDepth * 1.06, 10),
        showFront4wd ? chromeMat : darkMetalMat,
      );
      axleShaft.rotation.x = Math.PI / 2;
      spinContainer.add(axleShaft);

      const diffPumpkin = new THREE.Mesh(
        new THREE.SphereGeometry(showFront4wd ? 0.175 : 0.15, 12, 10),
        darkMetalMat,
      );
      spinContainer.add(diffPumpkin);
    }
    targetGroup.add(spinContainer);
    return spinContainer;
  };

  const rearSpinContainer = makeAxle(wheelRearSpin, wheelRearGroup, false);
  const frontSpinContainer = makeAxle(wheelFrontSpin, wheelFrontGroup, upAwd >= 3);

  const shockRear = buildCoiloverShock(paint.accent, upSusp);
  const shockFront = buildCoiloverShock(paint.accent, upSusp);
  shockRear.group.position.z = bodyDepth * 0.48;
  shockFront.group.position.z = bodyDepth * 0.48;
  chassisGroup.add(shockRear.group, shockFront.group);

  const armRear = new THREE.Group();
  const armFront = new THREE.Group();
  const buildArmBar = (dir: number) => {
    const g = new THREE.Group();
    const link = new THREE.Mesh(
      new THREE.BoxGeometry(config.wheelbase * 0.46, 0.08, 0.1),
      darkMetalMat,
    );
    link.position.set(dir * config.wheelbase * 0.23, 0, bodyDepth * 0.4);
    g.add(link);
    return g;
  };
  armRear.add(buildArmBar(-1));
  armFront.add(buildArmBar(1));
  armRear.position.set(-0.22, -0.1, 0);
  armFront.position.set(0.22, -0.1, 0);
  chassisGroup.add(armRear, armFront);

  root.add(wheelRearGroup, wheelFrontGroup);

  const activeWing = isCheetah
    ? (chassisGroup.getObjectByName('activeWingGroup') as THREE.Group | null) ?? null
    : null;

  const dispose = () => {
    disposableTextures.forEach((tex) => tex.dispose());
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
  };

  return {
    root,
    chassisGroup,
    wheelRearGroup,
    wheelFrontGroup,
    wheelRearSpin: rearSpinContainer,
    wheelFrontSpin: frontSpinContainer,
    shockRear,
    shockFront,
    armRear,
    armFront,
    driverTorso: driver.torsoGroup,
    driverHead: driver.headGroup,
    riderLeanGroup,
    activeWing,
    headlightSpot,
    headlightCones,
    brakeLightMat,
    dirtMat,
    nitroGlow,
    backfireGlow,
    neonPoolMesh,
    neonLight,
    tireShadowRear,
    tireShadowFront,
    chassisAoShadow,
    whipMastGroup,
    whipFlag,
    dispose,
  };
}

export function buildCoin3D(value: number, maxAniso: number): THREE.Group {
  const g = new THREE.Group();
  const faceTex = createCoinTexture(value, maxAniso);
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    metalness: 0.9,
    roughness: 0.16,
    emissive: '#92400e',
    emissiveIntensity: 0.25,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    metalness: 0.58,
    roughness: 0.18,
    emissive: '#b45309',
    emissiveIntensity: 0.24,
  });

  // Tilt coin ~25 deg toward the side-scroll camera so its face always catches specular gleam
  const coinTilt = new THREE.Group();
  coinTilt.rotation.y = 0.42;
  coinTilt.rotation.x = 0.22;

  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.16, 26),
    [rimMat, faceMat, faceMat],
  );
  cyl.rotation.x = Math.PI / 2;
  cyl.castShadow = true;

  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.045, 8, 26), rimMat);
  coinTilt.add(cyl, bezel);
  g.add(coinTilt);

  const shadowMat = new THREE.MeshBasicMaterial({
    color: '#020617',
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = -0.82;
  g.add(shadowDisc);

  return g;
}

export function buildFuelCan3D(): THREE.Group {
  const g = new THREE.Group();
  const redMat = new THREE.MeshPhysicalMaterial({
    color: '#dc2626',
    roughness: 0.32,
    metalness: 0.12,
    clearcoat: 0.65,
    emissive: '#7f1d1d',
    emissiveIntensity: 0.22,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: '#991b1b',
    roughness: 0.52,
    metalness: 0.1,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.28,
    metalness: 0.14,
    emissive: '#a16207',
    emissiveIntensity: 0.18,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.55,
    metalness: 0.25,
  });

  // Main beveled HDPE jerrycan body
  const jerryShape = new THREE.Shape();
  jerryShape.moveTo(-0.36, -0.46);
  jerryShape.lineTo(0.36, -0.46);
  jerryShape.lineTo(0.4, 0.24);
  jerryShape.lineTo(0.24, 0.44);
  jerryShape.lineTo(-0.32, 0.44);
  jerryShape.lineTo(-0.4, 0.26);
  jerryShape.closePath();

  const tankGeo = new THREE.ExtrudeGeometry(jerryShape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  tankGeo.translate(0, 0, -0.19);
  const tank = new THREE.Mesh(tankGeo, redMat);
  tank.castShadow = true;
  g.add(tank);

  // Molded top carry grip bars
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.13), redMat);
  handle.position.set(-0.14, 0.5, 0);
  g.add(handle);

  // Classic diagonal stamped X-ribs on both sides (unmistakable gasoline jerrycan silhouette)
  [-0.235, 0.235].forEach((zSide) => {
    const frameRim = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.56, 0.03), ribMat);
    frameRim.position.set(0, -0.04, zSide);
    g.add(frameRim);

    [-0.78, 0.78].forEach((ang) => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.065, 0.05), redMat);
      rib.position.set(0, -0.04, zSide + Math.sign(zSide) * 0.015);
      rib.rotation.z = ang;
      g.add(rib);
    });
  });

  // Threaded filler collar, vent cap & angled yellow pouring nozzle spout
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.08, 12), darkMat);
  collar.position.set(0.24, 0.46, 0);
  collar.rotation.z = -0.35;
  g.add(collar);

  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.34, 12), capMat);
  spout.position.set(0.34, 0.61, 0);
  spout.rotation.z = -0.58;
  g.add(spout);

  const ventCap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), darkMat);
  ventCap.position.set(-0.28, 0.46, 0);
  g.add(ventCap);

  return g;
}

export function buildGhostVehicle3D(
  config: VehicleConfig,
  colorHex = '#fbbf24',
  opacity = 0.28,
): GhostRig3D {
  const root = new THREE.Group();
  const isBike = config.id === 'superbike';
  const ghostBodyMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const ghostWheelMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: Math.min(0.85, opacity + 0.08),
    depthWrite: false,
  });

  const bodyDepth = isBike ? 0.42 : 1.32;
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(config.chassisLength * 0.92, config.chassisHeight * 0.48, bodyDepth),
    ghostBodyMat,
  );
  hull.position.set(0, 0.2, 0);
  root.add(hull);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(config.chassisLength * 0.46, config.chassisHeight * 0.42, bodyDepth * 0.84),
    ghostBodyMat,
  );
  cabin.position.set(config.headX * 0.6, config.chassisHeight * 0.54, 0);
  root.add(cabin);

  const rRadius = config.wheelRadius * config.rearWheelScale;
  const fRadius = config.wheelRadius * config.frontWheelScale;
  const wWidth = isBike ? 0.28 : 0.4;

  const rearGeo = new THREE.CylinderGeometry(rRadius, rRadius, wWidth, 18);
  rearGeo.rotateX(Math.PI / 2);
  const wheelRear = new THREE.Mesh(rearGeo, ghostWheelMat);
  wheelRear.position.set(-config.wheelbase * 0.5, -config.suspensionRest * 0.72, 0);
  root.add(wheelRear);

  const frontGeo = new THREE.CylinderGeometry(fRadius, fRadius, wWidth, 18);
  frontGeo.rotateX(Math.PI / 2);
  const wheelFront = new THREE.Mesh(frontGeo, ghostWheelMat);
  wheelFront.position.set(config.wheelbase * 0.5, -config.suspensionRest * 0.72, 0);
  root.add(wheelFront);

  // Place slightly behind player Z-plane so rival never obscures player rig in orthographic side-view
  root.position.z = -1.35;

  const dispose = () => {
    hull.geometry.dispose();
    cabin.geometry.dispose();
    rearGeo.dispose();
    frontGeo.dispose();
    ghostBodyMat.dispose();
    ghostWheelMat.dispose();
  };

  return { root, wheelRear, wheelFront, dispose };
}
