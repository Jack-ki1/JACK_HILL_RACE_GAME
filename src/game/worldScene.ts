import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  DEFAULT_TUNING,
  PAINT_SWATCHES,
  STAGES,
  START_X,
  VEHICLES,
  WHEEL_STYLES,
} from './constants';
import {
  buildCoin3D,
  buildFuelCan3D,
  buildGhostVehicle3D,
  buildVehicle3D,
  GhostRig3D,
  VehicleRig3D,
} from './models';
import { HillClimbPhysics, ParticleBurst } from './physics';
import {
  getBridgeInfo,
  getCollectibleForSlot,
  getSummitX,
  getSurfaceAt,
  getTunnelInfo,
  hash01,
  sampleBaseGroundHeight,
  sampleDriveHeight,
} from './terrain';
import {
  createEarthTexture,
  createRoadTrackTexture,
  createSignpostTexture,
  createSoftGlowTexture,
  createSurfaceBumpTexture,
  createTerrainStrataTexture,
  createWoodPlankTexture,
} from './textures';
import { captureHumanClimbSample, computeHybridNnControl, extractNnFeatures } from './aiAgent';
import { forwardPass } from '../shared/nnCore';
import {
  CameraMode,
  CameraShakeMode,
  ClimbSetupConfig,
  ClimbTireId,
  GhostSample,
  GraphicsQuality,
  InputState,
  LandingGrade,
  LiveryId,
  NeonColorId,
  NnEvolutionBonuses,
  NnLiveTelemetry,
  NnTrainingSample,
  NnWeightsBlob,
  RivalMode,
  SaveData,
  StageConfig,
  StageId,
  SurfaceType,
  TimeOfDay,
  TuningPartId,
  UpgradeLevels,
  VehicleAccessoryId,
  VehicleConfig,
  WeatherCondition,
} from '../types/game';
import { DEFAULT_CLIMB_SETUP } from './constants';

export type WorldMode = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

interface ActiveParticle {
  active: boolean;
  kind: ParticleBurst['kind'];
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  maxLife: number;
}

const TERRAIN_SEGMENTS = 160;
const TERRAIN_STEP_X = 0.85;
const RIDGE_SEGMENTS = 96;
const MAX_PARTICLES = 360;
const MAX_SKIDMARKS = 84;
const COIN_POOL_SIZE = 32;
const FUEL_POOL_SIZE = 6;
const PROP_POOL_SIZE = 38;
const FG_POOL_SIZE = 16;
const SIGN_POOL_SIZE = 4;
const BRIDGE_POOL_SIZE = 2;

const _mat4 = new THREE.Matrix4();
const _vec3 = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

export function detectSoftwareWebGL(): boolean {
  try {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function interpolateGhostSample(
  track: GhostSample[],
  elapsedSec: number,
): GhostSample | null {
  if (track.length === 0) return null;
  if (elapsedSec <= track[0].t) return track[0];
  const last = track[track.length - 1];
  if (elapsedSec >= last.t) return last;

  let lo = 0;
  let hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].t <= elapsedSec) lo = mid;
    else hi = mid;
  }
  const a = track[lo];
  const b = track[hi];
  const span = Math.max(0.0001, b.t - a.t);
  const alpha = Math.max(0, Math.min(1, (elapsedSec - a.t) / span));
  const da = Math.atan2(Math.sin(b.a - a.a), Math.cos(b.a - a.a));
  return {
    t: elapsedSec,
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    a: a.a + da * alpha,
  };
}

export class WorldSceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private maxAniso: number;
  private frameId = 0;
  private disposed = false;
  private lastTime = 0;
  private simAccum = 0;
  private elapsed = 0;

  // Lighting & Atmosphere
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private skyMesh: THREE.Mesh;
  private skyUniforms: {
    topColor: { value: THREE.Color };
    bottomColor: { value: THREE.Color };
    sunGlowColor: { value: THREE.Color };
    cloudDark: { value: THREE.Color };
    cloudLit: { value: THREE.Color };
    sunDir: { value: THREE.Vector2 };
    overcastMix: { value: number };
    time: { value: number };
  };
  private sunDisc: THREE.Mesh;
  private earthDisc: THREE.Mesh;
  private earthTex: THREE.CanvasTexture;
  private glowTex: THREE.CanvasTexture;
  private auroraGroup: THREE.Group;
  private auroraBands: THREE.Mesh[] = [];
  private starPoints: THREE.Points;
  private cloudGroup: THREE.Group;
  private balloonGroup: THREE.Group;

  // Terrain, River Gorge & Parallax Ridges
  private roadGeo: THREE.BufferGeometry;
  private roadMat: THREE.MeshStandardMaterial;
  private roadMesh: THREE.Mesh;
  private cliffGeo: THREE.BufferGeometry;
  private cliffMat: THREE.MeshStandardMaterial;
  private cliffMesh: THREE.Mesh;
  private lipGeo: THREE.BufferGeometry;
  private lipMat: THREE.MeshStandardMaterial;
  private lipMesh: THREE.Mesh;
  private gorgeWaterMesh: THREE.Mesh;
  private roadTex: THREE.CanvasTexture | null = null;
  private strataTex: THREE.CanvasTexture | null = null;
  private terrainBumpTex: THREE.CanvasTexture;
  private woodTex: THREE.CanvasTexture;

  private farRidgeGeo: THREE.BufferGeometry;
  private farRidgeMat: THREE.MeshBasicMaterial;
  private midRidgeGeo: THREE.BufferGeometry;
  private midRidgeMat: THREE.MeshBasicMaterial;
  private viceHorizonGroup: THREE.Group;
  private countrysideBackdropGroup: THREE.Group;

  // Bridges, Cave Tunnels, Scenery Props, Foreground Markers, Signposts, Collectibles, Particles, Skidmarks
  private bridgePool: { group: THREE.Group; activeStartX: number }[] = [];
  private tunnelPool: THREE.Group[] = [];
  private propPool: THREE.Group[] = [];
  private propSlots: number[] = [];
  private fgPool: THREE.Group[] = [];
  private fgSlots: number[] = [];
  private signPool: THREE.Group[] = [];
  private signSlots: number[] = [];
  private signTexCache = new Map<string, THREE.CanvasTexture>();
  private finishBannerGroup: THREE.Group;
  private startGateGroup: THREE.Group;
  private summitGateGroup: THREE.Group;
  private stageBestMeters = 0;
  private coinPool: Map<number, THREE.Group[]> = new Map();
  private fuelPool: THREE.Group[] = [];
  private particleMesh: THREE.InstancedMesh;
  private particles: ActiveParticle[] = [];
  private skidMesh: THREE.InstancedMesh;
  private skidCursor = 0;
  private lastSkidX = -99999;
  private ambientSnowMesh: THREE.Points;
  private ambientSnowPos: Float32Array;
  private rainMesh: THREE.Points;
  private rainPos: Float32Array;

  // Vehicle, Ghost Rival, Live AI Rival & Physics
  private vehicleRig: VehicleRig3D | null = null;
  private ghostRig: GhostRig3D | null = null;
  private aiRig: GhostRig3D | null = null;
  private activeGhostTrack: GhostSample[] = [];
  private recordedGhost: GhostSample[] = [];
  private runElapsedSec = 0;
  private ghostSampleAccum = 0;
  private humanSampleAccum = 0;
  private showGhost = true;
  private rivalMode: RivalMode = 'ai';
  private aiAutoPilot = false;
  private watchAiMode = false;
  private cameraMode: CameraMode = 'chase';
  private activeClimbSetup: ClimbSetupConfig = { ...DEFAULT_CLIMB_SETUP };
  private nnWeights: NnWeightsBlob | null = null;
  private nnHillMastery: Record<StageId, number> = {
    countryside: 18,
    red_canyon: 12,
    frost_peaks: 10,
    moon: 8,
    vice_coast: 20,
  };
  private nnEvolutionBonuses: NnEvolutionBonuses | null = null;
  private aiAutoTune = true;
  private latestNnTelemetry: NnLiveTelemetry | null = null;
  private onHumanSampleCallback: ((sample: NnTrainingSample) => void) | null = null;
  private activeEquippedParts: TuningPartId[] = [];
  private activeStage: StageConfig = STAGES[0];
  private activeVehicle: VehicleConfig = VEHICLES[0];
  private activePaintId = 'frontier_red';
  private activeWheelId = 'steel';
  private activeAccessories: VehicleAccessoryId[] = ['lightbar'];
  private activeNeonId: NeonColorId = 'off';
  private activeLiveryId: LiveryId = 'clean';
  private activeUpgrades: UpgradeLevels | undefined = undefined;
  private activeRideHeight = 0;
  private backfireTimer = 0;
  private dirtLevel = 0;
  private lastDirtX = START_X;
  private physics: HillClimbPhysics | null = null;
  private aiPhysics: HillClimbPhysics | null = null;
  private input: InputState = { gas: false, brake: false, nitro: false, handbrake: false, jump: false, lowRange: false };
  private mode: WorldMode = 'TITLE';

  // Perspective Camera framing (Showroom Turntable on TITLE, crisp 2.5D follow on PLAYING)
  private camX = START_X + 62;
  private camY = 3;
  private camZoom = 1.0;
  private dynamicOrthoScale = 1.0;
  private shakeScale = 1.0;
  private heroLookTarget = new THREE.Vector3(START_X + 62, 2, 0);
  private titleRockGroup: THREE.Group;
  private turntableDisc: THREE.Group | null = null;

  // External hooks
  private onTickCallback: ((dt: number, physics: HillClimbPhysics | null) => void) | null = null;
  private onGearShiftCallback: ((gear: number) => void) | null = null;
  private onContextLostCallback: (() => void) | null = null;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    onTick?: (dt: number, physics: HillClimbPhysics | null) => void,
    onContextLost?: () => void,
    onGearShift?: (gear: number) => void,
  ) {
    this.container = container;
    this.onTickCallback = onTick ?? null;
    this.onContextLostCallback = onContextLost ?? null;
    this.onGearShiftCallback = onGearShift ?? null;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAniso = Math.min(16, this.renderer.capabilities.getMaxAnisotropy() || 1);

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLostCallback?.();
    });

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#b7dff6', 0.0044);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.5, 520);
    this.camera.position.set(this.camX + 7.2, this.camY + 0.8, 6.2);
    this.camera.lookAt(this.camX + 2.2, this.camY + 1.0, 0);
    this.updatePerspectiveProjection();

    // 3-Point High-Contrast Outdoor Crawling Lighting Rig
    this.hemiLight = new THREE.HemisphereLight('#a8c7e0', '#3d281a', 0.88);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#ffedd1', 2.75);
    this.sunLight.position.set(-22, 24, 18);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 96;
    const d = 28;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.015;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight('#ffd7a8', 0.92);
    this.rimLight.position.set(16, 12, -18);
    this.scene.add(this.rimLight);

    // Atmospheric Sky Backdrop with FBM Cloud Deck, Golden-Hour Sun Break & Contrails
    this.skyUniforms = {
      topColor: { value: new THREE.Color('#2476cf') },
      bottomColor: { value: new THREE.Color('#bfe6ff') },
      sunGlowColor: { value: new THREE.Color('#ffe8b5') },
      cloudDark: { value: new THREE.Color('#3b3938') },
      cloudLit: { value: new THREE.Color('#f7d5a8') },
      sunDir: { value: new THREE.Vector2(0.18, 0.56) },
      overcastMix: { value: 0.72 },
      time: { value: 0 },
    };
    this.skyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(920, 440),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        depthWrite: false,
        fog: false,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform vec3 sunGlowColor;
          uniform vec3 cloudDark;
          uniform vec3 cloudLit;
          uniform vec2 sunDir;
          uniform float overcastMix;
          uniform float time;
          varying vec2 vUv;

          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }

          float vnoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
          }

          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.52;
            mat2 rot = mat2(0.82, 0.57, -0.57, 0.82);
            for (int i = 0; i < 5; i++) {
              v += a * vnoise(p);
              p = rot * p * 2.05 + vec2(11.3, 5.7);
              a *= 0.48;
            }
            return v;
          }

          void main() {
            float h = clamp(vUv.y, 0.0, 1.0);
            vec3 sky = mix(bottomColor, topColor, pow(h, 0.62));

            // Golden-hour / biome Rayleigh solar break
            vec2 aspectUv = vec2(vUv.x * 1.85, vUv.y);
            vec2 sunPos = vec2(sunDir.x * 1.85, sunDir.y);
            float sunDist = distance(aspectUv, sunPos);
            float wideGlow = exp(-sunDist * 2.6) * 0.52;
            float coreGlow = exp(-sunDist * 14.0) * 0.85;
            sky += sunGlowColor * (wideGlow + coreGlow);

            // Subtle high-altitude contrails across sunlit upper sky
            if (overcastMix > 0.05) {
              float c1 = exp(-abs((vUv.y - 0.82) + (vUv.x - 0.25) * 0.14) * 320.0);
              float c2 = exp(-abs((vUv.y - 0.78) + (vUv.x - 0.22) * 0.13) * 360.0);
              sky += cloudLit * (c1 * 0.12 + c2 * 0.08) * smoothstep(0.5, 0.8, h);

              // Volumetric stratified cloud deck
              vec2 cloudUv = vec2(vUv.x * 4.8 + time * 0.004, (vUv.y - 0.44) * 9.5);
              float cNoise = fbm(cloudUv);
              float cDetail = fbm(cloudUv * 2.4 + vec2(3.1, -1.7));
              float cloudMask = smoothstep(0.38, 0.76, cNoise * 0.78 + cDetail * 0.28);
              float skyHeightFade = smoothstep(0.45, 0.68, h);
              float sunRim = exp(-sunDist * 3.4);
              vec3 cColor = mix(cloudDark, cloudLit, clamp(0.18 + (1.0 - cNoise) * 0.55 + sunRim * 0.72, 0.0, 1.0));
              sky = mix(sky, cColor, cloudMask * skyHeightFade * overcastMix);
            }

            // Crisp horizon atmospheric haze
            float horizonBand = exp(-abs(h - 0.46) * 14.0) * 0.22;
            sky += sunGlowColor * horizonBand;
            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    );
    this.skyMesh.position.set(0, 10, -180);
    this.scene.add(this.skyMesh);

    // Sun / Moon Disc + Halo
    this.glowTex = createSoftGlowTexture();

    this.sunDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({
        map: this.glowTex,
        color: '#fff4c8',
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        fog: false,
      }),
    );
    this.sunDisc.position.set(10, 5.2, -125);
    this.scene.add(this.sunDisc);

    // Earth Disc visible in Moon Crater black sky
    this.earthTex = createEarthTexture(this.maxAniso);
    this.earthDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 5.5),
      new THREE.MeshBasicMaterial({
        map: this.earthTex,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    this.earthDisc.position.set(-7.5, 4.8, -120);
    this.earthDisc.visible = false;
    this.scene.add(this.earthDisc);

    // Twinkling Starfield (scaled for orthographic viewport bounds)
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (hash01(i * 3 + 1) - 0.5) * 72;
      starPositions[i * 3 + 1] = -8 + hash01(i * 3 + 2) * 32;
      starPositions[i * 3 + 2] = -130;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: '#ffffff',
        size: 3.2,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.9,
        fog: false,
      }),
    );
    this.starPoints.visible = false;
    this.scene.add(this.starPoints);

    // Aurora Borealis Ribbons
    this.auroraGroup = new THREE.Group();
    for (let b = 0; b < 2; b++) {
      const aGeo = new THREE.PlaneGeometry(80, 9, 48, 4);
      const aMat = new THREE.MeshBasicMaterial({
        color: b === 0 ? '#34d399' : '#818cf8',
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const band = new THREE.Mesh(aGeo, aMat);
      band.position.set(0, 5.5 + b * 2.4, -110 - b * 6);
      this.auroraBands.push(band);
      this.auroraGroup.add(band);
    }
    this.auroraGroup.visible = false;
    this.scene.add(this.auroraGroup);

    // Layered 3D Clouds (ortho-proportioned)
    this.cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.96,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92,
      fog: false,
    });
    for (let c = 0; c < 12; c++) {
      const cluster = new THREE.Group();
      const puffs = [
        [0, 0, 0, 1.35],
        [1.1, -0.15, 0.1, 1.0],
        [-1.05, -0.2, -0.1, 0.95],
        [0.35, 0.48, 0, 0.9],
        [-0.45, 0.36, 0.1, 0.78],
      ];
      puffs.forEach(([px, py, pz, r]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
        m.scale.set(1.45, 0.68, 0.55);
        m.position.set(px, py, pz);
        cluster.add(m);
      });
      cluster.position.set(-48 + c * 11, 4.2 + (c % 4) * 1.4, -80 - (c % 3) * 10);
      this.cloudGroup.add(cluster);
    }
    this.scene.add(this.cloudGroup);

    // Hot Air Balloons drifting high in Countryside, Red Canyon & Vice skies
    this.balloonGroup = new THREE.Group();
    const balloonColors = ['#ef4444', '#f59e0b', '#0ea5e9'];
    balloonColors.forEach((bCol, idx) => {
      const b = new THREE.Group();
      const env = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 14, 12),
        new THREE.MeshStandardMaterial({ color: bCol, roughness: 0.72 }),
      );
      env.scale.set(1, 1.24, 1);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.94, 0.85, 0.34, 14),
        new THREE.MeshStandardMaterial({ color: '#fef08a', roughness: 0.72 }),
      );
      band.position.y = 0.1;
      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.28, 0.36),
        new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 }),
      );
      basket.position.y = -1.45;
      b.add(env, band, basket);
      b.position.set(-16 + idx * 18, 4.5 + idx * 1.4, -62 - idx * 10);
      this.balloonGroup.add(b);
    });
    this.scene.add(this.balloonGroup);

    // Parallax Mountain Ridges
    this.farRidgeGeo = this.createRidgeGeometry(RIDGE_SEGMENTS);
    this.farRidgeMat = new THREE.MeshBasicMaterial({ color: '#69a67a', fog: false });
    const farRidge = new THREE.Mesh(this.farRidgeGeo, this.farRidgeMat);
    farRidge.position.z = -98;
    this.scene.add(farRidge);

    this.midRidgeGeo = this.createRidgeGeometry(RIDGE_SEGMENTS);
    this.midRidgeMat = new THREE.MeshBasicMaterial({ color: '#4c8e4d', fog: true });
    const midRidge = new THREE.Mesh(this.midRidgeGeo, this.midRidgeMat);
    midRidge.position.z = -48;
    this.scene.add(midRidge);

    // Vice Coastway Ocean Horizon + Art Deco Skyline Silhouette
    this.viceHorizonGroup = this.createViceBackdrop();
    this.viceHorizonGroup.visible = false;
    this.scene.add(this.viceHorizonGroup);

    // Countryside Distant Wind Turbines
    this.countrysideBackdropGroup = this.createCountrysideBackdrop();
    this.countrysideBackdropGroup.visible = false;
    this.scene.add(this.countrysideBackdropGroup);

    // PBR Terrain Road, Overhanging Turf/Asphalt Lip & Cliff Strata
    this.terrainBumpTex = createSurfaceBumpTexture(this.maxAniso, 1.32);
    this.woodTex = createWoodPlankTexture(this.maxAniso);

    this.roadGeo = this.createRibbonGeometry(TERRAIN_SEGMENTS);
    this.roadMat = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0.04,
      bumpMap: this.terrainBumpTex,
      bumpScale: 0.24,
      vertexColors: true,
    });
    this.roadMesh = new THREE.Mesh(this.roadGeo, this.roadMat);
    this.roadMesh.receiveShadow = true;
    this.roadMesh.frustumCulled = false;
    this.scene.add(this.roadMesh);

    this.cliffGeo = this.createRibbonGeometry(TERRAIN_SEGMENTS);
    this.cliffMat = new THREE.MeshStandardMaterial({
      roughness: 0.94,
      metalness: 0.03,
      bumpMap: this.terrainBumpTex,
      bumpScale: 0.36,
      vertexColors: true,
    });
    this.cliffMesh = new THREE.Mesh(this.cliffGeo, this.cliffMat);
    this.cliffMesh.receiveShadow = true;
    this.cliffMesh.frustumCulled = false;
    this.scene.add(this.cliffMesh);

    this.lipGeo = this.createRibbonGeometry(TERRAIN_SEGMENTS);
    this.lipMat = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      metalness: 0.02,
      vertexColors: true,
    });
    this.lipMesh = new THREE.Mesh(this.lipGeo, this.lipMat);
    this.lipMesh.receiveShadow = true;
    this.lipMesh.frustumCulled = false;
    this.scene.add(this.lipMesh);

    // 3D Personal Best Finish Banner + CLIMB START & SUMMIT FINISH Gates
    this.finishBannerGroup = this.createFinishBanner('BEST RECORD', '#fbbf24');
    this.finishBannerGroup.visible = false;
    this.scene.add(this.finishBannerGroup);

    this.startGateGroup = this.createFinishBanner('CLIMB START', '#34d399');
    this.startGateGroup.visible = false;
    this.scene.add(this.startGateGroup);

    this.summitGateGroup = this.createSummitGate();
    this.summitGateGroup.visible = false;
    this.scene.add(this.summitGateGroup);

    // Showroom Level Circular Turntable Group
    this.titleRockGroup = new THREE.Group();
    this.scene.add(this.titleRockGroup);

    // Gorge River Water Plane far below bridges
    this.gorgeWaterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 26),
      new THREE.MeshStandardMaterial({
        color: '#1e6b8f',
        roughness: 0.14,
        metalness: 0.72,
      }),
    );
    this.gorgeWaterMesh.rotation.x = -Math.PI / 2;
    this.gorgeWaterMesh.position.set(START_X, -14, -4);
    this.scene.add(this.gorgeWaterMesh);

    // Bridge Pool
    for (let i = 0; i < BRIDGE_POOL_SIZE; i++) {
      const grp = this.createBridgeMesh();
      grp.visible = false;
      this.scene.add(grp);
      this.bridgePool.push({ group: grp, activeStartX: -99999 });
    }

    // Cave Tunnel Pool (rock cavern archways + timber props + warm lanterns)
    for (let i = 0; i < 2; i++) {
      const tGrp = this.createTunnelMesh();
      tGrp.visible = false;
      this.scene.add(tGrp);
      this.tunnelPool.push(tGrp);
    }

    // Midground Scenery Pool
    for (let i = 0; i < PROP_POOL_SIZE; i++) {
      const g = new THREE.Group();
      g.visible = false;
      this.scene.add(g);
      this.propPool.push(g);
      this.propSlots.push(-99999);
    }

    // Foreground Speed-Sense Parallax Pool (z = +5.6..+8.2)
    for (let i = 0; i < FG_POOL_SIZE; i++) {
      const g = new THREE.Group();
      g.visible = false;
      this.scene.add(g);
      this.fgPool.push(g);
      this.fgSlots.push(-99999);
    }

    // Trail Milestone Signposts (100m, 200m, 300m...)
    for (let i = 0; i < SIGN_POOL_SIZE; i++) {
      const g = new THREE.Group();
      g.visible = false;
      this.scene.add(g);
      this.signPool.push(g);
      this.signSlots.push(-99999);
    }

    // Collectible Coin & Fuel Pools
    [5, 25, 100, 500].forEach((val) => {
      const arr: THREE.Group[] = [];
      for (let i = 0; i < Math.ceil(COIN_POOL_SIZE / 4) + 4; i++) {
        const c = buildCoin3D(val, this.maxAniso);
        c.visible = false;
        this.scene.add(c);
        arr.push(c);
      }
      this.coinPool.set(val, arr);
    });

    for (let i = 0; i < FUEL_POOL_SIZE; i++) {
      const f = buildFuelCan3D();
      f.visible = false;
      this.scene.add(f);
      this.fuelPool.push(f);
    }

    // Pooled InstancedMesh Particles
    const pGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        kind: 'dirt',
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0.1,
        life: 0,
        maxLife: 1,
      });
      _mat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, _color.set('#ffffff'));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // Pooled Tire Skidmarks / Tread Tracks Decal InstancedMesh
    const skidGeo = new THREE.PlaneGeometry(0.9, 1.85);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: '#111827',
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, MAX_SKIDMARKS);
    this.skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skidMesh.frustumCulled = false;
    _mat4.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_SKIDMARKS; i++) {
      this.skidMesh.setMatrixAt(i, _mat4);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.skidMesh);

    // Ambient Snow / Desert Dust / Lunar Floating Motes
    const snowCount = 180;
    this.ambientSnowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      this.ambientSnowPos[i * 3] = (Math.random() - 0.5) * 60;
      this.ambientSnowPos[i * 3 + 1] = Math.random() * 26 - 4;
      this.ambientSnowPos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.ambientSnowPos, 3));
    this.ambientSnowMesh = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({
        color: '#ffffff',
        size: 0.24,
        transparent: true,
        opacity: 0.78,
      }),
    );
    this.ambientSnowMesh.visible = false;
    this.scene.add(this.ambientSnowMesh);

    // Wet / Storm Weather Rain Particles
    const rainCount = 260;
    this.rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      this.rainPos[i * 3] = (Math.random() - 0.5) * 62;
      this.rainPos[i * 3 + 1] = Math.random() * 28 - 4;
      this.rainPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainMesh = new THREE.Points(
      rainGeo,
      new THREE.PointsMaterial({
        color: '#bae6fd',
        size: 0.16,
        transparent: true,
        opacity: 0.72,
      }),
    );
    this.rainMesh.visible = false;
    this.scene.add(this.rainMesh);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.applyStageEnvironment(STAGES[0]);
    this.rebuildVehicleModel(VEHICLES[0], 'frontier_red', 'steel', false);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTime = performance.now();
    this.scheduleNextFrame();
  }

  private createRibbonGeometry(segments: number): THREE.BufferGeometry {
    const vertCount = (segments + 1) * 2;
    const pos = new Float32Array(vertCount * 3);
    const uv = new Float32Array(vertCount * 2);
    const col = new Float32Array(vertCount * 3);
    const indices: number[] = [];

    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(indices);
    return geo;
  }

  private createRidgeGeometry(segments: number): THREE.BufferGeometry {
    const vertCount = (segments + 1) * 2;
    const pos = new Float32Array(vertCount * 3);
    const indices: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(indices);
    return geo;
  }

  private createViceBackdrop(): THREE.Group {
    const g = new THREE.Group();
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 28),
      new THREE.MeshStandardMaterial({
        color: '#0369a1',
        roughness: 0.16,
        metalness: 0.72,
      }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -1.8, -58);
    g.add(ocean);

    const beach = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 12),
      new THREE.MeshStandardMaterial({ color: '#f3d19c', roughness: 0.92 }),
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(0, -1.65, -42);
    g.add(beach);

    const decoColors = ['#2e1065', '#4c1d95', '#831843', '#1e1b4b', '#312e81'];
    const neonColors = ['#ff2a85', '#00f5ff', '#facc15', '#fb7185'];
    for (let i = 0; i < 14; i++) {
      const bx = -72 + i * 11 + (i % 2) * 2.2;
      const bw = 4.5 + (i % 3) * 1.6;
      const bh = 9 + (i % 4) * 3.8;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 3.2),
        new THREE.MeshStandardMaterial({
          color: decoColors[i % decoColors.length],
          roughness: 0.55,
          metalness: 0.25,
        }),
      );
      bldg.position.set(bx, bh * 0.5 - 2.2, -72 - (i % 3) * 6);
      g.add(bldg);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(bw + 0.18, 0.28, 3.3),
        new THREE.MeshBasicMaterial({ color: neonColors[i % neonColors.length] }),
      );
      trim.position.set(bx, bh - 2.25, -72 - (i % 3) * 6);
      g.add(trim);
    }
    return g;
  }

  private createCountrysideBackdrop(): THREE.Group {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.45, metalness: 0.2 });
    [-32, -8, 22, 46].forEach((tx, idx) => {
      const tower = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 9.5, 8), steel);
      mast.position.y = 4.75;
      const hub = new THREE.Group();
      hub.position.set(0, 9.4, 0.24);
      hub.name = `turbineHub_${idx}`;
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.06), steel);
        blade.position.y = 1.7;
        const pivot = new THREE.Group();
        pivot.rotation.z = (b / 3) * Math.PI * 2;
        pivot.add(blade);
        hub.add(pivot);
      }
      tower.add(mast, hub);
      tower.position.set(tx, -1.5 + (idx % 2) * 1.4, -54);
      g.add(tower);
    });
    return g;
  }

  private createFinishBanner(label = 'BEST RECORD', accentColor = '#fbbf24'): THREE.Group {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.7, roughness: 0.3 });
    [-2.5, 2.5].forEach((pz) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5.2, 8), poleMat);
      pole.position.set(0, 2.6, pz);
      pole.castShadow = true;
      g.add(pole);
    });
    const cacheKey = `__GATE_${label}__`;
    let bannerTex = this.signTexCache.get(cacheKey);
    if (!bannerTex) {
      bannerTex = createSignpostTexture(label, this.maxAniso);
      this.signTexCache.set(cacheKey, bannerTex);
    }
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 1.05, 5.4),
      new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.38 }),
    );
    banner.position.set(0, 4.65, 0);
    g.add(banner);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.12, 5.45),
      new THREE.MeshBasicMaterial({ color: accentColor }),
    );
    trim.position.set(0, 5.22, 0);
    g.add(trim);
    return g;
  }

  private createSummitGate(): THREE.Group {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.78, roughness: 0.25 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#d97706',
      emissiveIntensity: 0.35,
      metalness: 0.7,
      roughness: 0.3,
    });
    [-2.7, 2.7].forEach((pz) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6.2, 10), poleMat);
      pole.position.set(0, 3.1, pz);
      pole.castShadow = true;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.45, 10), goldMat);
      base.position.set(0, 0.22, pz);
      g.add(pole, base);
    });

    // Checkered + SUMMIT FINISH arch
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 128;
    const ctx = cv.getContext('2d');
    if (ctx) {
      const sq = 16;
      for (let y = 0; y < 32; y += sq) {
        for (let x = 0; x < 512; x += sq) {
          ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#0f172a' : '#f8fafc';
          ctx.fillRect(x, y, sq, sq);
        }
      }
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 32, 512, 64);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SUMMIT FINISH', 256, 65);
      for (let y = 96; y < 128; y += sq) {
        for (let x = 0; x < 512; x += sq) {
          ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#f8fafc' : '#0f172a';
          ctx.fillRect(x, y, sq, sq);
        }
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = this.maxAniso;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.signTexCache.set('__SUMMIT_FINISH__', tex);

    const arch = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1.45, 5.8),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32 }),
    );
    arch.position.set(0, 5.4, 0);
    g.add(arch);

    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 5.9), goldMat);
    crown.position.set(0, 6.2, 0);
    g.add(crown);
    return g;
  }

  private createBridgeMesh(): THREE.Group {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.woodTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: '#4e2e16',
      roughness: 0.9,
      metalness: 0.05,
    });
    const cableMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.35,
      metalness: 0.85,
    });

    const span = 38;
    const numPlanks = 32;
    const plankW = span / numPlanks;
    for (let i = 0; i < numPlanks; i++) {
      const s = (i + 0.5) / numPlanks;
      const sag = -0.75 * Math.sin(Math.PI * s);
      const px = (i + 0.5) * plankW;
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(plankW * 0.92, 0.24, 5.4),
        woodMat,
      );
      plank.position.set(px, sag - 0.12, 0);
      plank.castShadow = true;
      plank.receiveShadow = true;
      g.add(plank);
    }

    for (let i = 0; i <= 8; i++) {
      const s = i / 8;
      const px = s * span;
      const sag = -0.75 * Math.sin(Math.PI * s);
      if (i > 0 && i < 8) {
        [-2.2, 2.2].forEach((pz) => {
          const piling = new THREE.Mesh(
            new THREE.BoxGeometry(0.34, 21, 0.34),
            darkWoodMat,
          );
          piling.position.set(px, sag - 10.6, pz);
          g.add(piling);
        });
      }
      [-2.5, 2.5].forEach((pz) => {
        const isFront = pz > 0;
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, isFront ? 0.55 : 1.15, 0.18),
          darkWoodMat,
        );
        post.position.set(px, sag + (isFront ? 0.24 : 0.55), pz);
        g.add(post);
      });
    }

    [-2.5, 2.5].forEach((pz) => {
      const isFront = pz > 0;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 0.12, 0.12), woodMat);
      rail.position.set(span * 0.5, isFront ? 0.36 : 0.88, pz);
      g.add(rail);

      const cable = new THREE.Mesh(new THREE.BoxGeometry(span, 0.05, 0.05), cableMat);
      cable.position.set(span * 0.5, isFront ? 0.16 : 0.35, pz);
      g.add(cable);
    });

    for (let i = 0; i < 7; i++) {
      const px = (i + 0.5) * (span / 7);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 0.22), darkWoodMat);
      brace.position.set(px, -3.2, 2.1);
      brace.rotation.z = i % 2 === 0 ? 0.52 : -0.52;
      g.add(brace);
    }

    return g;
  }

  private createTunnelMesh(): THREE.Group {
    const g = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#3f3b3a',
      roughness: 0.95,
      metalness: 0.04,
      bumpMap: this.terrainBumpTex,
      bumpScale: 0.28,
    });
    const timberMat = new THREE.MeshStandardMaterial({
      color: '#5c3a21',
      roughness: 0.9,
      metalness: 0.05,
    });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#f59e0b',
      emissiveIntensity: 2.8,
    });

    const span = 28;
    // Heavy stone arch ceiling slab + chamfered rock brow overhang
    const roof = new THREE.Mesh(new THREE.BoxGeometry(span, 3.2, 11.6), rockMat);
    roof.position.set(span * 0.5, 1.6, -1.4);
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);

    // Back rock cavern wall behind the drive track
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(span, 7.2, 1.2), rockMat);
    backWall.position.set(span * 0.5, -2.2, -6.8);
    g.add(backWall);

    // Timber portal arches & hanging amber tunnel lanterns
    for (let i = 0; i <= 4; i++) {
      const px = (i / 4) * span;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 9.6), timberMat);
      beam.position.set(px, -0.1, -1.4);
      g.add(beam);

      [-5.6, 2.8].forEach((pz) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 6.8, 0.42), timberMat);
        post.position.set(px, -3.4, pz);
        g.add(post);
      });

      if (i > 0 && i < 4) {
        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), lanternMat);
        lantern.position.set(px, -0.45, -1.4);
        g.add(lantern);
      }
    }

    return g;
  }

  public applyStageEnvironment(
    stage: StageConfig,
    weather: WeatherCondition = this.activeClimbSetup.weather,
    timeOfDay: TimeOfDay = this.activeClimbSetup.timeOfDay,
  ): void {
    this.activeStage = stage;
    this.activeClimbSetup = { ...this.activeClimbSetup, weather, timeOfDay };

    const isNight = timeOfDay === 'night';
    const isDawn = timeOfDay === 'dawn';
    const isDusk = timeOfDay === 'dusk';
    const isStorm = weather === 'storm';
    const isWet = weather === 'wet';

    const topCol = new THREE.Color(stage.skyTop);
    const horCol = new THREE.Color(stage.skyHorizon);
    const fogCol = new THREE.Color(stage.fogColor);
    const sunCol = new THREE.Color(stage.sunColor);

    if (stage.id !== 'moon') {
      if (isDawn) {
        topCol.lerp(new THREE.Color('#273b69'), 0.48);
        horCol.lerp(new THREE.Color('#fdba74'), 0.62);
        fogCol.lerp(new THREE.Color('#f5b98e'), 0.55);
        sunCol.set('#ffcf91');
      } else if (isDusk) {
        topCol.lerp(new THREE.Color('#1d1942'), 0.65);
        horCol.lerp(new THREE.Color('#fb7185'), 0.58);
        fogCol.lerp(new THREE.Color('#6b3b6e'), 0.52);
        sunCol.set('#ff9e7d');
      } else if (isNight) {
        topCol.lerp(new THREE.Color('#040814'), 0.85);
        horCol.lerp(new THREE.Color('#0f1d38'), 0.82);
        fogCol.lerp(new THREE.Color('#0b1529'), 0.82);
        sunCol.set('#93c5fd');
      }
      if (isStorm) {
        topCol.lerp(new THREE.Color('#1e293b'), 0.6);
        horCol.lerp(new THREE.Color('#475569'), 0.55);
        fogCol.lerp(new THREE.Color('#334155'), 0.6);
      } else if (isWet) {
        topCol.lerp(new THREE.Color('#475569'), 0.35);
        horCol.lerp(new THREE.Color('#94a3b8'), 0.3);
      }
    }

    this.skyUniforms.topColor.value.copy(topCol);
    this.skyUniforms.bottomColor.value.copy(horCol);
    this.skyUniforms.sunGlowColor.value.set(
      isNight
        ? '#38bdf8'
        : isDawn || isDusk
          ? '#fb923c'
          : stage.id === 'frost_peaks'
            ? '#60a5fa'
            : stage.id === 'vice_coast'
              ? '#ff7d6b'
              : stage.id === 'moon'
                ? '#475569'
                : '#ffdc9e',
    );
    this.skyUniforms.cloudDark.value.set(
      isStorm
        ? '#1e293b'
        : isNight
          ? '#0f172a'
          : stage.id === 'frost_peaks'
            ? '#14243e'
            : stage.id === 'vice_coast'
              ? '#3b1c4a'
              : stage.id === 'red_canyon'
                ? '#332b29'
                : '#3d4754',
    );
    this.skyUniforms.cloudLit.value.set(
      isStorm
        ? '#64748b'
        : isNight
          ? '#334155'
          : isDusk
            ? '#fda4af'
            : isDawn
              ? '#fed7aa'
              : stage.id === 'frost_peaks'
                ? '#7dd3fc'
                : stage.id === 'vice_coast'
                  ? '#fda4af'
                  : '#f8e0b8',
    );
    this.skyUniforms.overcastMix.value =
      stage.id === 'moon'
        ? 0.0
        : isStorm
          ? 0.96
          : isWet
            ? 0.88
            : stage.id === 'frost_peaks'
              ? 0.42
              : 0.78;
    const weatherFogMult = isStorm ? 1.45 : isWet ? 1.18 : 0.85;
    this.scene.fog = new THREE.FogExp2(fogCol.getHex(), stage.fogDensity * weatherFogMult);

    const sunMult = isNight ? 0.42 : isDusk ? 0.72 : isDawn ? 0.85 : isStorm ? 0.62 : isWet ? 0.82 : 1.0;
    this.sunLight.color.copy(sunCol);
    this.sunLight.intensity = stage.sunIntensity * sunMult;
    this.hemiLight.color.set(isNight ? '#3b5280' : stage.hemiSky);
    this.hemiLight.groundColor.set(stage.hemiGround);
    this.hemiLight.intensity = stage.hemiIntensity * (isNight ? 0.62 : isStorm ? 0.78 : 1.0);

    const sunMat = this.sunDisc.material as THREE.MeshBasicMaterial;
    sunMat.color.set(
      isNight || stage.id === 'moon'
        ? '#e2e8f0'
        : isDawn || isDusk
          ? '#fb923c'
          : stage.id === 'frost_peaks'
            ? '#a5d8ff'
            : stage.id === 'vice_coast'
              ? '#ff9e7d'
              : '#fff3c4',
    );
    sunMat.opacity = isStorm
      ? 0.25
      : stage.id === 'frost_peaks'
        ? 0.52
        : stage.id === 'vice_coast'
          ? 0.92
          : 0.86;
    this.earthDisc.visible = stage.id === 'moon';

    this.starPoints.visible = stage.hasStars || isNight || isDusk;
    this.auroraGroup.visible = stage.hasAurora || (isNight && stage.id !== 'moon');
    this.cloudGroup.visible = false;
    this.balloonGroup.visible =
      !isStorm && !isNight && (stage.id === 'countryside' || stage.id === 'vice_coast');
    this.ambientSnowMesh.visible = stage.hasSnowfall || stage.hasDustHaze;
    (this.ambientSnowMesh.material as THREE.PointsMaterial).color.set(
      stage.hasSnowfall ? '#ffffff' : '#e6a875',
    );
    this.rainMesh.visible = (isWet || isStorm) && stage.id !== 'moon' && !stage.hasSnowfall;
    (this.rainMesh.material as THREE.PointsMaterial).opacity = isStorm ? 0.88 : 0.58;

    this.gorgeWaterMesh.visible = stage.hasBridges;
    (this.gorgeWaterMesh.material as THREE.MeshStandardMaterial).color.set(
      stage.id === 'vice_coast'
        ? '#0891b2'
        : stage.id === 'red_canyon'
          ? '#2c6c7a'
          : '#2580ad',
    );

    this.farRidgeMat.color.set(stage.farRidgeColor);
    this.midRidgeMat.color.set(stage.midRidgeColor);
    this.viceHorizonGroup.visible = stage.id === 'vice_coast';
    this.countrysideBackdropGroup.visible = stage.id === 'countryside';

    this.roadTex?.dispose();
    this.strataTex?.dispose();
    this.roadTex = createRoadTrackTexture(
      stage.topSurfaceColor,
      stage.topSurfaceEdgeColor,
      stage.dirtUpperColor,
      this.maxAniso,
    );
    this.strataTex = createTerrainStrataTexture(
      stage.topSurfaceColor,
      stage.dirtUpperColor,
      stage.dirtLowerColor,
      this.maxAniso,
    );
    this.roadMat.map = this.roadTex;
    this.roadMat.roughness = isWet || isStorm ? 0.52 : 0.88;
    this.roadMat.needsUpdate = true;
    this.cliffMat.map = this.strataTex;
    this.cliffMat.needsUpdate = true;

    this.populateTitleRocks();

    this.propSlots.fill(-99999);
    this.fgSlots.fill(-99999);
    this.signSlots.fill(-99999);
    this.bridgePool.forEach((b) => {
      b.activeStartX = -99999;
      b.group.visible = false;
    });
    this.tunnelPool.forEach((t) => (t.visible = false));

    const lightsActive = stage.headlightsOn || isNight || isDusk || isStorm;
    if (this.vehicleRig) {
      if (this.vehicleRig.headlightSpot) {
        this.vehicleRig.headlightSpot.intensity = lightsActive ? 24 : 2.5;
      }
      this.vehicleRig.headlightCones.forEach((c) => {
        c.visible = lightsActive;
      });
    }
  }

  public triggerBackfire(): void {
    this.backfireTimer = 0.14;
  }

  public rebuildVehicleModel(
    vehicle: VehicleConfig,
    paintId: string,
    wheelId: string,
    headlightsOn: boolean,
    accessories: VehicleAccessoryId[] = ['lightbar'],
    neonColorId: NeonColorId = 'off',
    liveryId: LiveryId = 'clean',
    upgrades?: UpgradeLevels,
    rideHeight = 0,
  ): void {
    this.activeVehicle = vehicle;
    this.activePaintId = paintId;
    this.activeWheelId = wheelId;
    this.activeAccessories = accessories;
    this.activeNeonId = neonColorId;
    this.activeLiveryId = liveryId;
    this.activeUpgrades = upgrades;
    this.activeRideHeight = rideHeight;
    if (this.vehicleRig) {
      this.scene.remove(this.vehicleRig.root);
      this.vehicleRig.dispose();
    }
    const paint = PAINT_SWATCHES.find((p) => p.id === paintId) ?? PAINT_SWATCHES[0];
    const wheelStyle = WHEEL_STYLES.find((w) => w.id === wheelId) ?? WHEEL_STYLES[0];
    this.vehicleRig = buildVehicle3D(
      vehicle,
      paint,
      wheelStyle,
      true,
      accessories,
      neonColorId,
      liveryId,
      this.maxAniso,
      upgrades,
    );
    this.vehicleRig.dirtMat.opacity = this.mode === 'PLAYING' ? this.dirtLevel * 0.9 : 0;
    if (this.vehicleRig.headlightSpot) {
      this.vehicleRig.headlightSpot.intensity = headlightsOn ? 24 : 2.5;
    }
    this.vehicleRig.headlightCones.forEach((c) => {
      c.visible = headlightsOn;
    });
    this.scene.add(this.vehicleRig.root);
  }

  public setMode(mode: WorldMode): void {
    this.mode = mode;
    if (this.ghostRig && mode !== 'PLAYING') {
      this.ghostRig.root.visible = false;
    }
    if (this.aiRig && mode !== 'PLAYING') {
      this.aiRig.root.visible = false;
    }
    if (this.vehicleRig && mode !== 'TITLE') {
      this.vehicleRig.root.rotation.y = 0;
    }
    this.titleRockGroup.visible = mode === 'TITLE';
    this.updatePerspectiveProjection();
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  public setNnConfig(
    weights: NnWeightsBlob | null,
    hillMastery: Record<StageId, number>,
    evolutionBonuses: NnEvolutionBonuses | null,
    aiAutoTune: boolean,
  ): void {
    this.nnWeights = weights;
    this.nnHillMastery = { ...hillMastery };
    this.nnEvolutionBonuses = evolutionBonuses;
    this.aiAutoTune = aiAutoTune;
  }

  public getLatestNnTelemetry(): NnLiveTelemetry | null {
    return this.latestNnTelemetry;
  }

  public getAiPhysics(): HillClimbPhysics | null {
    return this.aiPhysics;
  }

  public getRunElapsedSec(): number {
    return this.runElapsedSec;
  }

  public setInput(input: Partial<InputState>): void {
    Object.assign(this.input, input);
  }

  public applyGraphicsQuality(tier: GraphicsQuality): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
      return;
    }
    const maxDpr = window.devicePixelRatio || 1;
    if (tier === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
    } else if (tier === 'medium') {
      this.renderer.setPixelRatio(Math.min(maxDpr, 1.35));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
    } else {
      this.renderer.setPixelRatio(Math.min(maxDpr, tier === 'high' ? 2 : 1.75));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
    }
    this.handleResize();
  }

  public setCameraShakeMode(mode: CameraShakeMode): void {
    this.shakeScale = mode === 'off' ? 0 : mode === 'subtle' ? 0.38 : 1.0;
  }

  public setShowGhost(show: boolean): void {
    this.showGhost = show;
    if (this.ghostRig && !show) {
      this.ghostRig.root.visible = false;
    }
  }

  public setRivalMode(mode: RivalMode): void {
    this.rivalMode = mode;
    if (this.ghostRig && mode !== 'ghost') {
      this.ghostRig.root.visible = false;
    }
    if (this.aiRig && mode !== 'ai') {
      this.aiRig.root.visible = false;
    }
  }

  public setAiAutoPilot(enabled: boolean): void {
    this.aiAutoPilot = enabled;
  }

  public isAiAutoPilot(): boolean {
    return this.aiAutoPilot;
  }

  public startRun(
    save: SaveData,
    stage: StageConfig,
    vehicle: VehicleConfig,
    consumeBoosters: boolean,
    callbacks: {
      onCoin: (value: number, x: number, y: number) => void;
      onFuel: (x: number, y: number) => void;
      onStunt: (title: string, bonusCoins: number, flipsAdded: number) => void;
      onLanding: (intensity: number, surface: SurfaceType, grade?: LandingGrade | null) => void;
      onGearShift?: (gear: number) => void;
      onTurboSurge?: () => void;
      onJumpShock?: () => void;
      onRollcageBreak?: () => void;
      onScrape?: (intensity: number) => void;
      onSummitCrossed?: () => void;
      onHumanSample?: (sample: NnTrainingSample) => void;
      onCrash: (reason: string) => void;
    },
    runOptions?: {
      climbSetup?: ClimbSetupConfig;
      climbTireId?: ClimbTireId;
      watchAiMode?: boolean;
      aiAutoTune?: boolean;
      nnWeights?: NnWeightsBlob | null;
      hillMastery?: Record<StageId, number>;
      evolutionBonuses?: NnEvolutionBonuses | null;
    },
  ): HillClimbPhysics {
    const setup = runOptions?.climbSetup ?? save.climbSetup ?? DEFAULT_CLIMB_SETUP;
    this.activeClimbSetup = { ...setup };
    this.watchAiMode = Boolean(runOptions?.watchAiMode);
    this.aiAutoTune = runOptions?.aiAutoTune ?? save.aiAutoTune ?? true;
    if (runOptions?.nnWeights !== undefined) this.nnWeights = runOptions.nnWeights;
    if (runOptions?.hillMastery) this.nnHillMastery = { ...runOptions.hillMastery };
    if (runOptions?.evolutionBonuses !== undefined) {
      this.nnEvolutionBonuses = runOptions.evolutionBonuses;
    }
    this.onHumanSampleCallback = callbacks.onHumanSample ?? null;
    this.humanSampleAccum = 0;
    this.latestNnTelemetry = null;

    this.applyStageEnvironment(stage, setup.weather, setup.timeOfDay);
    this.stageBestMeters = Math.floor(save.stageBests[stage.id] ?? 0);
    const paintId = save.vehiclePaints[vehicle.id] || vehicle.defaultPaintId;
    const wheelId = save.vehicleWheels[vehicle.id] || 'steel';
    const climbTireId =
      runOptions?.climbTireId ?? save.vehicleClimbTires?.[vehicle.id] ?? 'all_terrain';
    const acc = save.vehicleAccessories?.[vehicle.id] ?? ['lightbar'];
    const neonId = save.vehicleNeons?.[vehicle.id] ?? 'off';
    const liveryId = save.vehicleLiveries?.[vehicle.id] ?? 'clean';
    const upgrades = save.upgrades?.[vehicle.id];
    const rideHeight = save.tuning?.rideHeight ?? 0;
    const accKey = acc.join(',');
    const prevAccKey = this.activeAccessories.join(',');
    const upgKey = upgrades ? `${upgrades.engine}_${upgrades.suspension}_${upgrades.tires}_${upgrades.awd}_${upgrades.fuel}` : '';
    const prevUpgKey = this.activeUpgrades
      ? `${this.activeUpgrades.engine}_${this.activeUpgrades.suspension}_${this.activeUpgrades.tires}_${this.activeUpgrades.awd}_${this.activeUpgrades.fuel}`
      : '';
    const lightsActive =
      stage.headlightsOn ||
      setup.timeOfDay === 'night' ||
      setup.timeOfDay === 'dusk' ||
      setup.weather === 'storm';

    if (
      this.activeVehicle.id !== vehicle.id ||
      this.activePaintId !== paintId ||
      this.activeWheelId !== wheelId ||
      accKey !== prevAccKey ||
      this.activeNeonId !== neonId ||
      this.activeLiveryId !== liveryId ||
      upgKey !== prevUpgKey ||
      this.activeRideHeight !== rideHeight
    ) {
      this.rebuildVehicleModel(
        vehicle,
        paintId,
        wheelId,
        lightsActive,
        acc,
        neonId,
        liveryId,
        upgrades,
        rideHeight,
      );
    } else if (this.vehicleRig) {
      if (this.vehicleRig.headlightSpot) {
        this.vehicleRig.headlightSpot.intensity = lightsActive ? 24 : 2.5;
      }
      this.vehicleRig.headlightCones.forEach((c) => (c.visible = lightsActive));
    }

    if (this.vehicleRig) {
      this.vehicleRig.root.rotation.y = 0;
    }

    // Reset dynamic mud & skidmark decals cleanly at start of every run
    this.dirtLevel = 0;
    this.lastDirtX = START_X;
    this.lastSkidX = -99999;
    _mat4.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_SKIDMARKS; i++) {
      this.skidMesh.setMatrixAt(i, _mat4);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
    if (this.vehicleRig) {
      this.vehicleRig.dirtMat.opacity = 0;
    }

    this.camZoom = save.tuning.cameraZoom || DEFAULT_TUNING.cameraZoom;
    this.dynamicOrthoScale = 1.0;
    this.setCameraShakeMode(save.settings?.cameraShake ?? 'full');
    this.setShowGhost(setup.climbMode === 'ghost' || (save.settings?.showGhost ?? true));
    this.rivalMode =
      this.watchAiMode || setup.climbMode === 'time_attack'
        ? 'off'
        : setup.climbMode === 'head_to_head'
          ? 'ai'
          : 'ghost';
    this.activeEquippedParts = save.vehicleTuningParts?.[vehicle.id] ?? [];
    this.simAccum = 0;
    this.particles.forEach((p) => (p.active = false));

    // Ghost Rival playback + recording setup
    if (this.ghostRig) {
      this.scene.remove(this.ghostRig.root);
      this.ghostRig.dispose();
      this.ghostRig = null;
    }
    if (this.aiRig) {
      this.scene.remove(this.aiRig.root);
      this.aiRig.dispose();
      this.aiRig = null;
    }
    this.activeGhostTrack = save.stageGhosts?.[stage.id] ?? [];
    this.recordedGhost = [];
    this.runElapsedSec = 0;
    this.ghostSampleAccum = 0;
    if (this.activeGhostTrack.length >= 2) {
      this.ghostRig = buildGhostVehicle3D(vehicle, '#fbbf24', 0.28);
      this.ghostRig.root.visible = false;
      this.scene.add(this.ghostRig.root);
    }

    const activeBonuses = this.aiAutoTune ? this.nnEvolutionBonuses : null;

    // Live Autonomous Neural Network AI Racer
    this.aiRig = buildGhostVehicle3D(vehicle, '#22d3ee', 0.54);
    this.aiRig.root.visible = false;
    this.scene.add(this.aiRig.root);
    const noop = () => {};
    this.aiPhysics = new HillClimbPhysics(
      stage,
      vehicle,
      save,
      {
        onCoin: noop,
        onFuel: noop,
        onStunt: noop,
        onLanding: noop,
        onCrash: noop,
        onParticle: noop,
      },
      false,
      {
        weather: setup.weather,
        climbTireId,
        aiBonuses: this.nnEvolutionBonuses,
        difficulty: setup.difficulty,
        isAiRacer: true,
      },
    );

    this.physics = new HillClimbPhysics(
      stage,
      vehicle,
      save,
      {
        onCoin: (v, x, y) => {
          for (let i = 0; i < 10; i++) {
            this.spawnParticle({
              kind: 'coin',
              x,
              y,
              z: (Math.random() - 0.5) * 0.5,
              vx: (Math.random() - 0.5) * 5,
              vy: 2 + Math.random() * 5,
              vz: (Math.random() - 0.5) * 3,
              size: 0.16,
              life: 0.48,
            });
          }
          callbacks.onCoin(v, x, y);
        },
        onFuel: (x, y) => {
          for (let i = 0; i < 14; i++) {
            this.spawnParticle({
              kind: 'fuel',
              x,
              y,
              z: (Math.random() - 0.5) * 0.6,
              vx: (Math.random() - 0.5) * 6,
              vy: 2 + Math.random() * 6,
              vz: (Math.random() - 0.5) * 3,
              size: 0.2,
              life: 0.55,
            });
          }
          callbacks.onFuel(x, y);
        },
        onStunt: callbacks.onStunt,
        onLanding: (intensity, surface, grade) => {
          this.dirtLevel = Math.min(1, this.dirtLevel + Math.min(0.32, intensity * 0.18));
          callbacks.onLanding(intensity, surface, grade);
        },
        onGearShift: (gear) => {
          this.triggerBackfire();
          const cb = callbacks.onGearShift ?? this.onGearShiftCallback;
          cb?.(gear);
        },
        onTurboSurge: callbacks.onTurboSurge,
        onJumpShock: callbacks.onJumpShock,
        onRollcageBreak: callbacks.onRollcageBreak,
        onScrape: callbacks.onScrape,
        onSummitCrossed: callbacks.onSummitCrossed,
        onCrash: callbacks.onCrash,
        onParticle: (p) => this.spawnParticle(p),
      },
      consumeBoosters,
      {
        weather: setup.weather,
        climbTireId,
        aiBonuses: activeBonuses,
        difficulty: setup.difficulty,
        isAiRacer: false,
      },
    );

    const s0 = this.physics.state;
    this.recordedGhost.push({ t: 0, x: s0.x, y: s0.y, a: s0.angle });
    this.camX = s0.x + 3.2;
    this.camY = s0.y + 1.2;
    this.mode = 'PLAYING';
    this.titleRockGroup.visible = false;
    this.updatePerspectiveProjection();
    return this.physics;
  }

  public getRecordedGhost(): GhostSample[] {
    return this.recordedGhost;
  }

  public getGhostDeltaMeters(): number | null {
    return this.getRivalDelta().delta;
  }

  public getRivalDelta(): { delta: number | null; label: 'AI' | 'RIVAL' } {
    if (this.mode !== 'PLAYING' || !this.physics || this.watchAiMode) {
      return { delta: null, label: 'AI' };
    }
    if (this.rivalMode === 'ai' && this.aiPhysics) {
      return {
        delta: Math.round(this.physics.state.x - this.aiPhysics.state.x),
        label: 'AI',
      };
    }
    if (
      this.rivalMode === 'ghost' &&
      this.showGhost &&
      this.activeGhostTrack.length >= 2
    ) {
      const ghostSample = interpolateGhostSample(this.activeGhostTrack, this.runElapsedSec);
      if (!ghostSample) return { delta: null, label: 'RIVAL' };
      return {
        delta: Math.round(this.physics.state.x - ghostSample.x),
        label: 'RIVAL',
      };
    }
    return { delta: null, label: 'AI' };
  }

  public getAiMarginMeters(): number | null {
    if (this.rivalMode !== 'ai' || !this.physics || !this.aiPhysics || this.watchAiMode) return null;
    return Math.round(this.physics.state.x - this.aiPhysics.state.x);
  }

  public getPhysics(): HillClimbPhysics | null {
    return this.physics;
  }

  public spawnParticle(p: ParticleBurst): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const slot = this.particles[i];
      if (!slot.active) {
        slot.active = true;
        slot.kind = p.kind;
        slot.x = p.x;
        slot.y = p.y;
        slot.z = p.z;
        slot.vx = p.vx;
        slot.vy = p.vy;
        slot.vz = p.vz;
        slot.size = p.size;
        slot.life = p.life;
        slot.maxLife = p.life;
        return;
      }
    }
  }

  private updatePerspectiveProjection(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const aspect = w / h;
    const baseFov = this.mode === 'TITLE' ? 36 : 38;
    const aspectBoost = aspect < 1.05 ? (1.05 - aspect) * 18 : 0;
    this.camera.fov = THREE.MathUtils.clamp(baseFov + aspectBoost, 34, 52);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.updatePerspectiveProjection();
    this.renderer.setSize(w, h);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt || 0.016));
    this.elapsed += dt;

    if (this.mode === 'PLAYING' && this.physics) {
      this.simAccum += dt;
      const fixedStep = 1 / 180;
      let substeps = 0;
      const hillMasteryPct = this.nnHillMastery[this.activeStage.id] ?? 15;
      const diffScale =
        this.activeClimbSetup.difficulty === 'rookie'
          ? 0.78
          : this.activeClimbSetup.difficulty === 'extreme'
            ? 1.07
            : 0.94;

      while (this.simAccum >= fixedStep && substeps < 12) {
        let playerStepInput = this.input;
        if (this.aiAutoPilot || this.watchAiMode) {
          const res = computeHybridNnControl(
            this.physics.state,
            this.activeVehicle,
            this.activeStage,
            this.nnWeights,
            hillMasteryPct,
            this.activeEquippedParts,
            1.0,
          );
          playerStepInput = res.input;
          this.latestNnTelemetry = res.telemetry;
        }
        this.physics.step(fixedStep, playerStepInput);

        if (
          this.aiPhysics &&
          this.rivalMode === 'ai' &&
          !this.watchAiMode &&
          !this.aiPhysics.state.crashed
        ) {
          const aiRes = computeHybridNnControl(
            this.aiPhysics.state,
            this.activeVehicle,
            this.activeStage,
            this.nnWeights,
            hillMasteryPct,
            this.activeEquippedParts,
            diffScale,
          );
          this.aiPhysics.step(fixedStep, aiRes.input);
        }

        this.simAccum -= fixedStep;
        substeps++;
      }

      if (!this.aiAutoPilot && !this.watchAiMode && this.nnWeights) {
        const feat = extractNnFeatures(this.physics.state, this.activeVehicle, this.activeStage);
        const pass = forwardPass(this.nnWeights, feat);
        this.latestNnTelemetry = {
          ...pass.telemetry,
          nnAuthority: 0,
          modeLabel: 'SHADOW OBSERVING HUMAN',
        };
      }

      if (!this.physics.state.crashed && !this.physics.state.summitCrossed) {
        this.runElapsedSec += dt;
        this.ghostSampleAccum += dt;
        if (this.ghostSampleAccum >= 0.12 && this.recordedGhost.length < 2500) {
          this.ghostSampleAccum = 0;
          const st = this.physics.state;
          this.recordedGhost.push({
            t: Number(this.runElapsedSec.toFixed(3)),
            x: Number(st.x.toFixed(3)),
            y: Number(st.y.toFixed(3)),
            a: Number(st.angle.toFixed(4)),
          });
        }

        // Stream human driving samples every ~0.16s when driving unassisted
        if (!this.aiAutoPilot && !this.watchAiMode && this.onHumanSampleCallback) {
          this.humanSampleAccum += dt;
          if (this.humanSampleAccum >= 0.16) {
            this.humanSampleAccum = 0;
            const sample = captureHumanClimbSample(
              this.physics.state,
              this.input,
              this.activeVehicle,
              this.activeStage,
            );
            if (sample) {
              this.onHumanSampleCallback(sample);
            }
          }
        }
      }
    }

    this.updateVehicleAndCamera(dt);
    this.updateTerrainMeshes();
    this.updateBridgesAndProps();
    this.updateCollectibles();
    this.updateParticles(dt);
    this.updateAtmosphere(dt);

    this.onTickCallback?.(dt, this.physics);

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  private updateVehicleAndCamera(dt: number): void {
    const rig = this.vehicleRig;
    if (!rig) return;

    if (this.mode === 'TITLE') {
      this.dirtLevel = 0;
      rig.dirtMat.opacity = 0;
      this.titleRockGroup.visible = true;

      const v = this.activeVehicle;
      const heroX = START_X + 62;
      const groundAtHero = sampleDriveHeight(heroX, this.activeStage);
      const platformTopY = groundAtHero + 0.55;

      // Vehicle sits completely flat and level on the circular turntable disc
      const climbAngle = 0;
      const susp = (v.suspensionRest + this.activeRideHeight) * 0.62;
      const idleBreath = Math.sin(this.elapsed * 0.9) * 0.008;
      const wheelR = v.wheelRadius * (1 + Math.min(0.085, ((this.activeUpgrades?.tires ?? 1) - 1) * 0.009));

      const turntableYaw = this.elapsed * 0.28;
      if (this.turntableDisc) {
        this.turntableDisc.rotation.y = turntableYaw;
      }

      rig.root.position.set(heroX, platformTopY + wheelR + susp + 0.02, 0);
      rig.root.rotation.y = turntableYaw;
      rig.chassisGroup.position.set(0, idleBreath, 0);
      rig.chassisGroup.rotation.z = climbAngle;

      const wb = v.wheelbase;
      const wrX = -wb * 0.5;
      const wrY = -susp;
      const wfX = wb * 0.5;
      const wfY = -susp;
      rig.wheelRearGroup.position.set(wrX, wrY, 0);
      rig.wheelFrontGroup.position.set(wfX, wfY, 0);
      rig.nitroGlow.visible = false;
      rig.backfireGlow.visible = false;
      rig.brakeLightMat.emissiveIntensity = 0.85;
      rig.driverTorso.rotation.z = 0;
      rig.driverHead.rotation.z = 0;
      if (rig.headlightSpot) {
        rig.headlightSpot.intensity = 22;
      }
      rig.headlightCones.forEach((c) => {
        c.visible = true;
      });
      if (rig.whipMastGroup) {
        rig.whipMastGroup.rotation.z = 0.06 + Math.sin(this.elapsed * 2.0) * 0.03;
      }
      if (rig.whipFlag) {
        rig.whipFlag.rotation.y = Math.sin(this.elapsed * 3.0) * 0.14;
      }
      if (rig.activeWing) {
        rig.activeWing.rotation.z = 0.06;
      }
      if (rig.riderLeanGroup) {
        rig.riderLeanGroup.rotation.z = 0;
      }
      // Ground per-tire and chassis AO shadows flat onto circular turntable surface
      rig.tireShadowRear.visible = true;
      rig.tireShadowRear.position.set(wrX, wrY - wheelR + 0.025, 0);
      rig.tireShadowRear.rotation.z = 0;
      (rig.tireShadowRear.material as THREE.MeshBasicMaterial).opacity = 0.72;
      rig.tireShadowFront.visible = true;
      rig.tireShadowFront.position.set(wfX, wfY - wheelR + 0.025, 0);
      rig.tireShadowFront.rotation.z = 0;
      (rig.tireShadowFront.material as THREE.MeshBasicMaterial).opacity = 0.72;
      rig.chassisAoShadow.visible = true;
      rig.chassisAoShadow.position.set(0, -susp - wheelR + 0.03, 0);
      rig.chassisAoShadow.rotation.z = 0;
      (rig.chassisAoShadow.material as THREE.MeshBasicMaterial).opacity = 0.56;

      if (rig.neonPoolMesh) {
        rig.neonPoolMesh.visible = this.activeNeonId !== 'off';
        rig.neonPoolMesh.position.set(0, -susp - wheelR + 0.035, 0);
      }
      if (rig.neonLight) {
        rig.neonLight.intensity = this.activeNeonId !== 'off' ? 3.8 : 0;
      }
      if (this.ghostRig) {
        this.ghostRig.root.visible = false;
      }
      if (this.aiRig) {
        this.aiRig.root.visible = false;
      }

      this.updateShocksAndArms(rig, susp - idleBreath, susp - idleBreath);

      const w = Math.max(1, this.container.clientWidth);
      const h = Math.max(1, this.container.clientHeight);
      const aspect = w / h;
      const distScale = aspect < 1 ? 1.38 : 1.04;

      const targetCamX = heroX + 4.3 * distScale;
      const targetCamY = platformTopY + 1.9 * distScale;
      const targetCamZ = 6.4 * distScale;

      this.camX = THREE.MathUtils.damp(this.camX, targetCamX, 5, dt);
      this.camY = THREE.MathUtils.damp(this.camY, targetCamY, 5, dt);
      this.camera.position.set(this.camX, this.camY, targetCamZ);
      this.heroLookTarget.set(heroX, platformTopY + 0.85, 0);
      this.camera.lookAt(this.heroLookTarget);

      this.sunLight.position.set(heroX - 20, platformTopY + 18, 14);
      this.sunLight.target.position.set(heroX, platformTopY + 0.6, 0);
      return;
    }

    this.titleRockGroup.visible = false;
    if (!this.physics) return;
    const s = this.physics.state;
    const v = this.activeVehicle;

    rig.root.position.set(0, 0, 0);
    rig.root.rotation.y = 0;
    rig.chassisGroup.position.set(s.x, s.y, 0);
    rig.chassisGroup.rotation.z = s.angle;
    rig.driverTorso.rotation.z = s.torsoAngle;
    rig.driverHead.rotation.z = s.headAngle;
    rig.brakeLightMat.emissiveIntensity = s.braking ? 3.5 : 0.7;

    if (rig.riderLeanGroup) {
      rig.riderLeanGroup.rotation.z = THREE.MathUtils.clamp(
        -s.throttle * 0.24 - s.angle * 0.12,
        -0.32,
        0.2,
      );
    }
    if (rig.activeWing) {
      const targetWingRot = s.activeAeroActive ? 0.44 : 0.06;
      rig.activeWing.rotation.z = THREE.MathUtils.damp(rig.activeWing.rotation.z, targetWingRot, 12, dt);
    }

    // Auto-boost headlights & lightbeams inside dark cave tunnels
    const lightsHigh = this.activeStage.headlightsOn || s.inTunnel;
    if (rig.headlightSpot) {
      rig.headlightSpot.intensity = lightsHigh ? 24 : 2.5;
    }
    rig.headlightCones.forEach((c) => {
      c.visible = lightsHigh;
    });

    if (rig.whipMastGroup) {
      rig.whipMastGroup.rotation.z = s.whipAngle;
    }
    if (rig.whipFlag) {
      const windSpeed = 8 + Math.min(24, Math.hypot(s.vx, s.vy));
      rig.whipFlag.rotation.y = Math.sin(this.elapsed * windSpeed) * 0.34;
    }

    rig.nitroGlow.visible = s.nitroActive || s.overchargedActive;
    if (rig.nitroGlow.visible) {
      const flicker = 0.85 + Math.random() * 0.45;
      rig.nitroGlow.scale.set(flicker, 0.9 + Math.random() * 0.25, 0.9 + Math.random() * 0.25);
    }

    const forwardSpeed = Math.hypot(s.vx, s.vy);
    if (this.backfireTimer <= 0 && s.throttle < -0.1 && forwardSpeed > 18 && Math.random() < 0.08) {
      this.backfireTimer = 0.09;
    }
    this.backfireTimer = Math.max(0, this.backfireTimer - dt);
    rig.backfireGlow.visible = this.backfireTimer > 0 && !s.nitroActive && !s.overchargedActive;
    if (rig.backfireGlow.visible) {
      const bf = 0.85 + Math.random() * 0.5;
      rig.backfireGlow.scale.set(bf, 0.85 + Math.random() * 0.3, 0.85 + Math.random() * 0.3);
    }

    const rearPos = this.physics.getWheelWorldPosition(false);
    const frontPos = this.physics.getWheelWorldPosition(true);
    rig.wheelRearGroup.position.set(rearPos.x, rearPos.y, 0);
    rig.wheelFrontGroup.position.set(frontPos.x, frontPos.y, 0);
    rig.wheelRearSpin.rotation.z = -s.rotR;
    rig.wheelFrontSpin.rotation.z = -s.rotF;

    this.updateShocksAndArms(
      rig,
      s.effectiveSuspensionRest - s.compR,
      s.effectiveSuspensionRest - s.compF,
    );

    // Stamp subtle tire skidmarks onto the track on heavy braking, burnout, or mud/dirt wheelspin
    if (
      this.mode === 'PLAYING' &&
      !s.crashed &&
      (s.groundedR || s.groundedF) &&
      (s.braking || s.burnoutCharge > 0.15 || (Math.abs(s.throttle) > 0.6 && s.surface !== 'asphalt' && Math.abs(s.spinR * v.wheelRadius - s.vx) > 3.5))
    ) {
      const wheelRefX = s.groundedR ? rearPos.x : frontPos.x;
      if (Math.abs(wheelRefX - this.lastSkidX) >= 0.72) {
        this.lastSkidX = wheelRefX;
        const gY = sampleDriveHeight(wheelRefX, this.activeStage);
        const gY2 = sampleDriveHeight(wheelRefX + 0.4, this.activeStage);
        const slope = Math.atan2(gY2 - gY, 0.4);
        _vec3.set(wheelRefX, gY + 0.035, 0);
        _quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP.set(0, 0, 1), slope);
        THREE.Object3D.DEFAULT_UP.set(0, 1, 0);
        _scale.set(1, 1, 1);
        _mat4.compose(_vec3, _quat, _scale);
        this.skidMesh.setMatrixAt(this.skidCursor, _mat4);
        this.skidMesh.instanceMatrix.needsUpdate = true;
        this.skidCursor = (this.skidCursor + 1) % MAX_SKIDMARKS;
      }
    }

    // Dynamic off-road dirt/mud overlay accumulation from distance traveled + wheelspin + mud bogs
    if (this.mode === 'PLAYING' && !s.crashed) {
      const dx = Math.max(0, s.x - this.lastDirtX);
      this.lastDirtX = s.x;
      const mudMult = s.surface === 'mud' ? 3.2 : 1.0;
      const spinBoost =
        (s.groundedR || s.groundedF) && Math.abs(s.throttle) > 0.3 ? dt * 0.01 * mudMult : 0;
      this.dirtLevel = Math.min(1, this.dirtLevel + dx * 0.0024 * mudMult + spinBoost);
    }
    const biomeDirtColor =
      this.activeStage.id === 'red_canyon'
        ? '#9a3b20'
        : this.activeStage.id === 'frost_peaks'
          ? '#d6e4f0'
          : this.activeStage.id === 'moon'
            ? '#52586b'
            : this.activeStage.id === 'vice_coast'
              ? '#4b3f36'
              : '#5c3a1e';
    rig.dirtMat.color.set(biomeDirtColor);
    rig.dirtMat.opacity = this.dirtLevel * 0.9;

    // Ghost Rival Playback ONLY during PLAYING mode when rivalMode === 'ghost'
    if (this.ghostRig) {
      if (
        this.mode === 'PLAYING' &&
        this.rivalMode === 'ghost' &&
        this.showGhost &&
        this.activeGhostTrack.length >= 2
      ) {
        const gs = interpolateGhostSample(this.activeGhostTrack, this.runElapsedSec);
        if (gs) {
          this.ghostRig.root.visible = true;
          this.ghostRig.root.position.set(gs.x, gs.y, -1.35);
          this.ghostRig.root.rotation.z = gs.a;
        } else {
          this.ghostRig.root.visible = false;
        }
      } else {
        this.ghostRig.root.visible = false;
      }
    }

    // Live Autonomous AI Racer Rig during PLAYING mode when rivalMode === 'ai'
    if (this.aiRig) {
      if (this.mode === 'PLAYING' && this.rivalMode === 'ai' && this.aiPhysics) {
        const as = this.aiPhysics.state;
        this.aiRig.root.visible = true;
        this.aiRig.root.position.set(as.x, as.y, -1.75);
        this.aiRig.root.rotation.z = as.angle;
        this.aiRig.wheelRear.rotation.z = -as.rotR;
        this.aiRig.wheelFront.rotation.z = -as.rotF;
      } else {
        this.aiRig.root.visible = false;
      }
    }

    // Dynamic 2.5D Perspective Chase Camera with CameraMode (chase / wide / bumper)
    const speed = forwardSpeed;
    const groundY = sampleDriveHeight(s.x, this.activeStage);
    const wheelR = v.wheelRadius * s.tireRadiusScale;
    const heightAboveGround = Math.max(0, s.y - groundY - s.effectiveSuspensionRest - wheelR);
    const modeLeadBonus = this.cameraMode === 'wide' ? 1.25 : this.cameraMode === 'bumper' ? 0.65 : 1.0;
    const lookAheadX = THREE.MathUtils.clamp(s.vx * 0.38 * modeLeadBonus, -2.5, 11.2);
    const targetCamX = s.x + (this.cameraMode === 'bumper' ? 1.8 : 2.8) + lookAheadX;
    const targetCamY =
      s.y +
      (this.cameraMode === 'bumper' ? 0.65 : 1.15) +
      Math.min(2.8, speed * 0.042) -
      Math.min(1.4, heightAboveGround * 0.16);

    this.camX = THREE.MathUtils.damp(this.camX, targetCamX, 6.8, dt);
    this.camY = THREE.MathUtils.damp(this.camY, targetCamY, 5.4, dt);

    const targetOrthoScale =
      1.0 +
      (s.nitroActive ? 0.08 : 0) +
      Math.min(0.32, speed * 0.008) +
      Math.min(0.34, heightAboveGround * 0.062);
    this.dynamicOrthoScale = THREE.MathUtils.damp(
      this.dynamicOrthoScale,
      targetOrthoScale,
      4.5,
      dt,
    );

    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const aspect = w / h;
    const modeBaseZ =
      this.cameraMode === 'wide'
        ? aspect < 1
          ? 38.0
          : 32.5
        : this.cameraMode === 'bumper'
          ? aspect < 1
            ? 20.5
            : 16.5
          : aspect < 1
            ? 30.5
            : 25.5;
    const camZ = (modeBaseZ * this.dynamicOrthoScale) / this.camZoom;

    const shakeX = (Math.random() - 0.5) * s.shakeIntensity * 0.75 * this.shakeScale;
    const shakeY = (Math.random() - 0.5) * s.shakeIntensity * 0.75 * this.shakeScale;

    this.camera.position.set(
      this.camX + shakeX,
      this.camY + (this.cameraMode === 'bumper' ? 0.95 : 1.65) + shakeY,
      camZ,
    );
    this.camera.lookAt(
      this.camX + (this.cameraMode === 'bumper' ? 2.1 : 1.4) + shakeX,
      this.camY - 0.15 + shakeY,
      0,
    );

    // Anchor soft per-tire contact shadows & chassis AO directly onto terrain below wheels
    const gR = sampleDriveHeight(rearPos.x, this.activeStage);
    const gF = sampleDriveHeight(frontPos.x, this.activeStage);
    const hR = Math.max(0, rearPos.y - wheelR - gR);
    const hF = Math.max(0, frontPos.y - wheelR - gF);
    const slopeAnglePlay = Math.atan2(gF - gR, Math.max(0.5, frontPos.x - rearPos.x));

    const alphaR = Math.max(0, 0.72 - hR * 0.28);
    rig.tireShadowRear.visible = alphaR > 0.03;
    rig.tireShadowRear.position.set(rearPos.x, gR + 0.035, 0);
    rig.tireShadowRear.rotation.z = slopeAnglePlay;
    rig.tireShadowRear.scale.setScalar(1 + Math.min(0.5, hR * 0.18));
    (rig.tireShadowRear.material as THREE.MeshBasicMaterial).opacity = alphaR;

    const alphaF = Math.max(0, 0.72 - hF * 0.28);
    rig.tireShadowFront.visible = alphaF > 0.03;
    rig.tireShadowFront.position.set(frontPos.x, gF + 0.035, 0);
    rig.tireShadowFront.rotation.z = slopeAnglePlay;
    rig.tireShadowFront.scale.setScalar(1 + Math.min(0.5, hF * 0.18));
    (rig.tireShadowFront.material as THREE.MeshBasicMaterial).opacity = alphaF;

    const alphaAo = Math.max(0, 0.52 - heightAboveGround * 0.18);
    rig.chassisAoShadow.visible = alphaAo > 0.03;
    rig.chassisAoShadow.position.set(s.x, groundY + 0.04, 0);
    rig.chassisAoShadow.rotation.z = slopeAnglePlay;
    rig.chassisAoShadow.scale.setScalar(1 + Math.min(0.4, heightAboveGround * 0.12));
    (rig.chassisAoShadow.material as THREE.MeshBasicMaterial).opacity = alphaAo;

    if (rig.neonPoolMesh) {
      const neonAlpha = this.activeNeonId !== 'off' ? Math.max(0, 0.36 - heightAboveGround * 0.14) : 0;
      rig.neonPoolMesh.visible = neonAlpha > 0.02;
      rig.neonPoolMesh.position.set(s.x, groundY + 0.045, 0);
      rig.neonPoolMesh.rotation.z = slopeAnglePlay;
      (rig.neonPoolMesh.material as THREE.MeshBasicMaterial).opacity = neonAlpha;
    }
    if (rig.neonLight) {
      rig.neonLight.intensity = this.activeNeonId !== 'off' ? Math.max(0, 4.2 - heightAboveGround * 1.4) : 0;
    }

    this.sunLight.position.set(s.x + 14, s.y + 26, 16);
    this.sunLight.target.position.set(s.x + 2, s.y, 0);
  }

  private updateShocksAndArms(rig: VehicleRig3D, lenR: number, lenF: number): void {
    const wb = this.activeVehicle.wheelbase;
    rig.shockRear.group.position.set(-wb * 0.5, -lenR * 0.5, rig.shockRear.group.position.z);
    rig.shockRear.setCompression(Math.max(0.22, lenR + 0.14));
    rig.shockFront.group.position.set(wb * 0.5, -lenF * 0.5, rig.shockFront.group.position.z);
    rig.shockFront.setCompression(Math.max(0.22, lenF + 0.14));

    // Pivot control arms smoothly toward wheel centers
    const armSpan = Math.max(0.4, wb * 0.44);
    rig.armRear.rotation.z = Math.atan2(lenR - 0.1, armSpan);
    rig.armFront.rotation.z = -Math.atan2(lenF - 0.1, armSpan);
  }

  private updateTerrainMeshes(): void {
    const startX = Math.floor((this.camX - 56) / TERRAIN_STEP_X) * TERRAIN_STEP_X;
    const roadPos = this.roadGeo.attributes.position as THREE.BufferAttribute;
    const roadUv = this.roadGeo.attributes.uv as THREE.BufferAttribute;
    const roadCol = this.roadGeo.attributes.color as THREE.BufferAttribute;

    const cliffPos = this.cliffGeo.attributes.position as THREE.BufferAttribute;
    const cliffUv = this.cliffGeo.attributes.uv as THREE.BufferAttribute;
    const cliffCol = this.cliffGeo.attributes.color as THREE.BufferAttribute;

    const lipPos = this.lipGeo.attributes.position as THREE.BufferAttribute;
    const lipUv = this.lipGeo.attributes.uv as THREE.BufferAttribute;
    const lipCol = this.lipGeo.attributes.color as THREE.BufferAttribute;
    _color.set(this.activeStage.topSurfaceColor);
    const lipR = _color.r * 0.92;
    const lipG = _color.g * 0.92;
    const lipB = _color.b * 0.92;

    for (let i = 0; i <= TERRAIN_SEGMENTS; i++) {
      const x = startX + i * TERRAIN_STEP_X;
      const gy = sampleBaseGroundHeight(x, this.activeStage);
      const surf = getSurfaceAt(x, this.activeStage);

      const v0 = i * 2;
      const v1 = v0 + 1;
      roadPos.setXYZ(v0, x, gy, -12.5);
      roadPos.setXYZ(v1, x, gy, 4.8);
      roadUv.setXY(v0, x * 0.14, 0);
      roadUv.setXY(v1, x * 0.14, 1);

      const strataVar = 0.92 + Math.sin(x * 0.7) * 0.06;
      if (surf.surface === 'ice') {
        roadCol.setXYZ(v0, 0.52, 0.86, 1.0);
        roadCol.setXYZ(v1, 0.58, 0.9, 1.0);
      } else if (surf.surface === 'mud') {
        roadCol.setXYZ(v0, 0.44 * strataVar, 0.28 * strataVar, 0.16 * strataVar);
        roadCol.setXYZ(v1, 0.4 * strataVar, 0.24 * strataVar, 0.14 * strataVar);
      } else if (surf.surface === 'sand') {
        roadCol.setXYZ(v0, 1.0 * strataVar, 0.85 * strataVar, 0.56 * strataVar);
        roadCol.setXYZ(v1, 0.95 * strataVar, 0.8 * strataVar, 0.52 * strataVar);
      } else {
        roadCol.setXYZ(v0, strataVar, strataVar, strataVar);
        roadCol.setXYZ(v1, 0.95 * strataVar, 0.94 * strataVar, 0.93 * strataVar);
      }

      cliffPos.setXYZ(v0, x, gy, 4.8);
      cliffPos.setXYZ(v1, x, gy - 44, 4.8);
      cliffUv.setXY(v0, x * 0.09, 0);
      cliffUv.setXY(v1, x * 0.09, 1);
      cliffCol.setXYZ(v0, strataVar, strataVar, strataVar);
      cliffCol.setXYZ(v1, 0.54, 0.54, 0.54);

      const lipWave = 0.24 + Math.sin(x * 1.4) * 0.06 + Math.cos(x * 3.1) * 0.04;
      lipPos.setXYZ(v0, x, gy + 0.03, 4.84);
      lipPos.setXYZ(v1, x, gy - lipWave, 4.84);
      lipUv.setXY(v0, x * 0.25, 0);
      lipUv.setXY(v1, x * 0.25, 1);
      if (surf.surface === 'mud') {
        lipCol.setXYZ(v0, 0.36, 0.22, 0.12);
        lipCol.setXYZ(v1, 0.24, 0.14, 0.08);
      } else if (surf.surface === 'sand') {
        lipCol.setXYZ(v0, 0.92, 0.78, 0.5);
        lipCol.setXYZ(v1, 0.72, 0.58, 0.36);
      } else {
        lipCol.setXYZ(v0, lipR, lipG, lipB);
        lipCol.setXYZ(v1, lipR * 0.62, lipG * 0.62, lipB * 0.62);
      }
    }

    roadPos.needsUpdate = true;
    roadUv.needsUpdate = true;
    roadCol.needsUpdate = true;
    this.roadGeo.computeVertexNormals();

    cliffPos.needsUpdate = true;
    cliffUv.needsUpdate = true;
    cliffCol.needsUpdate = true;
    this.cliffGeo.computeVertexNormals();

    lipPos.needsUpdate = true;
    lipUv.needsUpdate = true;
    lipCol.needsUpdate = true;
    this.lipGeo.computeVertexNormals();

    if (this.gorgeWaterMesh.visible) {
      this.gorgeWaterMesh.position.x = this.camX;
      this.gorgeWaterMesh.position.y =
        sampleBaseGroundHeight(this.camX, this.activeStage) - 9.5;
    }

    if (this.viceHorizonGroup.visible) {
      this.viceHorizonGroup.position.set(this.camX * 0.78, this.camY * 0.35 - 2.2, 0);
    }
    if (this.countrysideBackdropGroup.visible) {
      this.countrysideBackdropGroup.position.set(this.camX * 0.72, this.camY * 0.38 - 1.5, 0);
      this.countrysideBackdropGroup.children.forEach((tower, idx) => {
        const hub = tower.getObjectByName(`turbineHub_${idx}`);
        if (hub) hub.rotation.z = this.elapsed * (0.85 + idx * 0.12);
      });
    }

    const updateRidge = (geo: THREE.BufferGeometry, parallax: number, baseY: number, scaleY: number, freq: number) => {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const step = 7.4;
      const ridgeStart = this.camX - (RIDGE_SEGMENTS * step) * 0.5;
      for (let i = 0; i <= RIDGE_SEGMENTS; i++) {
        const x = ridgeStart + i * step;
        const wx = x - this.camX * (1 - parallax);
        const h =
          baseY +
          Math.sin(wx * freq) * scaleY +
          Math.sin(wx * freq * 2.3 + 1.1) * (scaleY * 0.45) +
          Math.abs(Math.cos(wx * freq * 0.6)) * (scaleY * 0.55);
        pos.setXYZ(i * 2, x, this.camY * 0.55 + h, 0);
        pos.setXYZ(i * 2 + 1, x, this.camY * 0.55 - 70, 0);
      }
      pos.needsUpdate = true;
    };

    updateRidge(this.farRidgeGeo, 0.16, 4.5, 4.8 * this.activeStage.ampMult, 0.055);
    updateRidge(this.midRidgeGeo, 0.35, 1.2, 3.2 * this.activeStage.ampMult, 0.085);
  }

  private createCraggyRockMesh(
    radius: number,
    colorHex: string,
    seed = 1,
    flatScale = 0.68,
  ): THREE.Mesh {
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const strata = 0.8 + 0.34 * hash01(Math.round((vx * 13 + vy * 29 + vz * 19 + seed * 7) * 10));
      const shelfCut = vy < 0 ? 0.65 : 1.0;
      pos.setXYZ(i, vx * strata, vy * strata * flatScale * shelfCut, vz * strata);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
      bumpMap: this.terrainBumpTex,
      bumpScale: 0.32,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createScrubGrassTuft(colorHex: string, seed = 1): THREE.Group {
    const tuft = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.92,
      side: THREE.DoubleSide,
    });
    for (let b = 0; b < 9; b++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.45 + hash01(seed + b) * 0.35, 3), bladeMat);
      const ang = (b / 9) * Math.PI * 2 + hash01(seed * 3 + b) * 0.4;
      const tilt = 0.25 + hash01(seed * 5 + b) * 0.42;
      blade.position.set(Math.cos(ang) * 0.08, 0.2, Math.sin(ang) * 0.08);
      blade.rotation.z = -Math.cos(ang) * tilt;
      blade.rotation.x = Math.sin(ang) * tilt;
      tuft.add(blade);
    }
    return tuft;
  }

  private populateTitleRocks(): void {
    this.clearGroupChildren(this.titleRockGroup);
    this.turntableDisc = null;
    const heroX = START_X + 62;
    const groundAtHero = sampleDriveHeight(heroX, this.activeStage);
    const platformTopY = groundAtHero + 0.55;

    // Level Grey Circular Showroom Turntable Board + Heavy Pedestal Base
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.78,
      metalness: 0.35,
    });
    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.45, 3.85, 1.8, 48),
      pedestalMat,
    );
    basePlinth.position.set(heroX, platformTopY - 1.08, 0);
    basePlinth.receiveShadow = true;
    this.titleRockGroup.add(basePlinth);

    const discGroup = new THREE.Group();
    discGroup.position.set(heroX, platformTopY, 0);

    const topPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(3.35, 3.45, 0.22, 48),
      new THREE.MeshStandardMaterial({
        color: '#64748b',
        roughness: 0.62,
        metalness: 0.24,
      }),
    );
    topPlate.position.y = -0.11;
    topPlate.receiveShadow = true;
    discGroup.add(topPlate);

    const innerPad = new THREE.Mesh(
      new THREE.CylinderGeometry(2.95, 2.95, 0.03, 48),
      new THREE.MeshStandardMaterial({
        color: '#475569',
        roughness: 0.74,
        metalness: 0.18,
      }),
    );
    innerPad.position.y = 0.005;
    innerPad.receiveShadow = true;
    discGroup.add(innerPad);

    const bevelRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.36, 0.06, 10, 48),
      new THREE.MeshStandardMaterial({
        color: '#cbd5e1',
        roughness: 0.35,
        metalness: 0.75,
      }),
    );
    bevelRing.rotation.x = Math.PI / 2;
    bevelRing.position.y = 0.0;
    discGroup.add(bevelRing);

    const tickMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.5,
      metalness: 0.3,
    });
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.05), tickMat);
      tick.position.set(Math.cos(ang) * 3.12, 0.015, Math.sin(ang) * 3.12);
      tick.rotation.y = -ang;
      discGroup.add(tick);
    }

    this.turntableDisc = discGroup;
    this.titleRockGroup.add(discGroup);
  }

  private clearGroupChildren(grp: THREE.Group): void {
    while (grp.children.length > 0) {
      const child = grp.children[0];
      grp.remove(child);
      child.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
    }
  }

  private updateBridgesAndProps(): void {
    const minX = this.camX - 54;
    const maxX = this.camX + 72;

    if (this.activeStage.hasBridges) {
      const foundStarts = new Set<number>();
      for (let x = minX; x <= maxX; x += 12) {
        const br = getBridgeInfo(x, this.activeStage);
        if (br.active) foundStarts.add(Math.round(br.startX));
      }
      const starts = Array.from(foundStarts);
      this.bridgePool.forEach((entry, idx) => {
        if (idx < starts.length) {
          const sx = starts[idx];
          entry.group.visible = true;
          const yL = sampleBaseGroundHeight(sx - 0.1, this.activeStage);
          const yR = sampleBaseGroundHeight(sx + 38 + 0.1, this.activeStage);
          entry.group.position.set(sx, yL, 0);
          entry.group.rotation.z = Math.atan2(yR - yL, 38);
          entry.group.scale.x = this.activeStage.id === 'red_canyon' ? 1.0 : 32 / 38;
        } else {
          entry.group.visible = false;
        }
      });
    } else {
      this.bridgePool.forEach((b) => (b.group.visible = false));
    }

    // Cave Tunnels
    if (this.activeStage.hasTunnels) {
      const foundTunnels = new Map<number, number>();
      for (let x = minX; x <= maxX; x += 10) {
        const tn = getTunnelInfo(x, this.activeStage);
        if (tn.active) foundTunnels.set(Math.round(tn.startX), tn.ceilingY);
      }
      const tEntries = Array.from(foundTunnels.entries());
      this.tunnelPool.forEach((tm, idx) => {
        if (idx < tEntries.length) {
          const [sx, cy] = tEntries[idx];
          tm.visible = true;
          tm.position.set(sx, cy, 0);
        } else {
          tm.visible = false;
        }
      });
    } else {
      this.tunnelPool.forEach((t) => (t.visible = false));
    }

    // Midground Scenic Props (strictly z <= -2.4 behind track plane)
    const propSpacing = 11.5;
    const slotStart = Math.floor(minX / propSpacing);
    const slotEnd = Math.ceil(maxX / propSpacing);

    for (let i = 0; i < PROP_POOL_SIZE; i++) {
      const slot = slotStart + i;
      const grp = this.propPool[i];
      if (slot > slotEnd) {
        grp.visible = false;
        continue;
      }
      const isPoleSlot = this.activeStage.id === 'countryside' && slot % 3 === 0;
      const px = isPoleSlot ? slot * propSpacing : slot * propSpacing + hash01(slot * 7 + 3) * 6;
      const br = getBridgeInfo(px, this.activeStage);
      if (this.propSlots[i] !== slot) {
        this.propSlots[i] = slot;
        this.populateProp(grp, slot, propSpacing);
      }
      if (br.active || (!isPoleSlot && hash01(slot * 11 + 5) < 0.22)) {
        grp.visible = false;
      } else {
        grp.visible = true;
        const py = sampleBaseGroundHeight(px, this.activeStage);
        const pz = isPoleSlot ? -3.4 : -3.4 - hash01(slot * 17 + 19) * 5.2;
        grp.position.set(px, py - 0.05, pz);
      }
    }

    // Foreground Parallax Props kept low (py - 0.55) so side-view never occludes tires/chassis
    const fgSpacing = 18;
    const fgStart = Math.floor((this.camX - 36) / fgSpacing);
    for (let i = 0; i < FG_POOL_SIZE; i++) {
      const slot = fgStart + i;
      const grp = this.fgPool[i];
      if (this.fgSlots[i] !== slot) {
        this.fgSlots[i] = slot;
        this.populateForegroundProp(grp, slot);
      }
      const px = slot * fgSpacing + hash01(slot * 29) * 7;
      const br = getBridgeInfo(px, this.activeStage);
      if (br.active || hash01(slot * 37) < 0.45) {
        grp.visible = false;
      } else {
        grp.visible = true;
        const py = sampleBaseGroundHeight(px, this.activeStage);
        grp.scale.setScalar(0.75);
        grp.position.set(px, py - 0.58, 5.1 + hash01(slot * 13) * 2.1);
      }
    }

    // 3D Personal Best Finish Banner
    if (this.mode === 'PLAYING' && this.stageBestMeters >= 25) {
      const bx = START_X + this.stageBestMeters;
      const br = getBridgeInfo(bx, this.activeStage);
      if (!br.active && bx >= minX - 8 && bx <= maxX + 8) {
        this.finishBannerGroup.visible = true;
        this.finishBannerGroup.position.set(bx, sampleBaseGroundHeight(bx, this.activeStage), 0);
      } else {
        this.finishBannerGroup.visible = false;
      }
    } else {
      this.finishBannerGroup.visible = false;
    }

    // CLIMB START Gate at START_X & SUMMIT FINISH Gate at getSummitX(stage)
    if (this.mode === 'PLAYING') {
      if (START_X >= minX - 10 && START_X <= maxX + 10) {
        this.startGateGroup.visible = true;
        this.startGateGroup.position.set(START_X, sampleBaseGroundHeight(START_X, this.activeStage), 0);
      } else {
        this.startGateGroup.visible = false;
      }
      const summitX = getSummitX(this.activeStage);
      if (summitX >= minX - 12 && summitX <= maxX + 16) {
        this.summitGateGroup.visible = true;
        this.summitGateGroup.position.set(summitX, sampleBaseGroundHeight(summitX, this.activeStage), 0);
      } else {
        this.summitGateGroup.visible = false;
      }
    } else {
      this.startGateGroup.visible = false;
      this.summitGateGroup.visible = false;
    }

    // Trail Milestone Signs every 100m (100m, 200m, 300m...)
    const firstSign = Math.max(1, Math.floor((minX - START_X) / 100));
    for (let i = 0; i < SIGN_POOL_SIZE; i++) {
      const mIdx = firstSign + i;
      const grp = this.signPool[i];
      const sx = START_X + mIdx * 100;
      if (sx > maxX) {
        grp.visible = false;
        continue;
      }
      const br = getBridgeInfo(sx, this.activeStage);
      if (br.active) {
        grp.visible = false;
        continue;
      }
      if (this.signSlots[i] !== mIdx) {
        this.signSlots[i] = mIdx;
        this.populateSignpost(grp, `${mIdx * 100}m`);
      }
      grp.visible = true;
      grp.position.set(sx, sampleBaseGroundHeight(sx, this.activeStage), -2.8);
    }
  }

  private populateSignpost(grp: THREE.Group, label: string): void {
    while (grp.children.length > 0) {
      const c = grp.children[0] as THREE.Mesh;
      grp.remove(c);
      c.geometry?.dispose();
      // Keep cached signpost CanvasTextures; only dispose post materials
      if (!Array.isArray(c.material) && !(c.material as THREE.MeshStandardMaterial).map) {
        c.material?.dispose();
      }
    }
    let tex = this.signTexCache.get(label);
    if (!tex) {
      tex = createSignpostTexture(label, this.maxAniso);
      this.signTexCache.set(label, tex);
    }
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 2.3, 8),
      new THREE.MeshStandardMaterial({ color: '#5c3a21', roughness: 0.9 }),
    );
    post.position.set(0, 1.15, -0.09);
    post.castShadow = true;
    grp.add(post);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.74, 0.08),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }),
    );
    board.position.set(0, 2.15, 0.06);
    board.castShadow = true;
    grp.add(board);
  }

  private populateForegroundProp(grp: THREE.Group, slot: number): void {
    this.clearGroupChildren(grp);
    const id = this.activeStage.id;
    if (id === 'countryside') {
      if (hash01(slot + 7) < 0.55) {
        const wMat = new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.92 });
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), wMat);
        post.position.y = 0.45;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.09, 0.08), wMat);
        rail.position.set(1.2, 0.75, 0);
        grp.add(post, rail);
      } else {
        const rock = this.createCraggyRockMesh(0.62, '#645c50', slot + 3, 0.6);
        rock.position.y = 0.24;
        const tuft = this.createScrubGrassTuft('#6a7c3a', slot);
        tuft.position.set(0.45, 0.08, 0.12);
        grp.add(rock, tuft);
      }
    } else if (id === 'red_canyon') {
      const rock = this.createCraggyRockMesh(0.68, '#8f3620', slot + 5, 0.62);
      rock.position.y = 0.24;
      const tuft = this.createScrubGrassTuft('#8e7e46', slot);
      tuft.position.set(-0.4, 0.08, 0.15);
      grp.add(rock, tuft);
    } else if (id === 'frost_peaks') {
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 1.15, 5),
        new THREE.MeshPhysicalMaterial({
          color: '#93c5fd',
          roughness: 0.15,
          metalness: 0.1,
          clearcoat: 0.9,
        }),
      );
      crystal.position.y = 0.45;
      crystal.rotation.z = (hash01(slot) - 0.5) * 0.35;
      grp.add(crystal);
    } else if (id === 'vice_coast') {
      if (hash01(slot + 9) < 0.55) {
        const barrier = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.72, 0.36),
          new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.85 }),
        );
        barrier.position.y = 0.36;
        const reflector = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.12, 0.4),
          new THREE.MeshBasicMaterial({
            color: slot % 2 === 0 ? '#ff2a85' : '#00f5ff',
          }),
        );
        reflector.position.y = 0.58;
        grp.add(barrier, reflector);
      } else {
        const rock = this.createCraggyRockMesh(0.58, '#78716c', slot + 11, 0.58);
        rock.position.y = 0.22;
        const tuft = this.createScrubGrassTuft('#228044', slot);
        tuft.position.set(0.38, 0.06, 0.1);
        grp.add(rock, tuft);
      }
    } else {
      const rock = this.createCraggyRockMesh(0.56, '#6b7280', slot + 13, 0.64);
      rock.position.y = 0.2;
      grp.add(rock);
    }
  }

  private populateProp(grp: THREE.Group, slot: number, propSpacing = 11.5): void {
    this.clearGroupChildren(grp);
    const id = this.activeStage.id;
    const isPoleSlot = id === 'countryside' && slot % 3 === 0;
    const sc = isPoleSlot ? 1.0 : 0.85 + hash01(slot * 23) * 0.5;
    grp.scale.setScalar(sc);

    if (id === 'countryside' || id === 'frost_peaks') {
      // Occasional Countryside Barn / Shed Landmark
      if (id === 'countryside' && slot > 0 && slot % 11 === 0) {
        const barnBody = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 2.4, 2.8),
          new THREE.MeshStandardMaterial({ color: '#a32820', roughness: 0.8 }),
        );
        barnBody.position.y = 1.2;
        barnBody.castShadow = true;
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(2.6, 1.4, 4),
          new THREE.MeshStandardMaterial({ color: '#3f3f46', roughness: 0.7 }),
        );
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 3.0;
        grp.add(barnBody, roof);
        return;
      }

      // Countryside Wooden Utility Pole with Continuous Catenary Lines Spanning Adjacent Poles
      if (isPoleSlot) {
        const poleMat = new THREE.MeshStandardMaterial({ color: '#5c3c22', roughness: 0.92 });
        const insulatorMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.35, metalness: 0.3 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 5.2, 8), poleMat);
        pole.position.y = 2.6;
        pole.castShadow = true;
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.4), poleMat);
        cross.position.y = 4.9;
        grp.add(pole, cross);

        [-0.56, 0.56].forEach((iz) => {
          const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 6), insulatorMat);
          ins.position.set(0, 5.02, iz);
          grp.add(ins);
        });

        const curX = slot * propSpacing;
        const nextX = (slot + 3) * propSpacing;
        const nextBridge = getBridgeInfo(nextX, this.activeStage);
        if (!nextBridge.active) {
          const dy = sampleBaseGroundHeight(nextX, this.activeStage) - sampleBaseGroundHeight(curX, this.activeStage);
          const spanDx = 3 * propSpacing;
          const wireMat = new THREE.MeshBasicMaterial({ color: '#1e293b' });
          [-0.56, 0.56].forEach((wz) => {
            const sagY = 5.05 + dy * 0.5 - 1.15;
            const curve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(0, 5.05, wz),
              new THREE.Vector3(spanDx * 0.5, sagY, wz),
              new THREE.Vector3(spanDx, 5.05 + dy, wz),
            ]);
            const wireGeo = new THREE.TubeGeometry(curve, 14, 0.02, 5, false);
            grp.add(new THREE.Mesh(wireGeo, wireMat));
          });
        }
        return;
      }

      // Craggy faceted rock outcrop cluster alongside trail
      if (hash01(slot * 41 + 9) < 0.25) {
        const b1 = this.createCraggyRockMesh(1.15, '#645c53', slot + 2, 0.65);
        b1.position.y = 0.42;
        const b2 = this.createCraggyRockMesh(0.75, '#786e62', slot + 9, 0.58);
        b2.position.set(0.95, 0.28, 0.35);
        const tuft = this.createScrubGrassTuft('#6f7e3d', slot);
        tuft.position.set(-0.65, 0.05, 0.45);
        grp.add(b1, b2, tuft);
        return;
      }

      // Detailed 4-tier Conifer Pine Tree
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.3, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: '#54331d', roughness: 0.92 }),
      );
      trunk.position.y = 0.8;
      trunk.castShadow = true;
      grp.add(trunk);

      const foliageColor = id === 'frost_peaks' ? '#244f46' : '#2b7d39';
      const coneMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.86 });
      for (let t = 0; t < 4; t++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(1.5 - t * 0.26, 1.75 - t * 0.16, 9),
          coneMat,
        );
        cone.position.y = 1.8 + t * 0.92;
        cone.rotation.y = t * 0.45;
        cone.castShadow = true;
        grp.add(cone);
      }
      if (id === 'frost_peaks') {
        const cap = new THREE.Mesh(
          new THREE.ConeGeometry(0.62, 0.9, 9),
          new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.55 }),
        );
        cap.position.y = 4.9;
        grp.add(cap);
      }
    } else if (id === 'red_canyon') {
      if (hash01(slot + 31) < 0.55) {
        const cMat = new THREE.MeshStandardMaterial({ color: '#3b823f', roughness: 0.82 });
        const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 2.3, 4, 8), cMat);
        stem.position.y = 1.35;
        stem.castShadow = true;
        grp.add(stem);

        const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.85, 4, 8), cMat);
        armL.position.set(-0.44, 1.6, 0);
        armL.rotation.z = 0.45;
        grp.add(armL);

        const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.72, 4, 8), cMat);
        armR.position.set(0.42, 1.28, 0);
        armR.rotation.z = -0.45;
        grp.add(armR);
      } else {
        // Layered Red-Rock Sandstone Spire / Butte
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(1.1, 1.65, 2.4, 7),
          new THREE.MeshStandardMaterial({ color: '#a8442a', roughness: 0.92 }),
        );
        base.position.y = 1.2;
        base.castShadow = true;
        const cap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.75, 1.15, 1.4, 7),
          new THREE.MeshStandardMaterial({ color: '#c95c38', roughness: 0.88 }),
        );
        cap.position.y = 3.0;
        grp.add(base, cap);
      }
    } else if (id === 'vice_coast') {
      // Leonida Vice Coastway: Neon Highway Sign Gantries, Lifeguard Towers & Curved Palms
      if (slot > 0 && slot % 8 === 0) {
        const steelMat = new THREE.MeshStandardMaterial({
          color: '#334155',
          roughness: 0.45,
          metalness: 0.72,
        });
        [-1.8, 1.8].forEach((px) => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.2, 8), steelMat);
          post.position.set(px, 2.6, 0);
          grp.add(post);
        });
        const signBoard = new THREE.Mesh(
          new THREE.BoxGeometry(4.2, 1.45, 0.18),
          new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 }),
        );
        signBoard.position.set(0, 4.4, 0);
        const neonTop = new THREE.Mesh(
          new THREE.BoxGeometry(4.3, 0.14, 0.22),
          new THREE.MeshBasicMaterial({ color: '#ff2a85' }),
        );
        neonTop.position.set(0, 5.15, 0);
        const neonBottom = new THREE.Mesh(
          new THREE.BoxGeometry(4.3, 0.14, 0.22),
          new THREE.MeshBasicMaterial({ color: '#00f5ff' }),
        );
        neonBottom.position.set(0, 3.65, 0);
        const highwayStripe = new THREE.Mesh(
          new THREE.BoxGeometry(3.6, 0.28, 0.2),
          new THREE.MeshBasicMaterial({ color: '#fbbf24' }),
        );
        highwayStripe.position.set(0, 4.4, 0.04);
        grp.add(signBoard, neonTop, neonBottom, highwayStripe);
      } else if (slot > 0 && slot % 13 === 4) {
        // Vice Beach Lifeguard Tower
        const stiltMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.75 });
        const cabinMat = new THREE.MeshStandardMaterial({ color: '#ec4899', roughness: 0.55 });
        const roofMat = new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: 0.45 });
        [-0.75, 0.75].forEach((px) => {
          [-0.6, 0.6].forEach((pz) => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.14), stiltMat);
            leg.position.set(px, 1.1, pz);
            grp.add(leg);
          });
        });
        const booth = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 1.6), cabinMat);
        booth.position.y = 2.9;
        booth.castShadow = true;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.85, 4), roofMat);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 4.05;
        grp.add(booth, roof);
      } else {
        // Curved Tropical Leonida Palm Tree
        const trunkMat = new THREE.MeshStandardMaterial({ color: '#785038', roughness: 0.9 });
        const lean = (hash01(slot * 19) - 0.35) * 0.22;
        for (let seg = 0; seg < 6; seg++) {
          const rB = 0.24 - seg * 0.02;
          const segMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(rB - 0.018, rB, 0.95, 7),
            trunkMat,
          );
          segMesh.position.set(
            lean * seg * seg * 0.26,
            0.45 + seg * 0.84,
            0,
          );
          segMesh.rotation.z = -lean * seg * 0.18;
          segMesh.castShadow = true;
          grp.add(segMesh);
        }
        const topX = lean * 25 * 0.26;
        const topY = 0.45 + 5.1;
        const frondMat = new THREE.MeshStandardMaterial({
          color: '#16a34a',
          roughness: 0.72,
          side: THREE.DoubleSide,
        });
        for (let f = 0; f < 7; f++) {
          const ang = (f / 7) * Math.PI * 2;
          const frond = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.5, 4), frondMat);
          frond.position.set(
            topX + Math.cos(ang) * 1.05,
            topY - 0.12,
            Math.sin(ang) * 1.05,
          );
          frond.rotation.z = -Math.cos(ang) * 1.18;
          frond.rotation.x = Math.sin(ang) * 1.18;
          grp.add(frond);
        }
        const coconutMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.85 });
        for (let c = 0; c < 3; c++) {
          const coco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 7), coconutMat);
          coco.position.set(topX + (c - 1) * 0.22, topY - 0.22, (c % 2) * 0.18);
          grp.add(coco);
        }
      }
    } else {
      // Moon Crater Boulders & Occasional Lunar Comm Relay Lander
      if (slot > 0 && slot % 10 === 0) {
        const pod = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.85, 0),
          new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.85, roughness: 0.25 }),
        );
        pod.position.y = 1.3;
        const dish = new THREE.Mesh(
          new THREE.ConeGeometry(0.55, 0.35, 12, 1, true),
          new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }),
        );
        dish.position.set(0, 2.3, 0);
        dish.rotation.z = -0.6;
        grp.add(pod, dish);
      } else {
        const rock = this.createCraggyRockMesh(1.12, '#787d96', slot + 17, 0.68);
        rock.position.y = 0.45;
        grp.add(rock);
      }
    }
  }

  private updateCollectibles(): void {
    this.coinPool.forEach((arr) => arr.forEach((m) => (m.visible = false)));
    this.fuelPool.forEach((f) => (f.visible = false));

    if (this.mode === 'TITLE') return;

    const minSlot = Math.max(0, Math.floor((this.camX - 38 - START_X) / 6.5));
    const maxSlot = Math.ceil((this.camX + 52 - START_X) / 6.5);
    const coinCursors: Record<number, number> = { 5: 0, 25: 0, 100: 0, 500: 0 };
    let fuelCursor = 0;

    for (let slot = minSlot; slot <= maxSlot; slot++) {
      if (this.physics?.isSlotCollected(slot)) {
        continue;
      }
      const item = getCollectibleForSlot(slot, this.activeStage);
      if (!item) continue;

      if (item.kind === 'fuel') {
        if (fuelCursor < this.fuelPool.length) {
          const fm = this.fuelPool[fuelCursor++];
          fm.visible = true;
          fm.position.set(item.x, item.y + Math.sin(this.elapsed * 3.2 + slot) * 0.14, 0);
          fm.rotation.y = Math.sin(this.elapsed * 1.8 + slot) * 0.25;
        }
      } else {
        const pool = this.coinPool.get(item.value);
        const idx = coinCursors[item.value] ?? 0;
        if (pool && idx < pool.length) {
          coinCursors[item.value] = idx + 1;
          const cm = pool[idx];
          cm.visible = true;
          cm.position.set(item.x, item.y + Math.sin(this.elapsed * 3.5 + slot * 0.7) * 0.12, 0);
          cm.rotation.y = this.elapsed * 2.8 + slot * 0.5;
        }
      }
    }
  }

  private updateParticles(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;

      if (p.kind === 'dirt' || p.kind === 'spark' || p.kind === 'snow') {
        p.vy -= 14 * dt;
      } else if (p.kind === 'smoke') {
        p.vy += 1.6 * dt;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.life -= dt;

      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }

      const frac = p.life / p.maxLife;
      const sc = p.kind === 'smoke' ? p.size * (1.8 - frac) : p.size * frac;
      _vec3.set(p.x, p.y, p.z);
      _scale.setScalar(Math.max(0.01, sc));
      _mat4.compose(_vec3, _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);

      if (p.kind === 'nitro') _color.set('#38bdf8');
      else if (p.kind === 'spark') _color.set('#fbbf24');
      else if (p.kind === 'coin') _color.set('#fde047');
      else if (p.kind === 'fuel') _color.set('#f87171');
      else if (p.kind === 'snow') _color.set('#f8fafc');
      else if (p.kind === 'smoke') _color.set('#cbd5e1');
      else _color.set(this.activeStage.dirtUpperColor);

      this.particleMesh.setColorAt(i, _color);
    }

    if (anyChanged) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private updateAtmosphere(dt: number): void {
    this.skyUniforms.time.value = this.elapsed;
    this.skyUniforms.sunDir.value.set(
      this.mode === 'TITLE' ? 0.16 : 0.76,
      this.mode === 'TITLE' ? 0.56 : 0.72,
    );

    // Orient sky plane perpendicular to active camera view ray so 3/4 angles never clip sky edges
    this.camera.getWorldDirection(_vec3);
    _vec3.y = 0;
    if (_vec3.lengthSq() < 0.0001) _vec3.set(0, 0, -1);
    _vec3.normalize();
    const rightX = -_vec3.z;
    const rightZ = _vec3.x;
    const camPos = this.camera.position;

    this.skyMesh.position.set(
      camPos.x + _vec3.x * 195,
      this.camY + 14,
      camPos.z + _vec3.z * 195,
    );
    this.skyMesh.lookAt(camPos.x, this.skyMesh.position.y, camPos.z);

    const sunSide = this.mode === 'TITLE' ? -44 : 34;
    this.sunDisc.position.set(
      camPos.x + _vec3.x * 160 + rightX * sunSide,
      this.camY + (this.mode === 'TITLE' ? 12 : 24),
      camPos.z + _vec3.z * 160 + rightZ * sunSide,
    );
    this.sunDisc.lookAt(camPos.x, camPos.y, camPos.z);

    this.earthDisc.position.set(
      camPos.x + _vec3.x * 140 - rightX * 18,
      this.camY + 14,
      camPos.z + _vec3.z * 140 - rightZ * 18,
    );
    this.earthDisc.lookAt(camPos.x, camPos.y, camPos.z);

    this.starPoints.position.set(camPos.x + _vec3.x * 40, this.camY, camPos.z + _vec3.z * 40);
    this.cloudGroup.position.set(this.camX * 0.85, this.camY * 0.82, 0);
    if (this.balloonGroup.visible) {
      this.balloonGroup.position.set(this.camX * 0.72, this.camY * 0.78, 0);
      this.balloonGroup.children.forEach((b, idx) => {
        b.position.y = 4.5 + idx * 1.4 + Math.sin(this.elapsed * 0.6 + idx * 2) * 0.45;
      });
    }

    if (this.auroraGroup.visible) {
      this.auroraGroup.position.set(this.camX, this.camY + 2.2, 0);
      this.auroraBands.forEach((band, idx) => {
        const pos = band.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          pos.setZ(i, Math.sin(x * 0.08 + this.elapsed * 0.9 + idx * 2) * 4);
        }
        pos.needsUpdate = true;
      });
    }

    if (this.ambientSnowMesh.visible) {
      this.ambientSnowMesh.position.set(this.camX, this.camY, 0);
      const isSnow = this.activeStage.hasSnowfall;
      for (let i = 0; i < this.ambientSnowPos.length; i += 3) {
        this.ambientSnowPos[i] -= (isSnow ? 1.8 : 4.5) * dt;
        this.ambientSnowPos[i + 1] -= (isSnow ? 3.2 : 0.4) * dt;
        if (this.ambientSnowPos[i + 1] < -16) this.ambientSnowPos[i + 1] = 18;
        if (this.ambientSnowPos[i] < -26) this.ambientSnowPos[i] = 26;
      }
      this.ambientSnowMesh.geometry.attributes.position.needsUpdate = true;
    }

    if (this.rainMesh.visible) {
      this.rainMesh.position.set(this.camX, this.camY, 0);
      const isStorm = this.activeClimbSetup.weather === 'storm';
      const fallVy = isStorm ? 28 : 19;
      const slantVx = isStorm ? 6.5 : 2.2;
      for (let i = 0; i < this.rainPos.length; i += 3) {
        this.rainPos[i] -= slantVx * dt;
        this.rainPos[i + 1] -= fallVy * dt;
        if (this.rainPos[i + 1] < -16) this.rainPos[i + 1] = 18;
        if (this.rainPos[i] < -28) this.rainPos[i] = 28;
      }
      this.rainMesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.clearGroupChildren(this.titleRockGroup);
    this.clearGroupChildren(this.viceHorizonGroup);
    this.clearGroupChildren(this.countrysideBackdropGroup);
    this.clearGroupChildren(this.finishBannerGroup);
    this.clearGroupChildren(this.startGateGroup);
    this.clearGroupChildren(this.summitGateGroup);
    this.propPool.forEach((g) => this.clearGroupChildren(g));
    this.fgPool.forEach((g) => this.clearGroupChildren(g));
    this.vehicleRig?.dispose();
    this.ghostRig?.dispose();
    this.aiRig?.dispose();
    this.roadTex?.dispose();
    this.strataTex?.dispose();
    this.terrainBumpTex.dispose();
    this.woodTex.dispose();
    this.earthTex.dispose();
    this.glowTex.dispose();
    this.ambientSnowMesh.geometry.dispose();
    (this.ambientSnowMesh.material as THREE.Material).dispose();
    this.rainMesh.geometry.dispose();
    (this.rainMesh.material as THREE.Material).dispose();
    this.skidMesh.geometry.dispose();
    (this.skidMesh.material as THREE.Material).dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.signTexCache.forEach((t) => t.dispose());
    this.signTexCache.clear();
    this.roadGeo.dispose();
    this.cliffGeo.dispose();
    this.lipGeo.dispose();
    this.farRidgeGeo.dispose();
    this.midRidgeGeo.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
