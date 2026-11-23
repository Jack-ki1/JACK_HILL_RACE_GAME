import * as THREE from 'three';

function pseudoNoise(x: number, y: number, seed = 1): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

export function createCoinTexture(value: number, maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d')!;

  const grad = ctx.createRadialGradient(96, 86, 18, 128, 128, 124);
  grad.addColorStop(0, '#fff7bd');
  grad.addColorStop(0.5, '#f5b818');
  grad.addColorStop(0.88, '#c97e06');
  grad.addColorStop(1, '#7c4702');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Milled rim notches
  ctx.strokeStyle = '#925404';
  ctx.lineWidth = 4;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
    ctx.lineTo(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124);
    ctx.stroke();
  }

  ctx.strokeStyle = '#8c5303';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#ffed8a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#6b3a00';
  ctx.font = '900 84px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 128, 134);

  ctx.fillStyle = '#fff6bf';
  ctx.fillText(String(value), 128, 128);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createTerrainStrataTexture(
  topColor: string,
  upperDirt: string,
  lowerDirt: string,
  maxAniso: number,
): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, topColor);
  grad.addColorStop(0.06, upperDirt);
  grad.addColorStop(0.45, lowerDirt);
  grad.addColorStop(1, '#140c07');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Sedimentary geological bands
  for (let b = 0; b < 18; b++) {
    const by = 24 + b * 27;
    ctx.fillStyle = b % 2 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(0, by);
    for (let x = 0; x <= 512; x += 32) {
      ctx.lineTo(x, by + Math.sin(x * 0.03 + b) * 6);
    }
    ctx.lineTo(512, by + 16);
    ctx.lineTo(0, by + 16);
    ctx.closePath();
    ctx.fill();
  }

  // Embedded rocks, roots & fracture veins
  for (let i = 0; i < 260; i++) {
    const px = (i * 97) % 512;
    const py = 20 + ((i * 173) % 480);
    const rx = 5 + (i % 18);
    const ry = 3 + (i % 9);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.22)' : i % 3 === 1 ? 'rgba(255,255,255,0.08)' : 'rgba(60,40,25,0.25)';
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, (i % 7) * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Overhanging turf / snow lip shadow
  const lipGrad = ctx.createLinearGradient(0, 0, 0, 38);
  lipGrad.addColorStop(0, topColor);
  lipGrad.addColorStop(0.45, 'rgba(0,0,0,0.28)');
  lipGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lipGrad;
  ctx.fillRect(0, 0, 512, 38);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createRoadTrackTexture(
  baseColor: string,
  edgeColor: string,
  dirtColor: string,
  maxAniso: number,
): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // Realistic two-track off-road trail with center grass/berm crown
  const roadGrad = ctx.createLinearGradient(0, 0, 0, 512);
  roadGrad.addColorStop(0, edgeColor);
  roadGrad.addColorStop(0.18, baseColor);
  roadGrad.addColorStop(0.28, dirtColor);
  roadGrad.addColorStop(0.42, '#4a301a');
  roadGrad.addColorStop(0.5, dirtColor);
  roadGrad.addColorStop(0.58, '#4a301a');
  roadGrad.addColorStop(0.72, dirtColor);
  roadGrad.addColorStop(0.82, baseColor);
  roadGrad.addColorStop(1, edgeColor);
  ctx.fillStyle = roadGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tire tread impressions & pebbles
  for (let i = 0; i < 600; i++) {
    const x = (i * 67) % 512;
    const y = (i * 131) % 512;
    const w = 3 + (i % 5);
    const h = 2 + (i % 3);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.16)';
    ctx.fillRect(x, y, w, h);
  }

  // Chevron tire marks inside the ruts
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 3;
  for (let x = 0; x < 512; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 195);
    ctx.lineTo(x + 10, 215);
    ctx.moveTo(x, 235);
    ctx.lineTo(x + 10, 215);
    ctx.moveTo(x, 285);
    ctx.lineTo(x + 10, 305);
    ctx.moveTo(x, 325);
    ctx.lineTo(x + 10, 305);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Linear-space grayscale bump map for terrain & tire micro-relief (NoColorSpace).
 */
export function createSurfaceBumpTexture(maxAniso: number, contrast = 1): THREE.CanvasTexture {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n1 = pseudoNoise(x * 0.25, y * 0.25, 3);
      const n2 = pseudoNoise(x * 0.8, y * 0.8, 9);
      const val = Math.max(0, Math.min(255, Math.round((0.5 + (n1 * 0.6 + n2 * 0.4 - 0.5) * contrast) * 255)));
      const idx = (y * size + x) * 4;
      img.data[idx] = val;
      img.data[idx + 1] = val;
      img.data[idx + 2] = val;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Linear-space tire tread bump map for realistic rubber lugs & sidewall ribs.
 */
export function createTireBumpTexture(maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#404040';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#d8d8d8';
  for (let x = 0; x < 256; x += 24) {
    ctx.fillRect(x + 3, 8, 12, 48);
    ctx.fillRect(x + 11, 72, 12, 48);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createWoodPlankTexture(maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const ctx = cv.getContext('2d')!;

  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, 0, 512, 256);

  for (let p = 0; p < 8; p++) {
    const x = p * 64;
    ctx.fillStyle = p % 2 === 0 ? '#9c6836' : '#855529';
    ctx.fillRect(x + 2, 0, 60, 256);

    // Fine wood grain lines
    ctx.strokeStyle = 'rgba(42, 22, 8, 0.22)';
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 6; g++) {
      ctx.beginPath();
      const gx = x + 8 + g * 9;
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 3, 80, gx - 3, 170, gx + 1, 256);
      ctx.stroke();
    }

    ctx.fillStyle = '#3d220c';
    ctx.fillRect(x, 0, 3, 256);
    // Steel bolt heads
    ctx.fillStyle = '#262a33';
    [28, 228].forEach((by) => {
      [x + 16, x + 48].forEach((bx) => {
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createGarageFloorTexture(maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 1024;
  const ctx = cv.getContext('2d')!;

  const grad = ctx.createRadialGradient(512, 512, 40, 512, 512, 512);
  grad.addColorStop(0, '#364154');
  grad.addColorStop(0.52, '#212938');
  grad.addColorStop(1, '#0e131c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Workshop epoxy tile joints
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 1024; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Yellow/black safety bay ring around center turntable
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.lineWidth = 10;
  ctx.setLineDash([28, 20]);
  ctx.beginPath();
  ctx.arc(512, 512, 235, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Subtle concrete wear speckles
  for (let i = 0; i < 650; i++) {
    const x = (i * 157) % 1024;
    const y = (i * 313) % 1024;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, 4, 4);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createSoftGlowTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.28, 'rgba(255, 255, 240, 0.72)');
  g.addColorStop(0.6, 'rgba(255, 240, 200, 0.22)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createEarthTexture(maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d')!;

  const ocean = ctx.createRadialGradient(92, 84, 16, 128, 128, 122);
  ocean.addColorStop(0, '#60a5fa');
  ocean.addColorStop(0.55, '#1d4ed8');
  ocean.addColorStop(1, '#0b1838');
  ctx.fillStyle = ocean;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(128, 128, 119, 0, Math.PI * 2);
  ctx.clip();

  // Continents
  ctx.fillStyle = '#4d9e58';
  ctx.beginPath();
  ctx.ellipse(90, 110, 42, 26, -0.3, 0, Math.PI * 2);
  ctx.ellipse(158, 145, 34, 44, 0.4, 0, Math.PI * 2);
  ctx.ellipse(135, 72, 28, 16, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Swirled atmospheric cloud bands
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let c = 0; c < 6; c++) {
    ctx.beginPath();
    ctx.ellipse(60 + c * 32, 65 + (c % 3) * 52, 46, 10, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crescent night-side shadow
  const shadow = ctx.createLinearGradient(40, 40, 235, 220);
  shadow.addColorStop(0, 'rgba(0,0,0,0)');
  shadow.addColorStop(0.65, 'rgba(2,6,23,0.18)');
  shadow.addColorStop(1, 'rgba(2,6,23,0.92)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, 256, 256);
  ctx.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createSignpostTexture(label: string, maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;

  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 240, 112);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 46px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 66);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}
