import {
  ClimbTireId,
  LiveryId,
  PaintSwatch,
  VehicleConfig,
  WheelStyleConfig,
} from '../types/game';
import { getClimbTireById, PAINT_SWATCHES, WHEEL_STYLES } from './constants';

const thumbCache = new Map<string, string>();

/**
 * Generates crisp, cached studio render thumbnails (480x270) for every vehicle
 * reflecting its exact body silhouette, paint clearcoat, livery stripes, wheel style,
 * and selected climb tire compound. Zero WebGL context overhead.
 */
export function renderVehiclePreviewDataUrl(
  vehicle: VehicleConfig,
  paintId: string,
  wheelId: string,
  liveryId: LiveryId,
  climbTireId: ClimbTireId,
): string {
  const key = `${vehicle.id}|${paintId}|${wheelId}|${liveryId}|${climbTireId}`;
  const existing = thumbCache.get(key);
  if (existing) return existing;

  if (typeof document === 'undefined') return '';
  const w = 480;
  const h = 250;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const paint: PaintSwatch =
    PAINT_SWATCHES.find((p) => p.id === paintId) ?? PAINT_SWATCHES[0];
  const wheel: WheelStyleConfig =
    WHEEL_STYLES.find((ws) => ws.id === wheelId) ?? WHEEL_STYLES[0];
  const tire = getClimbTireById(climbTireId);

  // Studio cyclorama backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0f1726');
  bg.addColorStop(0.65, '#192334');
  bg.addColorStop(1, '#090e17');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle rim studio spotlight
  const spot = ctx.createRadialGradient(w * 0.52, h * 0.42, 18, w * 0.52, h * 0.42, 220);
  spot.addColorStop(0, 'rgba(255,255,255,0.12)');
  spot.addColorStop(0.55, 'rgba(56,189,248,0.04)');
  spot.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);

  // Studio floor horizon & turntable disc hint
  const groundY = 196;
  ctx.strokeStyle = 'rgba(148,163,184,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, groundY + 10, 178, 18, 0, 0, Math.PI * 2);
  ctx.stroke();

  const floorGrad = ctx.createRadialGradient(w * 0.5, groundY + 10, 12, w * 0.5, groundY + 10, 180);
  floorGrad.addColorStop(0, 'rgba(51,65,85,0.55)');
  floorGrad.addColorStop(1, 'rgba(15,23,42,0.08)');
  ctx.fillStyle = floorGrad;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, groundY + 10, 178, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Scale factor from meter units to canvas px
  const scale = 64;
  const cx = w * 0.5;
  const rearWheelX = cx - vehicle.wheelbase * 0.5 * scale;
  const frontWheelX = cx + vehicle.wheelbase * 0.5 * scale;
  const rRear = vehicle.wheelRadius * vehicle.rearWheelScale * scale;
  const rFront = vehicle.wheelRadius * vehicle.frontWheelScale * scale;
  const rearY = groundY - rRear;
  const frontY = groundY - rFront;
  const chassisBottomY = groundY - (vehicle.wheelRadius + vehicle.suspensionRest * 0.65) * scale;

  // Ground contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 3, vehicle.chassisLength * 32, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Visible coilover struts behind wheels
  const drawStrut = (wx: number, wy: number) => {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx, chassisBottomY + 6);
    ctx.stroke();
    ctx.strokeStyle = paint.accent;
    ctx.lineWidth = 8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(wx, wy - 6);
    ctx.lineTo(wx, chassisBottomY + 12);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawStrut(rearWheelX, rearY);
  drawStrut(frontWheelX, frontY);

  // Body paint gradient
  const bodyGrad = ctx.createLinearGradient(cx, chassisBottomY - 65, cx, chassisBottomY + 15);
  bodyGrad.addColorStop(0, paint.accent);
  bodyGrad.addColorStop(0.28, paint.primary);
  bodyGrad.addColorStop(1, paint.secondary);

  ctx.save();
  ctx.translate(cx, chassisBottomY);

  // Draw distinct silhouette per vehicle
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (vehicle.id === 'ranger') {
    ctx.moveTo(-112, 10);
    ctx.lineTo(116, 10);
    ctx.lineTo(120, -24);
    ctx.lineTo(68, -32);
    ctx.lineTo(48, -56);
    ctx.lineTo(-42, -56);
    ctx.lineTo(-56, -30);
    ctx.lineTo(-114, -30);
    ctx.closePath();
  } else if (vehicle.id === 'monster') {
    ctx.moveTo(-124, 12);
    ctx.lineTo(126, 12);
    ctx.lineTo(130, -32);
    ctx.lineTo(72, -38);
    ctx.lineTo(48, -70);
    ctx.lineTo(-32, -70);
    ctx.lineTo(-44, -36);
    ctx.lineTo(-124, -36);
    ctx.closePath();
  } else if (vehicle.id === 'buggy') {
    ctx.moveTo(-100, 8);
    ctx.lineTo(106, 8);
    ctx.lineTo(110, -12);
    ctx.lineTo(48, -26);
    ctx.lineTo(-74, -24);
    ctx.lineTo(-104, -10);
    ctx.closePath();
  } else if (vehicle.id === 'muscle' || vehicle.id === 'donk_leonida') {
    const roofH = vehicle.id === 'donk_leonida' ? -64 : -58;
    ctx.moveTo(-128, 10);
    ctx.lineTo(130, 10);
    ctx.lineTo(134, -22);
    ctx.lineTo(62, -28);
    ctx.lineTo(30, roofH);
    ctx.lineTo(-52, roofH);
    ctx.lineTo(-114, -28);
    ctx.lineTo(-130, -24);
    ctx.closePath();
  } else if (vehicle.id === 'cheetah_vc') {
    ctx.moveTo(-126, 10);
    ctx.lineTo(130, 10);
    ctx.lineTo(136, -10);
    ctx.lineTo(74, -22);
    ctx.lineTo(28, -48);
    ctx.lineTo(-36, -48);
    ctx.lineTo(-98, -26);
    ctx.lineTo(-128, -22);
    ctx.closePath();
  } else {
    // Superbike fairing
    ctx.moveTo(-74, -2);
    ctx.lineTo(66, -4);
    ctx.lineTo(78, -32);
    ctx.lineTo(34, -46);
    ctx.lineTo(-6, -38);
    ctx.lineTo(-44, -26);
    ctx.lineTo(-82, -44);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  // Roll cage / cabin glass accent
  if (vehicle.hasRollCage) {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-54, -24);
    ctx.lineTo(-34, -62);
    ctx.lineTo(24, -62);
    ctx.lineTo(48, -26);
    ctx.stroke();
  } else if (vehicle.id !== 'superbike') {
    ctx.fillStyle = 'rgba(186,230,253,0.42)';
    ctx.beginPath();
    ctx.moveTo(-48, -30);
    ctx.lineTo(-28, -54);
    ctx.lineTo(24, -54);
    ctx.lineTo(54, -28);
    ctx.closePath();
    ctx.fill();
  }

  // Livery accent stripe
  if (liveryId !== 'clean') {
    ctx.fillStyle =
      liveryId === 'vice_stripes'
        ? '#22d3ee'
        : liveryId === 'sunset_rally'
          ? '#fbbf24'
          : liveryId === 'carbon_hood'
            ? '#111827'
            : '#f8fafc';
    ctx.fillRect(-94, -14, 188, 6);
  }

  // Headlight & brake light
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(vehicle.id === 'superbike' ? 68 : 114, -20, 10, 7);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(vehicle.id === 'superbike' ? -76 : -122, -20, 8, 7);

  ctx.restore();

  // Draw high-detail wheels & climb tire lugs
  const drawWheel = (wx: number, wy: number, r: number) => {
    // Knobby tire lugs matching selected Climb Tire compound
    const lugCount = tire.id === 'mud_bogger' ? 14 : tire.id === 'ice_studded' ? 20 : 16;
    const lugLen = tire.id === 'mud_bogger' ? 6.5 : tire.id === 'rock_crawler' ? 5.5 : 4;
    ctx.fillStyle = tire.id === 'ice_studded' ? '#38bdf8' : '#0f172a';
    for (let i = 0; i < lugCount; i++) {
      const a = (i / lugCount) * Math.PI * 2;
      const lx = wx + Math.cos(a) * (r + lugLen * 0.3);
      const ly = wy + Math.sin(a) * (r + lugLen * 0.3);
      ctx.beginPath();
      ctx.arc(lx, ly, tire.id === 'ice_studded' ? 2.1 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tire carcass
    ctx.fillStyle = '#14171f';
    ctx.beginPath();
    ctx.arc(wx, wy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rim + tire compound ring accent
    const rimR = r * 0.56;
    ctx.fillStyle = '#0f131b';
    ctx.beginPath();
    ctx.arc(wx, wy, rimR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = wheel.rimColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wx, wy, rimR * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes
    ctx.strokeStyle = wheel.rimColor;
    ctx.lineWidth = 2.6;
    for (let s = 0; s < wheel.spokeCount; s++) {
      const a = (s / wheel.spokeCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(a) * rimR * 0.88, wy + Math.sin(a) * rimR * 0.88);
      ctx.stroke();
    }

    // Center hub cap colored by Climb Tire compound
    ctx.fillStyle = tire.rimAccent;
    ctx.beginPath();
    ctx.arc(wx, wy, rimR * 0.25, 0, Math.PI * 2);
    ctx.fill();
  };

  drawWheel(rearWheelX, rearY, rRear);
  drawWheel(frontWheelX, frontY, rFront);

  const url = canvas.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}
