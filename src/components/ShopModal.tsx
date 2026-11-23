import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Box,
  Flame,
  Magnet,
  PackageOpen,
  Sparkles,
  Tag,
} from 'lucide-react';
import { MAX_TICKETS } from '../game/constants';
import { getFreeGemsRemainingMs } from '../game/storage';
import { SaveData } from '../types/game';
import { CoinIcon, FuelCanIcon, GemIcon } from './GameIcons';

export type ShopActionResult = {
  title: string;
  detail: string;
};

interface ShopModalProps {
  save: SaveData;
  onClose: () => void;
  onClaimFreeGems: () => ShopActionResult | null;
  onExchangeGemsForCoins: (gemCost: number, coinGain: number) => boolean;
  onBuyStarterPack: () => ShopActionResult | null;
  onBuyBooster: (
    kind: 'fuelSaver' | 'nitroCharge' | 'coinMagnet',
    coinCost: number,
  ) => boolean;
  onRefillTickets: (coinCost: number) => boolean;
  onOpenChest: (tier: 'bronze' | 'gold') => ShopActionResult | null;
}

type ShopTab = 'OFFERS' | 'CURRENCY' | 'BOOSTS' | 'CHESTS';

export const ShopModal: React.FC<ShopModalProps> = ({
  save,
  onClose,
  onClaimFreeGems,
  onExchangeGemsForCoins,
  onBuyStarterPack,
  onBuyBooster,
  onRefillTickets,
  onOpenChest,
}) => {
  const [tab, setTab] = useState<ShopTab>('OFFERS');
  const [now, setNow] = useState(() => Date.now());
  const [lootBanner, setLootBanner] = useState<ShopActionResult | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const freeRemainMs = getFreeGemsRemainingMs(save, now);
  const freeReady = freeRemainMs <= 0;
  const freeRemainSec = Math.ceil(freeRemainMs / 1000);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-slate-950 p-4 text-white sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-slate-900 text-white transition hover:border-amber-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-black tracking-wider uppercase sm:text-3xl">
              SHOP
            </h1>
            <p className="text-xs font-semibold tracking-widest text-amber-300 uppercase">
              SUPPLY DEPOT · BOOSTERS & MYSTERY CHESTS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5">
            <CoinIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.coins.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5">
            <GemIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.gems.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Optional Reward/Purchase Banner */}
      {lootBanner && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-400/50 bg-emerald-950/60 px-4 py-2.5">
          <div>
            <div className="font-display text-sm font-black tracking-wider text-emerald-300 uppercase">
              {lootBanner.title}
            </div>
            <div className="text-xs text-slate-200">{lootBanner.detail}</div>
          </div>
          <button
            type="button"
            onClick={() => setLootBanner(null)}
            className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-200 hover:text-white"
          >
            OK
          </button>
        </div>
      )}

      {/* Main Store Shelf */}
      <div className="frontier-scroll my-4 flex-1 overflow-y-auto">
        {tab === 'OFFERS' && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Free Cooldown Gems */}
            <div className="flex flex-col justify-between rounded-2xl border border-sky-400/50 bg-slate-900 p-4 shadow-xl">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-sky-300 uppercase">
                    FREE SUPPLY
                  </span>
                  <Sparkles className="h-4 w-4 text-sky-300" />
                </div>
                <div className="my-4 flex justify-center">
                  <GemIcon className="h-16 w-16" />
                </div>
                <h2 className="text-center font-display text-lg font-black text-white uppercase">
                  +15 FREE GEMS
                </h2>
                <p className="mt-1 text-center text-xs text-slate-400">
                  Claim bonus Gems every 2 minutes to unlock chests and coin packs.
                </p>
              </div>
              <button
                type="button"
                disabled={!freeReady}
                onClick={() => {
                  const res = onClaimFreeGems();
                  if (res) setLootBanner(res);
                }}
                className={`mt-4 w-full rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase transition ${
                  freeReady
                    ? 'bg-gradient-to-b from-sky-300 to-blue-500 text-slate-950 hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800 text-slate-400'
                }`}
              >
                {freeReady ? 'CLAIM FREE' : `WAIT ${freeRemainSec}s`}
              </button>
            </div>

            {/* Starter Supply Bundle */}
            <div className="flex flex-col justify-between rounded-2xl border border-amber-400/60 bg-slate-900 p-4 shadow-xl">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-amber-300 uppercase">
                    2X VALUE PACK
                  </span>
                  <Tag className="h-4 w-4 text-amber-300" />
                </div>
                <div className="my-4 flex items-center justify-center gap-2">
                  <CoinIcon className="h-12 w-12" />
                  <FuelCanIcon className="h-12 w-12" />
                </div>
                <h2 className="text-center font-display text-lg font-black text-white uppercase">
                  FRONTIER BUNDLE
                </h2>
                <p className="mt-1 text-center text-xs text-slate-300">
                  +4,500 Coins & 1x of every Boost (Fuel Saver, Nitro, Magnet)
                </p>
              </div>
              <button
                type="button"
                disabled={save.gems < 25}
                onClick={() => {
                  const res = onBuyStarterPack();
                  if (res) setLootBanner(res);
                }}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase transition ${
                  save.gems >= 25
                    ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
                }`}
              >
                <GemIcon className="h-4 w-4" />
                25 GEMS
              </button>
            </div>

            {/* Fuel Ticket Refill */}
            <div className="flex flex-col justify-between rounded-2xl border border-red-400/45 bg-slate-900 p-4 shadow-xl">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-red-300 uppercase">
                    TICKETS {save.tickets}/{MAX_TICKETS}
                  </span>
                </div>
                <div className="my-4 flex justify-center">
                  <FuelCanIcon className="h-16 w-16" />
                </div>
                <h2 className="text-center font-display text-lg font-black text-white uppercase">
                  FULL TICKET TANK
                </h2>
                <p className="mt-1 text-center text-xs text-slate-400">
                  Refills Adventure fuel tickets back to {MAX_TICKETS}/{MAX_TICKETS} immediately.
                </p>
              </div>
              <button
                type="button"
                disabled={save.tickets >= MAX_TICKETS || save.coins < 350}
                onClick={() => {
                  if (onRefillTickets(350)) {
                    setLootBanner({
                      title: 'TICKETS REFILLED',
                      detail: `Adventure fuel tickets restored to ${MAX_TICKETS}/${MAX_TICKETS}.`,
                    });
                  }
                }}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase transition ${
                  save.tickets >= MAX_TICKETS
                    ? 'bg-emerald-900/40 text-emerald-300'
                    : save.coins >= 350
                      ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 hover:brightness-105'
                      : 'cursor-not-allowed bg-slate-800 text-slate-500'
                }`}
              >
                {save.tickets >= MAX_TICKETS ? (
                  'TANK FULL'
                ) : (
                  <>
                    <CoinIcon className="h-4 w-4" />
                    350 COINS
                  </>
                )}
              </button>
            </div>

            {/* Featured Mystery Chest */}
            <div className="flex flex-col justify-between rounded-2xl border border-violet-400/50 bg-slate-900 p-4 shadow-xl">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-violet-300 uppercase">
                    MYSTERY LOOT
                  </span>
                  <PackageOpen className="h-4 w-4 text-violet-300" />
                </div>
                <div className="my-4 flex justify-center">
                  <Box className="h-16 w-16 text-amber-400" />
                </div>
                <h2 className="text-center font-display text-lg font-black text-white uppercase">
                  GOLD CHEST
                </h2>
                <p className="mt-1 text-center text-xs text-slate-400">
                  Contains 2,500–5,500 Coins plus bonus Run Boosters!
                </p>
              </div>
              <button
                type="button"
                disabled={save.gems < 30}
                onClick={() => {
                  const res = onOpenChest('gold');
                  if (res) setLootBanner(res);
                }}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase transition ${
                  save.gems >= 30
                    ? 'bg-gradient-to-b from-violet-400 to-fuchsia-600 text-white hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
                }`}
              >
                <GemIcon className="h-4 w-4" />
                30 GEMS
              </button>
            </div>
          </div>
        )}

        {tab === 'CURRENCY' && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {[
              { title: 'COINS STASH', coins: 2500, gems: 10 },
              { title: 'PROSPECTOR BAG', coins: 7500, gems: 25 },
              { title: 'FRONTIER VAULT', coins: 20000, gems: 60 },
            ].map((pack) => (
              <div
                key={pack.title}
                className="flex flex-col justify-between rounded-2xl border border-amber-400/40 bg-slate-900 p-5 shadow-xl"
              >
                <div className="text-center">
                  <div className="my-3 flex justify-center">
                    <CoinIcon className="h-16 w-16" />
                  </div>
                  <h2 className="font-display text-xl font-black text-white uppercase">
                    {pack.coins.toLocaleString()} COINS
                  </h2>
                  <p className="mt-1 text-xs font-bold tracking-widest text-amber-300 uppercase">
                    {pack.title}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={save.gems < pack.gems}
                  onClick={() => {
                    if (onExchangeGemsForCoins(pack.gems, pack.coins)) {
                      setLootBanner({
                        title: 'COINS ADDED',
                        detail: `Exchanged ${pack.gems} Gems for +${pack.coins.toLocaleString()} Coins!`,
                      });
                    }
                  }}
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase ${
                    save.gems >= pack.gems
                      ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 hover:brightness-105'
                      : 'cursor-not-allowed bg-slate-800 text-slate-500'
                  }`}
                >
                  <GemIcon className="h-4 w-4" />
                  {pack.gems} GEMS
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'BOOSTS' && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {[
              {
                key: 'fuelSaver' as const,
                name: 'FUEL SAVER',
                desc: 'Cuts fuel burn rate by 48% on your next run.',
                cost: 450,
                owned: save.boosters.fuelSaver,
                icon: <FuelCanIcon className="h-14 w-14" />,
              },
              {
                key: 'nitroCharge' as const,
                name: 'NITRO CHARGE',
                desc: 'Boosts Nitro thrust power +37% and faster boost recharge.',
                cost: 550,
                owned: save.boosters.nitroCharge,
                icon: <Flame className="h-14 w-14 text-sky-400" />,
              },
              {
                key: 'coinMagnet' as const,
                name: 'COIN MAGNET',
                desc: 'Expands coin pickup radius across steep jumps & ridges.',
                cost: 500,
                owned: save.boosters.coinMagnet,
                icon: <Magnet className="h-14 w-14 text-amber-300" />,
              },
            ].map((b) => (
              <div
                key={b.key}
                className="flex flex-col justify-between rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-xl"
              >
                <div className="text-center">
                  <span className="rounded bg-emerald-500/20 px-2.5 py-0.5 font-mono-num text-xs font-bold text-emerald-300">
                    OWNED: {b.owned}
                  </span>
                  <div className="my-4 flex justify-center">{b.icon}</div>
                  <h2 className="font-display text-lg font-black uppercase">
                    {b.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">{b.desc}</p>
                </div>
                <button
                  type="button"
                  disabled={save.coins < b.cost}
                  onClick={() => {
                    if (onBuyBooster(b.key, b.cost)) {
                      setLootBanner({
                        title: `${b.name} ARMED`,
                        detail: 'Automatically activates on your next race.',
                      });
                    }
                  }}
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase ${
                    save.coins >= b.cost
                      ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 hover:brightness-105'
                      : 'cursor-not-allowed bg-slate-800 text-slate-500'
                  }`}
                >
                  <CoinIcon className="h-4 w-4" />
                  {b.cost} COINS
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'CHESTS' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col justify-between rounded-2xl border border-orange-400/40 bg-slate-900 p-5 shadow-xl">
              <div className="text-center">
                <div className="my-4 flex justify-center">
                  <Box className="h-16 w-16 text-orange-400" />
                </div>
                <h2 className="font-display text-xl font-black uppercase">
                  BRONZE CRATE
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Awards 800–1,600 Coins and a chance at Gems or Boosts.
                </p>
              </div>
              <button
                type="button"
                disabled={save.coins < 600}
                onClick={() => {
                  const res = onOpenChest('bronze');
                  if (res) setLootBanner(res);
                }}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase ${
                  save.coins >= 600
                    ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
                }`}
              >
                <CoinIcon className="h-4 w-4" />
                600 COINS
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-violet-400/50 bg-slate-900 p-5 shadow-xl">
              <div className="text-center">
                <div className="my-4 flex justify-center">
                  <Box className="h-16 w-16 text-amber-300" />
                </div>
                <h2 className="font-display text-xl font-black uppercase">
                  GOLD CHEST
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Awards 2,500–5,500 Coins plus guaranteed Boosts!
                </p>
              </div>
              <button
                type="button"
                disabled={save.gems < 30}
                onClick={() => {
                  const res = onOpenChest('gold');
                  if (res) setLootBanner(res);
                }}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase ${
                  save.gems >= 30
                    ? 'bg-gradient-to-b from-violet-400 to-fuchsia-600 text-white hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
                }`}
              >
                <GemIcon className="h-4 w-4" />
                30 GEMS
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Category Tabs */}
      <div className="grid grid-cols-4 gap-2 border-t border-white/10 pt-3">
        {(
          [
            { id: 'OFFERS', label: 'OFFERS' },
            { id: 'CURRENCY', label: 'CURRENCY' },
            { id: 'BOOSTS', label: 'BOOSTS' },
            { id: 'CHESTS', label: 'CHESTS' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl py-3 font-display text-xs font-black tracking-wider uppercase transition sm:text-sm ${
              tab === t.id
                ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 shadow-lg'
                : 'border border-white/15 bg-slate-900 text-slate-300 hover:border-white/35 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};
