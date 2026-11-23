import {
  createDailyChallenge,
  createDefaultSave,
  FREE_GEMS_COOLDOWN_MS,
  getLocalDateKey,
  MAX_TICKETS,
  MISSIONS,
  SEASON_TIERS,
  STAGES,
  TICKET_REGEN_MS,
} from './constants';
import { SaveData, StageId } from '../types/game';

const STORAGE_KEY = 'hcr3_frontier_save_v1';

export function regenTickets(save: SaveData, now = Date.now()): SaveData {
  if (save.tickets >= MAX_TICKETS) {
    return {
      ...save,
      tickets: MAX_TICKETS,
      ticketTimestamp: now,
    };
  }
  const elapsed = Math.max(0, now - save.ticketTimestamp);
  const gained = Math.floor(elapsed / TICKET_REGEN_MS);
  if (gained <= 0) return save;

  const nextTickets = Math.min(MAX_TICKETS, save.tickets + gained);
  const remainderMs = nextTickets >= MAX_TICKETS ? 0 : elapsed % TICKET_REGEN_MS;
  return {
    ...save,
    tickets: nextTickets,
    ticketTimestamp: now - remainderMs,
  };
}

export function refreshDailyChallenge(save: SaveData, now = Date.now()): SaveData {
  const today = getLocalDateKey(now);
  if (save.dailyChallenge && save.dailyChallenge.dateKey === today) {
    return save;
  }
  return {
    ...save,
    dailyChallenge: createDailyChallenge(now),
  };
}

export function loadSaveData(): SaveData {
  const base = createDefaultSave();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<SaveData>;

    const merged: SaveData = {
      ...base,
      ...parsed,
      unlockedVehicles: { ...base.unlockedVehicles, ...(parsed.unlockedVehicles ?? {}) },
      vehiclePaints: { ...base.vehiclePaints, ...(parsed.vehiclePaints ?? {}) },
      vehicleWheels: { ...base.vehicleWheels, ...(parsed.vehicleWheels ?? {}) },
      unlockedWheels: { ...base.unlockedWheels, ...(parsed.unlockedWheels ?? {}) },
      vehicleAccessories: {
        ranger: parsed.vehicleAccessories?.ranger ?? base.vehicleAccessories.ranger,
        monster: parsed.vehicleAccessories?.monster ?? base.vehicleAccessories.monster,
        buggy: parsed.vehicleAccessories?.buggy ?? base.vehicleAccessories.buggy,
        muscle: parsed.vehicleAccessories?.muscle ?? base.vehicleAccessories.muscle,
        superbike: parsed.vehicleAccessories?.superbike ?? base.vehicleAccessories.superbike,
        cheetah_vc: parsed.vehicleAccessories?.cheetah_vc ?? base.vehicleAccessories.cheetah_vc,
        donk_leonida: parsed.vehicleAccessories?.donk_leonida ?? base.vehicleAccessories.donk_leonida,
      },
      unlockedAccessories: {
        ...base.unlockedAccessories,
        ...(parsed.unlockedAccessories ?? {}),
      },
      vehicleNeons: {
        ...base.vehicleNeons,
        ...(parsed.vehicleNeons ?? {}),
      },
      vehicleLiveries: {
        ...base.vehicleLiveries,
        ...(parsed.vehicleLiveries ?? {}),
      },
      upgrades: {
        ranger: { ...base.upgrades.ranger, ...(parsed.upgrades?.ranger ?? {}) },
        monster: { ...base.upgrades.monster, ...(parsed.upgrades?.monster ?? {}) },
        buggy: { ...base.upgrades.buggy, ...(parsed.upgrades?.buggy ?? {}) },
        muscle: { ...base.upgrades.muscle, ...(parsed.upgrades?.muscle ?? {}) },
        superbike: { ...base.upgrades.superbike, ...(parsed.upgrades?.superbike ?? {}) },
        cheetah_vc: { ...base.upgrades.cheetah_vc, ...(parsed.upgrades?.cheetah_vc ?? {}) },
        donk_leonida: { ...base.upgrades.donk_leonida, ...(parsed.upgrades?.donk_leonida ?? {}) },
      },
      stageBests: { ...base.stageBests, ...(parsed.stageBests ?? {}) },
      stageGhosts: {
        countryside: parsed.stageGhosts?.countryside ?? [],
        red_canyon: parsed.stageGhosts?.red_canyon ?? [],
        frost_peaks: parsed.stageGhosts?.frost_peaks ?? [],
        moon: parsed.stageGhosts?.moon ?? [],
        vice_coast: parsed.stageGhosts?.vice_coast ?? [],
      },
      boosters: { ...base.boosters, ...(parsed.boosters ?? {}) },
      claimedRewards: { ...(parsed.claimedRewards ?? {}) },
      dailyChallenge:
        parsed.dailyChallenge && parsed.dailyChallenge.dateKey === getLocalDateKey()
          ? { ...createDailyChallenge(), ...parsed.dailyChallenge }
          : createDailyChallenge(),
      totals: { ...base.totals, ...(parsed.totals ?? {}) },
      tuning: { ...base.tuning, ...(parsed.tuning ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      tutorialSeen: parsed.tutorialSeen ?? base.tutorialSeen,
    };

    return refreshDailyChallenge(regenTickets(merged));
  } catch {
    return base;
  }
}

export function persistSaveData(save: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function resetSaveData(): SaveData {
  const fresh = createDefaultSave();
  persistSaveData(fresh);
  return fresh;
}

export function isStageUnlocked(stageId: StageId, save: SaveData): boolean {
  const idx = STAGES.findIndex((s) => s.id === stageId);
  if (idx <= 0) return true;
  const req = STAGES[idx].unlockPrevBestMeters;
  if (req <= 0) return true;
  const prevStage = STAGES[idx - 1];
  return (save.stageBests[prevStage.id] ?? 0) >= req;
}

export function getMissionProgress(
  metric: 'run' | 'coins' | 'flips' | 'dist',
  save: SaveData,
): number {
  if (metric === 'run') return save.totals.bestSingleRunMeters;
  if (metric === 'coins') return save.totals.coinsCollected;
  if (metric === 'flips') return save.totals.flipsCompleted;
  return save.totals.distanceMeters;
}

export function countClaimableRewards(save: SaveData): number {
  let count = 0;
  for (const m of MISSIONS) {
    if (!save.claimedRewards[m.id] && getMissionProgress(m.metric, save) >= m.target) {
      count++;
    }
  }
  for (const t of SEASON_TIERS) {
    const key = `season_tier_${t.tier}`;
    if (!save.claimedRewards[key] && save.totals.distanceMeters >= t.targetMeters) {
      count++;
    }
  }
  return count;
}

export function getFreeGemsRemainingMs(save: SaveData, now = Date.now()): number {
  if (save.freeGemsTimestamp <= 0) return 0;
  return Math.max(0, FREE_GEMS_COOLDOWN_MS - (now - save.freeGemsTimestamp));
}

export function getStageStars(stageId: StageId, bestMeters: number): number {
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage || bestMeters <= 0) return 0;
  if (bestMeters >= 1000) return 3;
  if (bestMeters >= 500) return 2;
  if (bestMeters >= 200) return 1;
  return 0;
}
