import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { PAINT_SWATCHES, VEHICLES, WHEEL_STYLES } from './constants';
import { buildVehicle3D, VehicleRig3D } from './models';
import { createGarageFloorTexture } from './textures';
import { detectSoftwareWebGL } from './worldScene';
import { VehicleId, WheelStyleId } from '../types/game';

export type GarageCameraPreset = 'hero' | 'profile' | 'cockpit' | 'wheels';

export class GarageSceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private turntable: THREE.Group;
  private vehicleRig: VehicleRig3D | null = null;
  private activeVehicleDef = VEHICLES[0];
  private floorTex: THREE.CanvasTexture;
  private frameId = 0;
  private disposed = false;
  private lastTime = 0;

  private targetYaw = -0.58;
  private currentYaw = -0.58;
  private dragging = false;
  private lastPointerX = 0;
  private dropVelocity = 0;
  private dropOffset = 0;
  private headlightsOn = true;

  private camPreset: GarageCameraPreset = 'hero';
  private camPos = new THREE.Vector3(0, 2.3, 7.2);
  private camLook = new THREE.Vector3(0, 0.85, 0);
  private targetCamPos = new THREE.Vector3(0, 2.3, 7.2);
  private targetCamLook = new THREE.Vector3(0, 0.85, 0);
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0c121c');
    this.scene.fog = new THREE.FogExp2('#0c121c', 0.028);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(36, w / h, 0.4, 80);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Lighting Rig + Studio Softboxes
    const hemi = new THREE.HemisphereLight('#94a3b8', '#1e293b', 0.72);
    this.scene.add(hemi);

    const spot = new THREE.SpotLight('#fff8eb', 45, 24, Math.PI / 4, 0.45, 1.2);
    spot.position.set(1.8, 7.5, 3.0);
    spot.castShadow = !this.isSoftwareGl;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0005;
    this.scene.add(spot);

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softboxTop = new THREE.RectAreaLight('#f8fafc', 6.5, 6.2, 2.2);
      softboxTop.position.set(0, 5.4, 0.5);
      softboxTop.lookAt(0, 0.8, 0);
      this.scene.add(softboxTop);
    }

    const redRim = new THREE.PointLight('#ef4444', 18, 16, 1.5);
    redRim.position.set(-4.8, 2.4, -3.5);
    this.scene.add(redRim);

    const blueRim = new THREE.PointLight('#38bdf8', 16, 16, 1.5);
    blueRim.position.set(4.8, 2.8, -3.2);
    this.scene.add(blueRim);

    // Concrete Epoxy Showroom Floor
    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy() || 1);
    this.floorTex = createGarageFloorTexture(maxAniso);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(24, 48),
      new THREE.MeshStandardMaterial({
        map: this.floorTex,
        roughness: 0.42,
        metalness: 0.16,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Authentic Workshop Environment Props (Gantry, Hydraulic Lift Columns, Tool Cabinet, Tire Stack)
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#131a26',
      roughness: 0.82,
      metalness: 0.2,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: '#293446',
      roughness: 0.45,
      metalness: 0.72,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(32, 13), wallMat);
    backWall.position.set(0, 6, -7.8);
    this.scene.add(backWall);

    // Overhead LED Lightbars & Steel Truss Beams
    const stripMat = new THREE.MeshBasicMaterial({ color: '#e2e8f0' });
    [-3.4, 0, 3.4].forEach((lx) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.14), stripMat);
      bar.position.set(lx, 5.5, -0.8);
      this.scene.add(bar);
    });
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(14, 0.25, 0.3), steelMat);
    gantry.position.set(0, 5.8, -4.5);
    this.scene.add(gantry);

    // Twin Hydraulic Lift Posts
    [-4.2, 4.2].forEach((px) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 5.8, 0.38), steelMat);
      post.position.set(px, 2.9, -4.6);
      this.scene.add(post);
    });

    // Red Mechanic Tool Chest (Left rear bay)
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.25, 0.72),
      new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.36, metalness: 0.45 }),
    );
    cabinet.position.set(-5.2, 0.625, -4.2);
    cabinet.rotation.y = 0.35;
    cabinet.castShadow = true;
    this.scene.add(cabinet);

    // Stacked Off-Road Spare Tires (Right rear bay)
    const rubberMat = new THREE.MeshStandardMaterial({ color: '#17191f', roughness: 0.9 });
    for (let t = 0; t < 3; t++) {
      const spare = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.16, 10, 20), rubberMat);
      spare.rotation.x = Math.PI / 2;
      spare.position.set(5.1, 0.16 + t * 0.32, -3.9);
      this.scene.add(spare);
    }

    // Rotating Turntable Pedestal
    this.turntable = new THREE.Group();
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(3.0, 3.22, 0.22, 48),
      new THREE.MeshStandardMaterial({
        color: '#202836',
        roughness: 0.28,
        metalness: 0.76,
      }),
    );
    deck.position.y = 0.11;
    deck.receiveShadow = true;
    this.turntable.add(deck);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.04, 0.045, 8, 64),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' }),
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.22;
    this.turntable.add(glowRing);
    this.scene.add(this.turntable);

    // Pointer Drag to Spin
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastPointerX = e.clientX;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.targetYaw += dx * 0.01;
    });
    const endDrag = () => {
      this.dragging = false;
    };
    dom.addEventListener('pointerup', endDrag);
    dom.addEventListener('pointercancel', endDrag);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.lastTime = performance.now();
    this.scheduleNextFrame();
  }

  public setCameraPreset(preset: GarageCameraPreset): void {
    this.camPreset = preset;
    if (preset === 'hero') {
      this.targetCamPos.set(0, 2.3, 7.2);
      this.targetCamLook.set(0, 0.85, 0);
    } else if (preset === 'profile') {
      this.targetCamPos.set(0, 1.35, 6.2);
      this.targetCamLook.set(0, 0.88, 0);
      this.targetYaw = 0;
    } else if (preset === 'cockpit') {
      this.targetCamPos.set(0.2, 2.15, 3.6);
      this.targetCamLook.set(0, 1.1, 0);
      this.targetYaw = -0.35;
    } else if (preset === 'wheels') {
      this.targetCamPos.set(0.8, 0.95, 4.4);
      this.targetCamLook.set(0.4, 0.6, 0);
      this.targetYaw = -0.25;
    }
  }

  public triggerBounce(): void {
    this.dropOffset = 0.28;
    this.dropVelocity = -1.2;
  }

  public setHeadlights(on: boolean): void {
    this.headlightsOn = on;
    if (this.vehicleRig) {
      this.vehicleRig.headlightCones.forEach((c) => (c.visible = on));
    }
  }

  public setVehicle(
    vehicleId: VehicleId,
    paintId: string,
    wheelId: WheelStyleId,
    animateDrop = true,
  ): void {
    const vehicle = VEHICLES.find((v) => v.id === vehicleId) ?? VEHICLES[0];
    this.activeVehicleDef = vehicle;
    const paint = PAINT_SWATCHES.find((p) => p.id === paintId) ?? PAINT_SWATCHES[0];
    const wheelStyle = WHEEL_STYLES.find((w) => w.id === wheelId) ?? WHEEL_STYLES[0];

    if (this.vehicleRig) {
      this.turntable.remove(this.vehicleRig.root);
      this.vehicleRig.dispose();
    }

    this.vehicleRig = buildVehicle3D(vehicle, paint, wheelStyle, false);
    this.vehicleRig.headlightCones.forEach((c) => (c.visible = this.headlightsOn));

    const wheelY = 0.22 + vehicle.wheelRadius;
    const bodyY = wheelY + vehicle.suspensionRest * 0.72;
    this.vehicleRig.chassisGroup.position.set(0, bodyY, 0);
    this.vehicleRig.wheelRearGroup.position.set(-vehicle.wheelbase * 0.5, wheelY, 0);
    this.vehicleRig.wheelFrontGroup.position.set(vehicle.wheelbase * 0.5, wheelY, 0);

    const shockLen = vehicle.suspensionRest * 0.72 + 0.18;
    this.vehicleRig.shockRear.position.set(
      -vehicle.wheelbase * 0.5,
      -vehicle.suspensionRest * 0.72,
      this.vehicleRig.shockRear.position.z,
    );
    this.vehicleRig.shockRear.scale.y = shockLen;
    this.vehicleRig.shockFront.position.set(
      vehicle.wheelbase * 0.5,
      -vehicle.suspensionRest * 0.72,
      this.vehicleRig.shockFront.position.z,
    );
    this.vehicleRig.shockFront.scale.y = shockLen;

    this.turntable.add(this.vehicleRig.root);

    if (animateDrop) {
      this.triggerBounce();
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
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (this.disposed) return;
          const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (st === gl.UNSIGNALED) {
            this.frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            this.frameId = window.setTimeout(() => this.tick(), 80);
          }
        };
        this.frameId = window.setTimeout(poll, 5);
      } else {
        this.frameId = window.setTimeout(() => this.tick(), 80);
      }
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000 || 0.016));
    this.lastTime = now;

    if (!this.dragging && this.camPreset === 'hero') {
      this.targetYaw += dt * 0.22;
    }
    this.currentYaw = THREE.MathUtils.damp(this.currentYaw, this.targetYaw, 8, dt);
    this.turntable.rotation.y = this.currentYaw;

    // Smooth camera preset interpolation
    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, this.targetCamPos.x, 6, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, this.targetCamPos.y, 6, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, this.targetCamPos.z, 6, dt);
    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, this.targetCamLook.x, 6, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, this.targetCamLook.y, 6, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, this.targetCamLook.z, 6, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Suspension bounce physics compressing chassis & shocks independently while wheels sit on deck
    if (this.vehicleRig) {
      const springForce = -this.dropOffset * 95 - this.dropVelocity * 11;
      this.dropVelocity += springForce * dt;
      this.dropOffset += this.dropVelocity * dt;

      const v = this.activeVehicleDef;
      const wheelY = 0.22 + v.wheelRadius;
      const comp = Math.max(0.18, v.suspensionRest * 0.72 - this.dropOffset);
      this.vehicleRig.chassisGroup.position.y = wheelY + comp;

      const shockLen = comp + 0.18;
      this.vehicleRig.shockRear.position.y = -comp;
      this.vehicleRig.shockRear.scale.y = shockLen;
      this.vehicleRig.shockFront.position.y = -comp;
      this.vehicleRig.shockFront.scale.y = shockLen;
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.vehicleRig?.dispose();
    this.floorTex.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
