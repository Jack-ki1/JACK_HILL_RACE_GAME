import * as THREE from 'three';
import { NEON_COLORS } from './constants';
import {
  LiveryId,
  NeonColorId,
  PaintSwatch,
  VehicleAccessoryId,
  VehicleConfig,
  WheelStyleConfig,
} from '../types/game';
import {
  createCoinTexture,
  createDirtOverlayTexture,
  createLicensePlateTexture,
  createLiveryTexture,
  createSoftGlowTexture,
  createTireBumpTexture,
} from './textures';

export interface VehicleRig3D {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  wheelRearGroup: THREE.Group;
  wheelFrontGroup: THREE.Group;
  wheelRearSpin: THREE.Group;
  wheelFrontSpin: THREE.Group;
  shockRear: THREE.Group;
  shockFront: THREE.Group;
  armRear: THREE.Group;
  armFront: THREE.Group;
  driverTorso: THREE.Group;
  driverHead: THREE.Group;
  headlightSpot: THREE.SpotLight | null;
  headlightCones: THREE.Mesh[];
  brakeLightMat: THREE.MeshStandardMaterial;
  dirtMat: THREE.MeshStandardMaterial;
  nitroGlow: THREE.Group;
  backfireGlow: THREE.Group;
  neonPoolMesh: THREE.Mesh | null;
  whipFlag: THREE.Mesh | null;
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
    roughness: 0.86,
    metalness: 0.05,
    bumpMap: tireBumpTex,
    bumpScale: 0.035,
  });
  const treadMat = new THREE.MeshStandardMaterial({
    color: '#23262d',
    roughness: 0.92,
    metalness: 0.04,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: isDonk ? '#f8fafc' : style.rimColor,
    roughness: isDonk ? 0.08 : style.roughness,
    metalness: isDonk ? 0.96 : style.metalness,
  });
  const hubMat = new THREE.MeshStandardMaterial({
    color: '#343b46',
    roughness: 0.32,
    metalness: 0.84,
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
  const tireGeo = new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, width, 28);
  tireGeo.rotateX(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheel.add(tire);

  // Sculpted sidewall torus shoulders
  const sideRatio = isDonk ? 0.86 : 0.74;
  const sideTube = isDonk ? 0.09 : 0.2;
  const sideGeo = new THREE.TorusGeometry(radius * sideRatio, radius * sideTube, 12, 28);
  const sideF = new THREE.Mesh(sideGeo, tireMat);
  sideF.position.z = width * 0.33;
  const sideB = new THREE.Mesh(sideGeo, tireMat);
  sideB.position.z = -width * 0.33;
  wheel.add(sideF, sideB);

  // Staggered off-road knobby tread blocks / sport tire ribs
  const lugCount = isBike || isDonk ? 20 : 16;
  const lugGeo = new THREE.BoxGeometry(
    isBike || isDonk ? 0.055 : 0.13,
    isDonk ? 0.04 : 0.085,
    width * (isBike ? 0.62 : 0.42),
  );
  for (let i = 0; i < lugCount; i++) {
    const a = (i / lugCount) * Math.PI * 2;
    const lug = new THREE.Mesh(lugGeo, treadMat);
    const zShift = isBike ? 0 : i % 2 === 0 ? width * 0.22 : -width * 0.22;
    lug.position.set(
      Math.cos(a) * radius * 0.94,
      Math.sin(a) * radius * 0.94,
      zShift,
    );
    lug.rotation.z = a + Math.PI / 2;
    lug.castShadow = true;
    wheel.add(lug);
  }

  // Deep-dish stepped alloy rim barrel (oversized 28" dish on Leonida Donk)
  const rimRadius = radius * (isDonk ? 0.78 : 0.56);
  const rimLipGeo = new THREE.TorusGeometry(rimRadius * 0.96, 0.045, 8, 24);
  const lipF = new THREE.Mesh(rimLipGeo, rimMat);
  lipF.position.z = width * 0.36;
  const lipB = new THREE.Mesh(rimLipGeo, rimMat);
  lipB.position.z = -width * 0.36;
  wheel.add(lipF, lipB);

  const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width * 0.74, 24);
  rimGeo.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheel.add(rim);

  // Brake rotor disc + caliper tucked inside wheel barrel
  const rotor = new THREE.Mesh(
    new THREE.CylinderGeometry(rimRadius * 0.72, rimRadius * 0.72, 0.05, 20),
    rotorMat,
  );
  rotor.rotation.x = Math.PI / 2;
  rotor.position.z = -width * 0.05;
  wheel.add(rotor);

  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(rimRadius * 0.36, rimRadius * 0.5, 0.12),
    caliperMat,
  );
  caliper.position.set(-rimRadius * 0.45, rimRadius * 0.32, width * 0.05);
  caliper.rotation.z = 0.5;
  wheel.add(caliper);

  // Sculpted wheel spokes
  const spokeCount = isDonk ? 10 : style.spokeCount;
  const spokeGeo = new THREE.BoxGeometry(rimRadius * 1.84, isDonk ? 0.048 : 0.075, width * 0.16);
  for (let s = 0; s < spokeCount; s++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.z = (s / spokeCount) * Math.PI;
    spoke.position.z = width * 0.25;
    wheel.add(spoke);
  }

  // Beadlock / floating center cap bolts around rim lip
  const beadCount = 10;
  const boltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.04, 6);
  boltGeo.rotateX(Math.PI / 2);
  for (let b = 0; b < beadCount; b++) {
    const a = (b / beadCount) * Math.PI * 2;
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(
      Math.cos(a) * rimRadius * 0.88,
      Math.sin(a) * rimRadius * 0.88,
      width * 0.39,
    );
    wheel.add(bolt);
  }

  // Center locking hub & 5 lug nuts
  const hubGeo = new THREE.CylinderGeometry(rimRadius * 0.32, rimRadius * 0.36, width * 0.86, 16);
  hubGeo.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, isDonk ? rimMat : hubMat);
  wheel.add(hub);

  return wheel;
}

function buildCoiloverShock(paintAccent: string): THREE.Group {
  const g = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    metalness: 0.92,
    roughness: 0.14,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.78,
    roughness: 0.3,
  });
  const coilMat = new THREE.MeshStandardMaterial({
    color: paintAccent,
    metalness: 0.38,
    roughness: 0.28,
  });

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 1, 10), shaftMat);
  rod.position.y = 0.5;
  g.add(rod);

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.42, 10), bodyMat);
  sleeve.position.y = 0.76;
  g.add(sleeve);

  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.023, 7, 14), coilMat);
    ring.rotation.x = Math.PI / 2 + 0.15;
    ring.position.y = 0.16 + i * 0.125;
    g.add(ring);
  }
  return g;
}

function buildDriver(
  isBike: boolean,
  accentHex: string,
  primaryHex: string,
): {
  root: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
} {
  const driver = new THREE.Group();

  const jacketMat = new THREE.MeshStandardMaterial({
    color: isBike ? '#192130' : '#b91c1c',
    roughness: 0.74,
    metalness: 0.08,
  });
  const jeansMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.85,
    metalness: 0.04,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: '#111827',
    roughness: 0.55,
    metalness: 0.15,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#e5a982',
    roughness: 0.58,
    metalness: 0.02,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#18181b',
    roughness: 0.52,
    metalness: 0.12,
  });
  const harnessMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.6,
    metalness: 0.1,
  });
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: isBike ? primaryHex : '#dc2626',
    roughness: 0.2,
    metalness: 0.3,
    clearcoat: 0.9,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: '#0f172a',
    roughness: 0.08,
    metalness: 0.65,
    clearcoat: 1.0,
    iridescence: isBike ? 0.85 : 0.25,
  });
  const goggleStrapMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.8,
  });

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.34), jeansMat);
  pelvis.position.set(0, 0.06, 0);
  driver.add(pelvis);

  [-0.12, 0.12].forEach((zLeg) => {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.28, 5, 10), jeansMat);
    thigh.position.set(isBike ? 0.12 : 0.2, 0.04, zLeg);
    thigh.rotation.z = isBike ? -1.15 : -1.38;
    driver.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.26, 5, 10), jeansMat);
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
    new THREE.CylinderGeometry(0.19, 0.145, 0.42, 12),
    jacketMat,
  );
  chest.position.set(0, 0.22, 0);
  chest.scale.set(0.86, 1, 1.18);
  chest.rotation.z = isBike ? -0.46 : -0.12;
  chest.castShadow = true;
  torsoGroup.add(chest);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.035, 6, 12),
    bootMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(isBike ? 0.09 : 0.02, 0.43, 0);
  torsoGroup.add(collar);

  [-0.1, 0.1].forEach((zStrap) => {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.36, 0.055),
      isBike ? jacketMat : harnessMat,
    );
    strap.position.set(isBike ? 0.1 : 0.09, 0.24, zStrap);
    strap.rotation.z = isBike ? -0.46 : -0.12;
    torsoGroup.add(strap);
  });

  [-0.21, 0.21].forEach((zSide) => {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), jacketMat);
    shoulder.position.set(isBike ? 0.06 : 0.0, 0.36, zSide);
    torsoGroup.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.2, 5, 8), jacketMat);
    upperArm.position.set(isBike ? 0.18 : 0.14, 0.28, zSide);
    upperArm.rotation.z = isBike ? -0.95 : -0.92;
    torsoGroup.add(upperArm);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.2, 5, 8), jacketMat);
    forearm.position.set(isBike ? 0.34 : 0.32, 0.24, zSide * 0.85);
    forearm.rotation.z = isBike ? -1.42 : -1.25;
    torsoGroup.add(forearm);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), gloveMat);
    glove.position.set(isBike ? 0.46 : 0.44, 0.26, zSide * 0.72);
    torsoGroup.add(glove);
  });

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.12, 10), skinMat);
  neck.position.set(isBike ? 0.1 : 0.02, 0.46, 0);
  torsoGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(isBike ? 0.14 : 0.03, isBike ? 0.54 : 0.58, 0);
  torsoGroup.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 14), skinMat);
  cranium.scale.set(1.04, 1.08, 0.94);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.19), skinMat);
  jaw.position.set(0.05, -0.09, 0);
  jaw.rotation.z = -0.15;
  headGroup.add(jaw);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.065, 6), skinMat);
  nose.rotation.z = -Math.PI / 2.2;
  nose.position.set(0.18, -0.02, 0);
  headGroup.add(nose);

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.198, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
    helmetMat,
  );
  shell.position.y = 0.02;
  shell.castShadow = true;
  headGroup.add(shell);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.04, 0.06),
    new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.25 }),
  );
  stripe.position.set(-0.02, 0.2, 0);
  headGroup.add(stripe);

  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.26), helmetMat);
  peak.position.set(0.16, 0.12, 0);
  peak.rotation.z = -0.18;
  headGroup.add(peak);

  const goggleBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.196, 0.196, 0.06, 16, 1, true),
    goggleStrapMat,
  );
  goggleBand.position.set(-0.01, 0.02, 0);
  headGroup.add(goggleBand);

  const goggles = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.085, 0.27),
    visorMat,
  );
  goggles.position.set(0.15, 0.025, 0);
  headGroup.add(goggles);

  if (isBike) {
    const chinBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.28), helmetMat);
    chinBar.position.set(0.13, -0.1, 0);
    headGroup.add(chinBar);
  } else {
    [-0.18, 0.18].forEach((zEar) => {
      const earCup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.035, 10),
        goggleStrapMat,
      );
      earCup.rotation.x = Math.PI / 2;
      earCup.position.set(-0.01, -0.02, zEar);
      headGroup.add(earCup);
    });
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
): VehicleRig3D {
  const hasAcc = (id: VehicleAccessoryId) => accessories.includes(id);
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const tireBumpTex = createTireBumpTexture(maxAniso);
  const plateTex = createLicensePlateTexture('JACK-06', maxAniso);
  const neonGlowTex = createSoftGlowTexture();
  const dirtTex = createDirtOverlayTexture(maxAniso);
  const disposableTextures: THREE.Texture[] = [tireBumpTex, plateTex, neonGlowTex, dirtTex];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: paint.primary,
    metalness: paint.metalness,
    roughness: paint.roughness,
    clearcoat: paint.clearcoat,
    clearcoatRoughness: 0.11,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: paint.secondary,
    metalness: 0.42,
    roughness: 0.38,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: '#1b2029',
    metalness: 0.76,
    roughness: 0.38,
  });
  const forgedCarbonMat = new THREE.MeshStandardMaterial({
    color: '#141821',
    metalness: 0.38,
    roughness: 0.58,
  });
  const matteTrimMat = new THREE.MeshStandardMaterial({
    color: '#14171f',
    metalness: 0.15,
    roughness: 0.82,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#edf2f7',
    metalness: 0.95,
    roughness: 0.12,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#a8dcff',
    metalness: 0.05,
    roughness: 0.08,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.56,
  });
  const interiorMat = new THREE.MeshStandardMaterial({
    color: '#1f242e',
    roughness: 0.78,
    metalness: 0.12,
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

  // Hood Sculpted Power Bulge (4-wheelers)
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

  // Ranger & Monster heavy off-road hardware
  if (config.id === 'ranger' || config.id === 'monster') {
    [-config.wheelbase * 0.5, config.wheelbase * 0.5].forEach((wx) => {
      [-bodyDepth * 0.53, bodyDepth * 0.53].forEach((wz) => {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(config.wheelRadius * 1.14, 0.1, 8, 16, Math.PI),
          matteTrimMat,
        );
        arch.position.set(wx, -0.02, wz);
        arch.castShadow = true;
        chassisGroup.add(arch);
      });
    });

    [-bodyDepth * 0.54, bodyDepth * 0.54].forEach((sz) => {
      const slider = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.14), darkMetalMat);
      slider.position.set(0, -0.14, sz);
      chassisGroup.add(slider);
    });

    const frontX = config.id === 'ranger' ? 1.96 : 2.14;
    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.22, bodyDepth * 1.12),
      darkMetalMat,
    );
    bumper.position.set(frontX, 0.02, 0);
    bumper.castShadow = true;
    chassisGroup.add(bumper);

    const bullBar = new THREE.Mesh(
      makeTube(
        [
          [frontX + 0.04, 0.1, -0.45],
          [frontX + 0.12, 0.44, -0.35],
          [frontX + 0.12, 0.44, 0.35],
          [frontX + 0.04, 0.1, 0.45],
        ],
        0.04,
      ),
      darkMetalMat,
    );
    chassisGroup.add(bullBar);

    [-0.42, 0.42].forEach((tz) => {
      const hook = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.022, 6, 10),
        new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.4, metalness: 0.5 }),
      );
      hook.position.set(frontX + 0.14, 0.0, tz);
      chassisGroup.add(hook);
    });

    const radCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.34, bodyDepth * 0.62),
      matteTrimMat,
    );
    radCore.position.set(frontX - 0.06, 0.28, 0);
    chassisGroup.add(radCore);

    for (let s = -3; s <= 3; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.055), chromeMat);
      slat.position.set(frontX - 0.02, 0.28, s * 0.13);
      chassisGroup.add(slat);
    }

    const rearBumper = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.2, bodyDepth * 1.08),
      darkMetalMat,
    );
    rearBumper.position.set(-config.chassisLength * 0.52, 0.02, 0);
    chassisGroup.add(rearBumper);

    if (config.id === 'ranger') {
      const spare = buildWheelMesh(
        config.wheelRadius * 0.8,
        0.32,
        wheelStyle,
        false,
        tireBumpTex,
        '#dc2626',
      );
      spare.rotation.y = Math.PI / 2;
      spare.position.set(-2.02, 0.38, 0);
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

    // Swan-neck carbon GT Wing
    [-0.48, 0.48].forEach((wz) => {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.05), darkMetalMat);
      pylon.position.set(-1.95, 0.55, wz);
      pylon.rotation.z = 0.18;
      chassisGroup.add(pylon);
    });
    const gtWing = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.055, bodyDepth * 1.18),
      forgedCarbonMat,
    );
    gtWing.position.set(-2.04, 0.78, 0);
    gtWing.rotation.z = 0.14;
    chassisGroup.add(gtWing);

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
      const barHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.1, bodyDepth * 0.72),
        darkMetalMat,
      );
      barHousing.position.set(0.32, cageH + 0.08, 0);
      chassisGroup.add(barHousing);

      for (let l = -2; l <= 2; l++) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.14), headlightMat);
        pod.position.set(0.39, cageH + 0.08, l * 0.22);
        chassisGroup.add(pod);
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

  let whipFlag: THREE.Mesh | null = null;
  if (hasAcc('whip_flag')) {
    const mastX = -config.chassisLength * 0.48;
    const mastZ = isBike ? -0.14 : -bodyDepth * 0.42;
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.025, 1.45, 6),
      chromeMat,
    );
    mast.position.set(mastX, 0.92, mastZ);
    mast.rotation.z = 0.14;
    chassisGroup.add(mast);

    whipFlag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.24, 4, 1),
      new THREE.MeshStandardMaterial({
        color: '#ef4444',
        emissive: '#991b1b',
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide,
        roughness: 0.6,
      }),
    );
    whipFlag.position.set(mastX - 0.34, 1.52, mastZ);
    chassisGroup.add(whipFlag);
  }

  // Windshield Glass + Frame
  if (
    config.id === 'ranger' ||
    config.id === 'monster' ||
    config.id === 'muscle' ||
    isCheetah ||
    isDonk
  ) {
    const ws = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, isCheetah ? 0.54 : 0.6, bodyDepth * 0.84),
      glassMat,
    );
    ws.position.set(
      config.id === 'muscle' ? 0.68 : isCheetah ? 0.72 : isDonk ? 0.74 : 0.66,
      isCheetah ? 0.56 : 0.96,
      0,
    );
    ws.rotation.z = config.id === 'muscle' ? 0.78 : isCheetah ? 1.02 : isDonk ? 0.48 : 0.38;
    chassisGroup.add(ws);
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

  // Dual Exhaust Pipes + Dark Bore Tips & Multi-Layer Nitro + Backfire Flames
  const exhaustOffsets = isBike
    ? [0.18]
    : isCheetah
      ? [-bodyDepth * 0.3, -bodyDepth * 0.2, bodyDepth * 0.2, bodyDepth * 0.3]
      : [-bodyDepth * 0.28, bodyDepth * 0.28];
  exhaustOffsets.forEach((ez) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.58, 12), chromeMat);
    pipe.rotation.z = Math.PI / 2 - 0.1;
    pipe.position.set(-config.chassisLength * 0.5 - 0.16, -0.02, ez);
    chassisGroup.add(pipe);

    const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.06, 10), matteTrimMat);
    bore.rotation.z = Math.PI / 2 - 0.1;
    bore.position.set(-config.chassisLength * 0.5 - 0.44, -0.05, ez);
    chassisGroup.add(bore);
  });

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

  // Underbody Neon Underglow Kit (chassis light tubes + additive ground pool)
  let neonPoolMesh: THREE.Mesh | null = null;
  if (neonColorId !== 'off') {
    const neonHex = NEON_COLORS.find((n) => n.id === neonColorId)?.hex ?? '#22d3ee';
    const neonBarMat = new THREE.MeshBasicMaterial({ color: neonHex });
    const railOffsets = isBike ? [0] : [-bodyDepth * 0.42, bodyDepth * 0.42];
    railOffsets.forEach((nz) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(config.chassisLength * 0.78, 0.045, 0.06),
        neonBarMat,
      );
      rail.position.set(0, -0.22, nz);
      chassisGroup.add(rail);
    });

    neonPoolMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(config.chassisLength * 1.25, bodyDepth * 1.9),
      new THREE.MeshBasicMaterial({
        map: neonGlowTex,
        color: neonHex,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    neonPoolMesh.rotation.x = -Math.PI / 2;
    neonPoolMesh.position.set(0, 0.232, 0);
    root.add(neonPoolMesh);
  }

  // Articulated Anatomical Driver
  const driver = buildDriver(isBike, paint.accent, paint.primary);
  driver.root.position.set(config.headX, isBike ? 0.56 : isCheetah ? 0.26 : 0.42, 0);
  chassisGroup.add(driver.root);

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

  // Dual-Wheel Axles + Solid Diff Housing + Suspension Control Arms & Coilovers
  const wheelWidth = isBike ? 0.32 : config.id === 'monster' ? 0.74 : isCheetah ? 0.5 : 0.46;
  const wheelRearGroup = new THREE.Group();
  const wheelFrontGroup = new THREE.Group();
  const caliperColor = paint.id === 'frontier_red' ? '#facc15' : '#ef4444';

  const wheelRearSpin = buildWheelMesh(
    config.wheelRadius * config.rearWheelScale,
    wheelWidth,
    wheelStyle,
    isBike,
    tireBumpTex,
    caliperColor,
    isDonk,
  );
  const wheelFrontSpin = buildWheelMesh(
    config.wheelRadius * config.frontWheelScale,
    wheelWidth,
    wheelStyle,
    isBike,
    tireBumpTex,
    caliperColor,
    isDonk,
  );

  const axleSpread = isBike ? [0] : [-bodyDepth * 0.54, bodyDepth * 0.54];
  const makeAxle = (spinModel: THREE.Group, targetGroup: THREE.Group) => {
    const spinContainer = new THREE.Group();
    axleSpread.forEach((zPos, idx) => {
      const clone = idx === 0 ? spinModel : spinModel.clone();
      clone.position.z = zPos;
      spinContainer.add(clone);
    });
    if (!isBike) {
      const axleShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, bodyDepth * 1.06, 10),
        darkMetalMat,
      );
      axleShaft.rotation.x = Math.PI / 2;
      spinContainer.add(axleShaft);

      const diffPumpkin = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 10),
        darkMetalMat,
      );
      spinContainer.add(diffPumpkin);
    }
    targetGroup.add(spinContainer);
    return spinContainer;
  };

  const rearSpinContainer = makeAxle(wheelRearSpin, wheelRearGroup);
  const frontSpinContainer = makeAxle(wheelFrontSpin, wheelFrontGroup);

  const shockRear = buildCoiloverShock(paint.accent);
  const shockFront = buildCoiloverShock(paint.accent);
  shockRear.position.z = bodyDepth * 0.48;
  shockFront.position.z = bodyDepth * 0.48;
  chassisGroup.add(shockRear, shockFront);

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
    headlightSpot,
    headlightCones,
    brakeLightMat,
    dirtMat,
    nitroGlow,
    backfireGlow,
    neonPoolMesh,
    whipFlag,
    dispose,
  };
}

export function buildCoin3D(value: number, maxAniso: number): THREE.Group {
  const g = new THREE.Group();
  const faceTex = createCoinTexture(value, maxAniso);
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    metalness: 0.88,
    roughness: 0.18,
    emissive: '#78350f',
    emissiveIntensity: 0.28,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    metalness: 0.52,
    roughness: 0.2,
    emissive: '#b45309',
    emissiveIntensity: 0.24,
  });

  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.14, 24),
    [rimMat, faceMat, faceMat],
  );
  cyl.rotation.x = Math.PI / 2;
  cyl.castShadow = true;
  g.add(cyl);
  return g;
}

export function buildFuelCan3D(): THREE.Group {
  const g = new THREE.Group();
  const redMat = new THREE.MeshPhysicalMaterial({
    color: '#dc2626',
    roughness: 0.28,
    metalness: 0.15,
    clearcoat: 0.7,
    emissive: '#7f1d1d',
    emissiveIntensity: 0.25,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.32,
    metalness: 0.15,
  });
  const badgeMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.35,
  });

  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.96, 0.42), redMat);
  tank.castShadow = true;
  g.add(tank);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.14), redMat);
  handle.position.set(-0.08, 0.54, 0);
  g.add(handle);

  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.3, 10), capMat);
  spout.position.set(0.28, 0.54, 0);
  spout.rotation.z = -0.5;
  g.add(spout);

  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.45), badgeMat);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.45), badgeMat);
  bar1.position.y = -0.05;
  bar2.position.y = -0.05;
  g.add(bar1, bar2);

  return g;
}
