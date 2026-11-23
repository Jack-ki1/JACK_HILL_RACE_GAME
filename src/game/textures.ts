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

  // Crisp sedimentary geological bands
  for (let b = 0; b < 22; b++) {
    const by = 20 + b * 22;
    ctx.fillStyle = b % 2 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, by);
    for (let x = 0; x <= 512; x += 24) {
      ctx.lineTo(x, by + Math.sin(x * 0.035 + b) * 5);
    }
    ctx.lineTo(512, by + 13);
    ctx.lineTo(0, by + 13);
    ctx.closePath();
    ctx.fill();
  }

  // Embedded rocks, roots & crisp fracture veins
  for (let i = 0; i < 340; i++) {
    const px = (i * 97) % 512;
    const py = 18 + ((i * 173) % 482);
    const rx = 4 + (i % 15);
    const ry = 2.5 + (i % 7);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.28)' : i % 3 === 1 ? 'rgba(255,255,255,0.11)' : 'rgba(60,40,25,0.3)';
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, (i % 7) * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sharp overhanging turf / snow lip shadow
  const lipGrad = ctx.createLinearGradient(0, 0, 0, 34);
  lipGrad.addColorStop(0, topColor);
  lipGrad.addColorStop(0.42, 'rgba(0,0,0,0.38)');
  lipGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lipGrad;
  ctx.fillRect(0, 0, 512, 34);

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

  const isAsphalt = baseColor.toLowerCase() === '#363b4d';

  if (isAsphalt) {
    // GTA 6 Leonida coastal highway with pink/coral curb edges & yellow dashed center stripes
    const roadGrad = ctx.createLinearGradient(0, 0, 0, 512);
    roadGrad.addColorStop(0, edgeColor);
    roadGrad.addColorStop(0.14, '#d97757');
    roadGrad.addColorStop(0.22, '#242734');
    roadGrad.addColorStop(0.5, '#333849');
    roadGrad.addColorStop(0.78, '#242734');
    roadGrad.addColorStop(0.86, '#d97757');
    roadGrad.addColorStop(1, edgeColor);
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt aggregate grain & hairline cracks
    for (let i = 0; i < 1200; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.24)';
      ctx.fillRect(x, y, 2, 2);
    }

    // Razor-sharp neon-white shoulder lines + dashed gold highway center stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, 120, 512, 7);
    ctx.fillRect(0, 385, 512, 7);

    ctx.fillStyle = '#fbbf24';
    for (let x = 14; x < 512; x += 64) {
      ctx.fillRect(x, 248, 36, 16);
    }
  } else {
    // Crisp two-track off-road trail with center grass/berm crown
    const roadGrad = ctx.createLinearGradient(0, 0, 0, 512);
    roadGrad.addColorStop(0, edgeColor);
    roadGrad.addColorStop(0.16, baseColor);
    roadGrad.addColorStop(0.28, dirtColor);
    roadGrad.addColorStop(0.42, '#432914');
    roadGrad.addColorStop(0.5, dirtColor);
    roadGrad.addColorStop(0.58, '#432914');
    roadGrad.addColorStop(0.72, dirtColor);
    roadGrad.addColorStop(0.84, baseColor);
    roadGrad.addColorStop(1, edgeColor);
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle tire tread impressions & sharp gravel pebbles
    for (let i = 0; i < 750; i++) {
      const x = (i * 67) % 512;
      const y = (i * 131) % 512;
      const w = 2 + (i % 4);
      const h = 2 + (i % 3);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y, w, h);
    }

    // Crisp chevron tire marks inside the ruts
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
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

export function createLicensePlateTexture(
  plateText: string,
  maxAniso: number,
): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#fff7ed');
  grad.addColorStop(0.55, '#fde68a');
  grad.addColorStop(1, '#fb7185');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);

  // Plate border & top state strip
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 120);

  ctx.fillStyle = '#0891b2';
  ctx.fillRect(8, 8, 240, 26);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 16px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEONIDA · VICE COAST', 128, 22);

  // Palm icon badge behind numbers
  ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.beginPath();
  ctx.arc(128, 76, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 44px "JetBrains Mono", monospace';
  ctx.fillText(plateText, 128, 80);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * High-contrast GTA 6 inspired procedural car vinyl livery textures
 * ('sticker_bomb' collage wrap and 'viper_stripe' motorsport stripes).
 */
export function createLiveryTexture(
  liveryId: 'sticker_bomb' | 'viper_stripe',
  primaryHex: string,
  accentHex: string,
  maxAniso: number,
): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d')!;

  if (liveryId === 'viper_stripe') {
    // Rich painted clearcoat base with ultra-sharp twin Viper racing stripes + outer razor pinlines
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle metallic sheen gradient across panel
    const sheen = ctx.createLinearGradient(0, 0, 512, 0);
    sheen.addColorStop(0, 'rgba(0,0,0,0.16)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, 512, 512);

    // Contrast dark shadow backing behind twin stripes
    ctx.fillStyle = '#090d16';
    ctx.fillRect(156, 0, 200, 512);

    // Outer razor pinlines
    ctx.fillStyle = accentHex;
    ctx.fillRect(162, 0, 8, 512);
    ctx.fillRect(342, 0, 8, 512);

    // Dual wide aggressive center Viper stripes (crisp ice-white + subtle highlight)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(180, 0, 66, 512);
    ctx.fillRect(266, 0, 66, 512);

    // High-contrast center accent divider
    ctx.fillStyle = accentHex;
    ctx.fillRect(252, 0, 8, 512);
  } else {
    // GTA 6 Leonida Street-Art Sticker Bomb Collage
    ctx.fillStyle = '#0b0e17';
    ctx.fillRect(0, 0, 512, 512);

    const palette = [
      '#ff2e93', // Vice Neon Pink
      '#22d3ee', // Leonida Cyan
      '#facc15', // High-Vis Gold
      '#a3e635', // Toxic Lime
      '#fb7185', // Sunset Coral
      '#f8fafc', // Comic White
      '#a855f7', // UV Violet
      '#ef4444', // Corsa Red
      accentHex,
    ];
    const tags = ['VICE', '06', 'JACK', 'GT', 'APEX', 'NITRO', '24/7', '88', 'RAW', 'LOUD'];

    // Layer 1: Bold overlapping comic sticker rectangles & diamond badges
    for (let i = 0; i < 96; i++) {
      const seedA = pseudoNoise(i, 3.1, 7);
      const seedB = pseudoNoise(i, 9.7, 13);
      const seedC = pseudoNoise(i, 15.3, 19);
      const cx = seedA * 512;
      const cy = seedB * 512;
      const rot = (seedC - 0.5) * 1.4;
      const w = 52 + (i % 5) * 18;
      const h = 28 + (i % 4) * 12;
      const col = palette[i % palette.length];

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      // Thick comic black & white double sticker border
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w * 0.5 - 4, -h * 0.5 - 4, w + 8, h + 8);
      ctx.strokeStyle = '#090b10';
      ctx.lineWidth = 4;
      ctx.strokeRect(-w * 0.5 - 4, -h * 0.5 - 4, w + 8, h + 8);

      ctx.fillStyle = col;
      ctx.fillRect(-w * 0.5, -h * 0.5, w, h);

      // Graphic accents: lightning zigzags, checker strips, or bold street tags
      if (i % 3 === 0) {
        ctx.fillStyle = '#090b10';
        ctx.font = '900 18px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tags[i % tags.length], 0, 1);
      } else if (i % 3 === 1) {
        ctx.fillStyle = '#090b10';
        for (let k = -2; k < 2; k++) {
          ctx.fillRect(k * 16, -h * 0.5, 8, h * 0.5);
          ctx.fillRect(k * 16 + 8, 0, 8, h * 0.5);
        }
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-14, -8);
        ctx.lineTo(4, -8);
        ctx.lineTo(-2, 0);
        ctx.lineTo(14, 0);
        ctx.lineTo(-6, 10);
        ctx.lineTo(0, 1);
        ctx.lineTo(-14, 1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Wrap edges cleanly for RepeatWrapping across fenders
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 510, 510);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Dynamic transparent grime, mud splatter & off-road spray overlay texture.
 * Driven in WorldSceneController by distance traveled & hard landing impacts.
 */
export function createDirtOverlayTexture(maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  // Heavy lower rocker-panel mud crust gradient (bottom up)
  const lowerCrust = ctx.createLinearGradient(0, 260, 0, 512);
  lowerCrust.addColorStop(0, 'rgba(255,255,255,0)');
  lowerCrust.addColorStop(0.45, 'rgba(245,240,235,0.38)');
  lowerCrust.addColorStop(0.85, 'rgba(235,228,220,0.82)');
  lowerCrust.addColorStop(1, 'rgba(220,210,200,0.95)');
  ctx.fillStyle = lowerCrust;
  ctx.fillRect(0, 260, 512, 252);

  // Tire roost arcs (front and rear wheel well splatter fans)
  const arches = [110, 402];
  for (const ax of arches) {
    for (let k = 0; k < 140; k++) {
      const ang = -Math.PI * 0.9 + pseudoNoise(k, ax, 5) * Math.PI * 0.85;
      const dist = 36 + pseudoNoise(k, ax, 11) * 165;
      const px = ax + Math.cos(ang) * dist;
      const py = 460 + Math.sin(ang) * dist * 0.88;
      const r = 2.5 + pseudoNoise(k, ax, 19) * 11;
      const alpha = 0.25 + pseudoNoise(k, ax, 27) * 0.65;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 1.4, r * 0.72, ang + 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // High-speed longitudinal wind/mud streaks & flecks across door & hood panels
  for (let i = 0; i < 420; i++) {
    const px = pseudoNoise(i, 2.3, 17) * 512;
    const py = 95 + pseudoNoise(i, 6.7, 29) * 410;
    const streakLen = 6 + pseudoNoise(i, 11.1, 31) * 32;
    const thickness = 1.2 + pseudoNoise(i, 13.7, 43) * 4.5;
    const alpha = (0.18 + pseudoNoise(i, 19.3, 53) * 0.6) * (py > 300 ? 1 : 0.6);
    ctx.fillStyle = `rgba(248, 245, 240, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(px, py, streakLen, thickness, -0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}
