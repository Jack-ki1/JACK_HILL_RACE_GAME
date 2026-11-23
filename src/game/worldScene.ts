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
  buildVehicle3D,
  VehicleRig3D,
} from './models';
import { HillClimbPhysics, ParticleBurst } from './physics';
import {
  getBridgeInfo,
  getCollectibleForSlot,
  getSurfaceAt,
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
import {
  InputState,
  SaveData,
  StageConfig,
  VehicleConfig,
} from '../types/game';

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
  };
  private sunDisc: THREE.Mesh;
  private earthDisc: THREE.Mesh;
  private earthTex: THREE.CanvasTexture;
  private glowTex: THREE.CanvasTexture;
  private auroraGroup: THREE.Group;
  private auroraBands: THREE.Mesh[] = [];
  private starPoints: THREE.Points;
  private cloudGroup: THREE.Group;

  // Terrain, River Gorge & Parallax Ridges
  private roadGeo: THREE.BufferGeometry;
  private roadMat: THREE.MeshStandardMaterial;
  private roadMesh: THREE.Mesh;
  private cliffGeo: THREE.BufferGeometry;
  private cliffMat: THREE.MeshStandardMaterial;
  private cliffMesh: THREE.Mesh;
  private gorgeWaterMesh: THREE.Mesh;
  private roadTex: THREE.CanvasTexture | null = null;
  private strataTex: THREE.CanvasTexture | null = null;
  private terrainBumpTex: THREE.CanvasTexture;
  private woodTex: THREE.CanvasTexture;

  private farRidgeGeo: THREE.BufferGeometry;
  private farRidgeMat: THREE.MeshBasicMaterial;
  private midRidgeGeo: THREE.BufferGeometry;
  private midRidgeMat: THREE.MeshBasicMaterial;

  // Bridges, Scenery Props, Foreground Speed Markers, Signposts, Collectibles, Particles
  private bridgePool: { group: THREE.Group; activeStartX: number }[] = [];
  private propPool: THREE.Group[] = [];
  private propSlots: number[] = [];
  private fgPool: THREE.Group[] = [];
  private fgSlots: number[] = [];
  private signPool: THREE.Group[] = [];
  private signSlots: number[] = [];
  private signTexCache = new Map<string, THREE.CanvasTexture>();
  private coinPool: Map<number, THREE.Group[]> = new Map();
  private fuelPool: THREE.Group[] = [];
  private particleMesh: THREE.InstancedMesh;
  private particles: ActiveParticle[] = [];
  private ambientSnowMesh: THREE.Points;
  private ambientSnowPos: Float32Array;

  // Vehicle & Physics
  private vehicleRig: VehicleRig3D | null = null;
  private activeStage: StageConfig = STAGES[0];
  private activeVehicle: VehicleConfig = VEHICLES[0];
  private activePaintId = 'frontier_red';
  private activeWheelId = 'steel';
  private physics: HillClimbPhysics | null = null;
  private input: InputState = { gas: false, brake: false, nitro: false, handbrake: false };
  private mode: WorldMode = 'TITLE';

  // Camera smoothing
  private camX = START_X + 2;
  private camY = 3;
  private camZ = 15.5;
  private camZoom = 1.0;

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
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy() || 1);

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
    this.scene.fog = new THREE.FogExp2('#b7dff6', 0.0062);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(44, w / h, 0.5, 340);
    this.camera.position.set(this.camX, this.camY, this.camZ);

    // 3-Point Natural Outdoor Lighting Rig
    this.hemiLight = new THREE.HemisphereLight('#8fd2ff', '#4a5a2b', 1.05);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff3d6', 2.45);
    this.sunLight.position.set(18, 28, 16);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 90;
    const d = 26;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight('#ffffff', 0.6);
    this.rimLight.position.set(-14, 10, -18);
    this.scene.add(this.rimLight);

    // Atmospheric Sky Backdrop with Rayleigh Sun Scattering Glow
    this.skyUniforms = {
      topColor: { value: new THREE.Color('#2476cf') },
      bottomColor: { value: new THREE.Color('#bfe6ff') },
      sunGlowColor: { value: new THREE.Color('#ffe8b5') },
    };
    this.skyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 240),
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
          varying vec2 vUv;
          void main() {
            float h = clamp(vUv.y, 0.0, 1.0);
            vec3 sky = mix(bottomColor, topColor, pow(h, 0.68));
            float sunDist = distance(vUv, vec2(0.62, 0.66));
            float scatter = exp(-sunDist * 5.2) * 0.28;
            sky += sunGlowColor * scatter;
            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    );
    this.skyMesh.position.set(0, 26, -145);
    this.scene.add(this.skyMesh);

    // Sun / Moon Disc + Halo
    this.glowTex = createSoftGlowTexture();
    this.sunDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshBasicMaterial({
        map: this.glowTex,
        color: '#fff4c8',
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        fog: false,
      }),
    );
    this.sunDisc.position.set(42, 34, -125);
    this.scene.add(this.sunDisc);

    // Earth Disc visible in Moon Crater black sky
    this.earthTex = createEarthTexture(this.maxAniso);
    this.earthDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({
        map: this.earthTex,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    this.earthDisc.position.set(-28, 28, -120);
    this.earthDisc.visible = false;
    this.scene.add(this.earthDisc);

    // Twinkling Starfield
    const starCount = 320;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (hash01(i * 3 + 1) - 0.5) * 360;
      starPositions[i * 3 + 1] = 8 + hash01(i * 3 + 2) * 92;
      starPositions[i * 3 + 2] = -130;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: '#ffffff',
        size: 0.95,
        sizeAttenuation: true,
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
      const aGeo = new THREE.PlaneGeometry(250, 28, 48, 4);
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
      band.position.set(0, 32 + b * 8, -110 - b * 6);
      this.auroraBands.push(band);
      this.auroraGroup.add(band);
    }
    this.auroraGroup.visible = false;
    this.scene.add(this.auroraGroup);

    // Layered 3D Clouds
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
        [0, 0, 0, 3.4],
        [2.8, -0.4, 0.2, 2.5],
        [-2.7, -0.5, -0.1, 2.4],
        [0.9, 1.2, 0, 2.2],
        [-1.1, 0.9, 0.1, 1.9],
      ];
      puffs.forEach(([px, py, pz, r]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
        m.scale.set(1.45, 0.68, 0.55);
        m.position.set(px, py, pz);
        cluster.add(m);
      });
      cluster.position.set(-100 + c * 26, 20 + (c % 4) * 5.5, -80 - (c % 3) * 14);
      this.cloudGroup.add(cluster);
    }
    this.scene.add(this.cloudGroup);

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

    // PBR Terrain Road & Cliff Strata with procedural micro-relief bump map
    this.terrainBumpTex = createSurfaceBumpTexture(this.maxAniso, 1.15);
    this.woodTex = createWoodPlankTexture(this.maxAniso);

    this.roadGeo = this.createRibbonGeometry(TERRAIN_SEGMENTS);
    this.roadMat = new THREE.MeshStandardMaterial({
      roughness: 0.86,
      metalness: 0.04,
      bumpMap: this.terrainBumpTex,
      bumpScale: 0.12,
      vertexColors: true,
    });
    this.roadMesh = new THREE.Mesh(this.roadGeo, this.roadMat);
    this.roadMesh.receiveShadow = true;
    this.roadMesh.frustumCulled = false;
    this.scene.add(this.roadMesh);

    this.cliffGeo = this.createRibbonGeometry(TERRAIN_SEGMENTS);
    this.cliffMat = new THREE.MeshStandardMaterial({
      roughness: 0.94,
      metalness: 0.02,
      bumpMap: this.terrainBumpTex,
      bumpScale: 0.22,
      vertexColors: true,
    });
    this.cliffMesh = new THREE.Mesh(this.cliffGeo, this.cliffMat);
    this.cliffMesh.receiveShadow = true;
    this.cliffMesh.frustumCulled = false;
    this.scene.add(this.cliffMesh);

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
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 1.25, 0.2),
          darkWoodMat,
        );
        post.position.set(px, sag + 0.6, pz);
        g.add(post);
      });
    }

    [-2.5, 2.5].forEach((pz) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 0.14, 0.14), woodMat);
      rail.position.set(span * 0.5, 0.92, pz);
      g.add(rail);

      const cable = new THREE.Mesh(new THREE.BoxGeometry(span, 0.06, 0.06), cableMat);
      cable.position.set(span * 0.5, 0.35, pz);
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

  public applyStageEnvironment(stage: StageConfig): void {
    this.activeStage = stage;
    this.skyUniforms.topColor.value.set(stage.skyTop);
    this.skyUniforms.bottomColor.value.set(stage.skyHorizon);
    this.skyUniforms.sunGlowColor.value.set(
      stage.id === 'frost_peaks'
        ? '#38bdf8'
        : stage.id === 'moon'
          ? '#475569'
          : '#ffe6ad',
    );
    this.scene.fog = new THREE.FogExp2(stage.fogColor, stage.fogDensity);

    this.sunLight.color.set(stage.sunColor);
    this.sunLight.intensity = stage.sunIntensity;
    this.hemiLight.color.set(stage.hemiSky);
    this.hemiLight.groundColor.set(stage.hemiGround);
    this.hemiLight.intensity = stage.hemiIntensity;

    const sunMat = this.sunDisc.material as THREE.MeshBasicMaterial;
    sunMat.color.set(
      stage.id === 'moon' ? '#e2e8f0' : stage.id === 'frost_peaks' ? '#a5d8ff' : '#fff3c4',
    );
    sunMat.opacity = stage.id === 'frost_peaks' ? 0.58 : 0.92;
    this.earthDisc.visible = stage.id === 'moon';

    this.starPoints.visible = stage.hasStars;
    this.auroraGroup.visible = stage.hasAurora;
    this.cloudGroup.visible = !stage.hasStars;
    this.ambientSnowMesh.visible = stage.hasSnowfall || stage.hasDustHaze;
    (this.ambientSnowMesh.material as THREE.PointsMaterial).color.set(
      stage.hasSnowfall ? '#ffffff' : '#e6a875',
    );
    this.gorgeWaterMesh.visible = stage.hasBridges;
    (this.gorgeWaterMesh.material as THREE.MeshStandardMaterial).color.set(
      stage.id === 'red_canyon' ? '#2c6c7a' : '#2580ad',
    );

    this.farRidgeMat.color.set(stage.farRidgeColor);
    this.midRidgeMat.color.set(stage.midRidgeColor);

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
    this.roadMat.needsUpdate = true;
    this.cliffMat.map = this.strataTex;
    this.cliffMat.needsUpdate = true;

    this.propSlots.fill(-99999);
    this.fgSlots.fill(-99999);
    this.signSlots.fill(-99999);
    this.bridgePool.forEach((b) => {
      b.activeStartX = -99999;
      b.group.visible = false;
    });

    if (this.vehicleRig) {
      if (this.vehicleRig.headlightSpot) {
        this.vehicleRig.headlightSpot.intensity = stage.headlightsOn ? 24 : 2.5;
      }
      this.vehicleRig.headlightCones.forEach((c) => {
        c.visible = stage.headlightsOn;
      });
    }
  }

  public rebuildVehicleModel(
    vehicle: VehicleConfig,
    paintId: string,
    wheelId: string,
    headlightsOn: boolean,
  ): void {
    this.activeVehicle = vehicle;
    this.activePaintId = paintId;
    this.activeWheelId = wheelId;
    if (this.vehicleRig) {
      this.scene.remove(this.vehicleRig.root);
      this.vehicleRig.dispose();
    }
    const paint = PAINT_SWATCHES.find((p) => p.id === paintId) ?? PAINT_SWATCHES[0];
    const wheelStyle = WHEEL_STYLES.find((w) => w.id === wheelId) ?? WHEEL_STYLES[0];
    this.vehicleRig = buildVehicle3D(vehicle, paint, wheelStyle, true);
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
  }

  public setInput(input: Partial<InputState>): void {
    Object.assign(this.input, input);
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
      onLanding: (intensity: number, surface: string) => void;
      onGearShift?: (gear: number) => void;
      onCrash: (reason: string) => void;
    },
  ): HillClimbPhysics {
    if (this.activeStage.id !== stage.id) {
      this.applyStageEnvironment(stage);
    }
    const paintId = save.vehiclePaints[vehicle.id] || vehicle.defaultPaintId;
    const wheelId = save.vehicleWheels[vehicle.id] || 'steel';
    if (
      this.activeVehicle.id !== vehicle.id ||
      this.activePaintId !== paintId ||
      this.activeWheelId !== wheelId
    ) {
      this.rebuildVehicleModel(vehicle, paintId, wheelId, stage.headlightsOn);
    } else if (this.vehicleRig) {
      if (this.vehicleRig.headlightSpot) {
        this.vehicleRig.headlightSpot.intensity = stage.headlightsOn ? 24 : 2.5;
      }
      this.vehicleRig.headlightCones.forEach((c) => (c.visible = stage.headlightsOn));
    }

    this.camZoom = save.tuning.cameraZoom || DEFAULT_TUNING.cameraZoom;
    this.simAccum = 0;
    this.particles.forEach((p) => (p.active = false));

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
        onLanding: callbacks.onLanding,
        onGearShift: callbacks.onGearShift ?? this.onGearShiftCallback ?? undefined,
        onCrash: callbacks.onCrash,
        onParticle: (p) => this.spawnParticle(p),
      },
      consumeBoosters,
    );

    this.camX = this.physics.state.x + 3.5;
    this.camY = this.physics.state.y + 1.5;
    this.mode = 'PLAYING';
    return this.physics;
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

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
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
      while (this.simAccum >= fixedStep && substeps < 12) {
        this.physics.step(fixedStep, this.input);
        this.simAccum -= fixedStep;
        substeps++;
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
      const heroX = START_X + 62;
      const heroY = sampleDriveHeight(heroX, this.activeStage) + 2.45 + Math.sin(this.elapsed * 1.4) * 0.18;
      rig.root.position.set(heroX, heroY, 0);
      rig.chassisGroup.position.set(0, 0, 0);
      rig.chassisGroup.rotation.z = 0.22 + Math.sin(this.elapsed * 1.1) * 0.03;

      const wb = this.activeVehicle.wheelbase;
      const susp = this.activeVehicle.suspensionRest * 0.65;
      const cs = Math.cos(rig.chassisGroup.rotation.z);
      const sn = Math.sin(rig.chassisGroup.rotation.z);

      rig.wheelRearGroup.position.set(-wb * 0.5 * cs + susp * sn, -wb * 0.5 * sn - susp * cs, 0);
      rig.wheelFrontGroup.position.set(wb * 0.5 * cs + susp * sn, wb * 0.5 * sn - susp * cs, 0);
      rig.wheelRearSpin.rotation.z -= dt * 8;
      rig.wheelFrontSpin.rotation.z -= dt * 8;
      rig.nitroGlow.visible = false;
      rig.brakeLightMat.emissiveIntensity = 0.7;
      rig.driverTorso.rotation.z = -0.1;
      rig.driverHead.rotation.z = -0.05;

      this.updateShocksAndArms(rig, susp, susp);

      const targetCamX = heroX - 2.6 + Math.sin(this.elapsed * 0.35) * 0.9;
      const targetCamY = heroY + 1.15;
      this.camX = THREE.MathUtils.damp(this.camX, targetCamX, 4, dt);
      this.camY = THREE.MathUtils.damp(this.camY, targetCamY, 4, dt);
      this.camZ = THREE.MathUtils.damp(this.camZ, 12.8, 4, dt);

      this.camera.position.set(this.camX, this.camY, this.camZ);
      this.camera.lookAt(this.camX + 0.5, this.camY - 0.35, 0);
      return;
    }

    if (!this.physics) return;
    const s = this.physics.state;
    const v = this.activeVehicle;

    rig.root.position.set(0, 0, 0);
    rig.chassisGroup.position.set(s.x, s.y, 0);
    rig.chassisGroup.rotation.z = s.angle;
    rig.driverTorso.rotation.z = s.torsoAngle;
    rig.driverHead.rotation.z = s.headAngle;
    rig.brakeLightMat.emissiveIntensity = s.braking ? 3.5 : 0.7;

    rig.nitroGlow.visible = s.nitroActive;
    if (s.nitroActive) {
      const flicker = 0.85 + Math.random() * 0.45;
      rig.nitroGlow.scale.set(flicker, 0.9 + Math.random() * 0.25, 0.9 + Math.random() * 0.25);
    }

    const rearPos = this.physics.getWheelWorldPosition(false);
    const frontPos = this.physics.getWheelWorldPosition(true);
    rig.wheelRearGroup.position.set(rearPos.x, rearPos.y, 0);
    rig.wheelFrontGroup.position.set(frontPos.x, frontPos.y, 0);
    rig.wheelRearSpin.rotation.z = -s.rotR;
    rig.wheelFrontSpin.rotation.z = -s.rotF;

    this.updateShocksAndArms(rig, v.suspensionRest - s.compR, v.suspensionRest - s.compF);

    // Dynamic GTA/Forza-inspired chase camera (speed lag + air zoom-out + FOV punch)
    const speed = Math.hypot(s.vx, s.vy);
    const groundY = sampleDriveHeight(s.x, this.activeStage);
    const heightAboveGround = Math.max(0, s.y - groundY - v.suspensionRest - v.wheelRadius);
    const lookAheadX = THREE.MathUtils.clamp(s.vx * 0.36, -3.5, 9.5);
    const targetCamX = s.x + 2.8 + lookAheadX;
    const targetCamY = s.y + 1.85 + Math.min(3.5, speed * 0.06);
    const targetCamZ = (16.5 + Math.min(8.5, speed * 0.24) + Math.min(4.5, heightAboveGround * 0.75)) / this.camZoom;

    this.camX = THREE.MathUtils.damp(this.camX, targetCamX, 6.5, dt);
    this.camY = THREE.MathUtils.damp(this.camY, targetCamY, 5.2, dt);
    this.camZ = THREE.MathUtils.damp(this.camZ, targetCamZ, 4.0, dt);

    const targetFov = 43 + (s.nitroActive ? 5.8 : 0) + Math.min(6.5, speed * 0.18);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }

    const shakeX = (Math.random() - 0.5) * s.shakeIntensity * 0.9;
    const shakeY = (Math.random() - 0.5) * s.shakeIntensity * 0.9;

    this.camera.position.set(this.camX + shakeX, this.camY + shakeY, this.camZ);
    this.camera.lookAt(this.camX + 1.1, this.camY - 0.75, 0);

    this.sunLight.position.set(s.x + 14, s.y + 26, 16);
    this.sunLight.target.position.set(s.x + 2, s.y, 0);
  }

  private updateShocksAndArms(rig: VehicleRig3D, lenR: number, lenF: number): void {
    const wb = this.activeVehicle.wheelbase;
    rig.shockRear.position.set(-wb * 0.5, -lenR, rig.shockRear.position.z);
    rig.shockRear.scale.y = Math.max(0.25, lenR + 0.18);
    rig.shockFront.position.set(wb * 0.5, -lenF, rig.shockFront.position.z);
    rig.shockFront.scale.y = Math.max(0.25, lenF + 0.18);

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

    for (let i = 0; i <= TERRAIN_SEGMENTS; i++) {
      const x = startX + i * TERRAIN_STEP_X;
      const gy = sampleBaseGroundHeight(x, this.activeStage);
      const surf = getSurfaceAt(x, this.activeStage);

      const v0 = i * 2;
      const v1 = v0 + 1;
      roadPos.setXYZ(v0, x, gy, -7.2);
      roadPos.setXYZ(v1, x, gy, 4.2);
      roadUv.setXY(v0, x * 0.14, 0);
      roadUv.setXY(v1, x * 0.14, 1);

      if (surf.surface === 'ice') {
        roadCol.setXYZ(v0, 0.52, 0.86, 1.0);
        roadCol.setXYZ(v1, 0.58, 0.9, 1.0);
      } else {
        roadCol.setXYZ(v0, 1, 1, 1);
        roadCol.setXYZ(v1, 0.95, 0.95, 0.95);
      }

      cliffPos.setXYZ(v0, x, gy, 4.2);
      cliffPos.setXYZ(v1, x, gy - 28, 4.2);
      cliffUv.setXY(v0, x * 0.09, 0);
      cliffUv.setXY(v1, x * 0.09, 1);
      cliffCol.setXYZ(v0, 1, 1, 1);
      cliffCol.setXYZ(v1, 0.6, 0.6, 0.6);
    }

    roadPos.needsUpdate = true;
    roadUv.needsUpdate = true;
    roadCol.needsUpdate = true;
    this.roadGeo.computeVertexNormals();

    cliffPos.needsUpdate = true;
    cliffUv.needsUpdate = true;
    cliffCol.needsUpdate = true;
    this.cliffGeo.computeVertexNormals();

    if (this.gorgeWaterMesh.visible) {
      this.gorgeWaterMesh.position.x = this.camX;
      this.gorgeWaterMesh.position.y =
        sampleBaseGroundHeight(this.camX, this.activeStage) - 9.5;
    }

    const updateRidge = (geo: THREE.BufferGeometry, parallax: number, baseY: number, scaleY: number, freq: number) => {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const step = 3.2;
      const ridgeStart = this.camX - (RIDGE_SEGMENTS * step) * 0.5;
      for (let i = 0; i <= RIDGE_SEGMENTS; i++) {
        const x = ridgeStart + i * step;
        const wx = x - this.camX * (1 - parallax);
        const h =
          baseY +
          Math.sin(wx * freq) * scaleY +
          Math.sin(wx * freq * 2.3 + 1.1) * (scaleY * 0.45) +
          Math.abs(Math.cos(wx * freq * 0.6)) * (scaleY * 0.55);
        pos.setXYZ(i * 2, x, this.camY * 0.35 + h, 0);
        pos.setXYZ(i * 2 + 1, x, this.camY * 0.35 - 48, 0);
      }
      pos.needsUpdate = true;
    };

    updateRidge(this.farRidgeGeo, 0.16, 10, 11.5 * this.activeStage.ampMult, 0.042);
    updateRidge(this.midRidgeGeo, 0.35, 3, 6.8 * this.activeStage.ampMult, 0.068);
  }

  private clearGroupChildren(grp: THREE.Group): void {
    while (grp.children.length > 0) {
      const c = grp.children[0] as THREE.Mesh;
      grp.remove(c);
      c.geometry?.dispose();
      if (Array.isArray(c.material)) {
        c.material.forEach((mat) => mat.dispose());
      } else {
        c.material?.dispose();
      }
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

    // Midground Scenic Props
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
      if (this.propSlots[i] !== slot) {
        this.propSlots[i] = slot;
        this.populateProp(grp, slot);
      }
      const px = slot * propSpacing + hash01(slot * 7 + 3) * 6;
      const br = getBridgeInfo(px, this.activeStage);
      if (br.active || hash01(slot * 11 + 5) < 0.22) {
        grp.visible = false;
      } else {
        grp.visible = true;
        const py = sampleBaseGroundHeight(px, this.activeStage);
        const pz = -3.8 - hash01(slot * 17 + 19) * 5.2;
        grp.position.set(px, py - 0.05, pz);
      }
    }

    // Foreground Parallax Props (passing fence posts / scrub / rocks at z = +5.6..+7.6)
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
      if (br.active || hash01(slot * 37) < 0.4) {
        grp.visible = false;
      } else {
        grp.visible = true;
        const py = sampleBaseGroundHeight(px, this.activeStage);
        grp.position.set(px, py - 0.3, 4.9 + hash01(slot * 13) * 2.2);
      }
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
      grp.position.set(sx, sampleBaseGroundHeight(sx, this.activeStage), -3.2);
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
    post.position.y = 1.15;
    post.castShadow = true;
    grp.add(post);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.72, 0.08),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }),
    );
    board.position.y = 2.15;
    board.castShadow = true;
    grp.add(board);
  }

  private populateForegroundProp(grp: THREE.Group, slot: number): void {
    this.clearGroupChildren(grp);
    const id = this.activeStage.id;
    if (id === 'countryside') {
      // Split-rail wooden fence post or foreground rock
      if (hash01(slot + 7) < 0.6) {
        const wMat = new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.92 });
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), wMat);
        post.position.y = 0.45;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.09, 0.08), wMat);
        rail.position.set(1.2, 0.75, 0);
        grp.add(post, rail);
      } else {
        const bush = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.55, 1),
          new THREE.MeshStandardMaterial({ color: '#398a38', roughness: 0.9 }),
        );
        bush.scale.set(1.3, 0.75, 0.9);
        bush.position.y = 0.28;
        grp.add(bush);
      }
    } else if (id === 'red_canyon') {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.6, 0),
        new THREE.MeshStandardMaterial({ color: '#8f3620', roughness: 0.92 }),
      );
      rock.scale.set(1.4, 0.7, 0.9);
      rock.position.y = 0.25;
      grp.add(rock);
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
    } else {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.5, 0),
        new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.94 }),
      );
      rock.position.y = 0.2;
      grp.add(rock);
    }
  }

  private populateProp(grp: THREE.Group, slot: number): void {
    this.clearGroupChildren(grp);
    const sc = 0.85 + hash01(slot * 23) * 0.5;
    grp.scale.setScalar(sc);
    const id = this.activeStage.id;

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
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.0, 0),
          new THREE.MeshStandardMaterial({ color: '#787d96', roughness: 0.92 }),
        );
        rock.scale.set(1.25, 0.75, 1.1);
        rock.position.y = 0.45;
        rock.castShadow = true;
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
    this.skyMesh.position.set(this.camX, this.camY + 12, -145);
    this.sunDisc.position.set(this.camX + 38, this.camY + 24, -125);
    this.earthDisc.position.set(this.camX - 30, this.camY + 24, -120);
    this.starPoints.position.set(this.camX, this.camY, 0);
    this.cloudGroup.position.set(this.camX * 0.85, this.camY * 0.45, 0);

    if (this.auroraGroup.visible) {
      this.auroraGroup.position.set(this.camX, this.camY + 8, 0);
      this.auroraBands.forEach((band, idx) => {
        const pos = band.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          pos.setZ(i, Math.sin(x * 0.04 + this.elapsed * 0.9 + idx * 2) * 8);
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
        if (this.ambientSnowPos[i + 1] < -10) this.ambientSnowPos[i + 1] = 18;
        if (this.ambientSnowPos[i] < -30) this.ambientSnowPos[i] = 30;
      }
      this.ambientSnowMesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.vehicleRig?.dispose();
    this.roadTex?.dispose();
    this.strataTex?.dispose();
    this.terrainBumpTex.dispose();
    this.woodTex.dispose();
    this.earthTex.dispose();
    this.glowTex.dispose();
    this.signTexCache.forEach((t) => t.dispose());
    this.signTexCache.clear();
    this.roadGeo.dispose();
    this.cliffGeo.dispose();
    this.farRidgeGeo.dispose();
    this.midRidgeGeo.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
