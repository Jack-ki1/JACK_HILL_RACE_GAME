import React, { useEffect, useState } from 'react';
import { ArrowLeft, PackageOpen, Sparkles, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { MAX_TICKETS } from '../game/constants';
import { getFreeGemsRemainingMs } from '../game/storage';
import { SaveData } from '../types/game';
import {
  BronzeCrateIcon,
  CoinIcon,
  FuelCanIcon,
  GemIcon,
  GoldChestIcon,
  MagnetBoostIcon,
  NitroBottleIcon,
} from './GameIcons';

export type ShopActionResult = {
  title: string;
  detail: string;
};

interface ShopModalProps {
  save: SaveData;
  onClose: () => void;
  onClaimFreeGems: () => ShopActionResult | null;
  onExchangeGemsForCoins: (gemCost: number, coinGain: number) => boolean;
  onExchangeCoinsForGems: (coinCost: number, gemGain: number) => boolean;
  onBuyStarterPack: () => ShopActionResult | null;
  onBuyBooster: (
    kind: 'fuelSaver' | 'nitroCharge' | 'coinMagnet',
    coinCost: number,
  ) => boolean;
  onRefillTickets: (coinCost: number) => boolean;
  onOpenChest: (tier: 'bronze' | 'gold') => ShopActionResult | null;
}

type ShopTab = 'OFFERS' | 'CURRENCY' | 'BOOSTS' | 'CHESTS' | 'GEMS';

export const ShopModal: React.FC<ShopModalProps> = ({
  save,
  onClose,
  onClaimFreeGems,
  onExchangeGemsForCoins,
  onExchangeCoinsForGems,
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
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-[#080d13] p-4 text-white sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="panel-bevel flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white transition hover:border-amber-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-wider uppercase italic sm:text-3xl">
              SUPPLY DEPOT
            </h1>
            <p className="text-xs font-bold tracking-widest text-amber-300 uppercase">
              BOOSTERS · CRATES · IN-GAME CURRENCY EXCHANGE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="panel-bevel flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5">
            <CoinIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.coins.toLocaleString()}
            </span>
          </div>
          <div className="panel-bevel flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5">
            <GemIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.gems.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Reward / Purchase Feedback Banner */}
      {lootBanner && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mt-3 flex items-center justify-between rounded-xl border border-emerald-400/55 bg-emerald-950/75 px-4 py-2.5 shadow-lg"
        >
          <div>
            <div className="font-display text-base font-extrabold tracking-wider text-emerald-300 uppercase italic">
              {lootBanner.title}
            </div>
            <div className="text-xs text-slate-200">{lootBanner.detail}</div>
          </div>
          <button
            type="button"
            onClick={() => setLootBanner(null)}
            className="rounded-lg border border-white/15 bg-[#111923] px-3 py-1 text-xs font-bold text-slate-200 hover:text-white"
          >
            OK
          </button>
        </motion.div>
      )}

      {/* Main Store Shelf */}
      <div className="frontier-scroll my-4 flex-1 overflow-y-auto pr-0.5">
        {tab === 'OFFERS' && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Free Cooldown Gems */}
            <div className="panel-bevel flex flex-col justify-between rounded-2xl border border-sky-400/45 p-4">
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
                <h2 className="text-center font-display text-xl font-extrabold text-white uppercase italic">
                  +15 FREE GEMS
                </h2>
                <p className="mt-1 text-center text-xs text-slate-400">
                  Claim supply gems every 2 minutes to unlock chests and coin stashes.
                </p>
              </div>
              <button
                type="button"
                disabled={!freeReady}
                onClick={() => {
                  const res = onClaimFreeGems();
                  if (res) setLootBanner(res);
                }}
                className={`mt-4 w-full rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic transition ${
                  freeReady
                    ? 'bg-gradient-to-b from-sky-300 to-blue-500 text-slate-950 hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800/80 text-slate-400'
                }`}
              >
                {freeReady ? 'CLAIM FREE' : `WAIT ${freeRemainSec}s`}
              </button>
            </div>

            {/* Starter Supply Bundle */}
            <div className="panel-bevel flex flex-col justify-between rounded-2xl border border-amber-400/55 p-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-amber-300 uppercase">
                    2X VALUE PACK
                  </span>
                  <Tag className="h-4 w-4 text-amber-300" />
                </div>
                <div className="my-4 flex items-center justify-center gap-2">
                  <CoinIcon className="h-12 w-12" />
                  <NitroBottleIcon className="h-12 w-12" />
                </div>
                <h2 className="text-center font-display text-xl font-extrabold text-white uppercase italic">
                  LEONIDA BUNDLE
                </h2>
                <p className="mt-1 text-center text-xs text-slate-300">
                  +4,500 Coins & 1x each Boost (Fuel Saver, Nitro, Magnet)
                </p>
              </div>
              <button
                type="button"
                disabled={save.gems < 25}
                onClick={() => {
                  const res = onBuyStarterPack();
                  if (res) setLootBanner(res);
                }}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic transition ${
                  save.gems >= 25
                    ? 'bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] text-slate-950 hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800/80 text-slate-500'
                }`}
              >
                <GemIcon className="h-4 w-4" />
                25 GEMS
              </button>
            </div>

            {/* Fuel Ticket Refill */}
            <div className="panel-bevel flex flex-col justify-between rounded-2xl border border-red-400/45 p-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-red-300 uppercase">
                    TICKETS {save.tickets}/{MAX_TICKETS}
                  </span>
                </div>
                <div className="my-4 flex justify-center">
                  <FuelCanIcon className="h-16 w-16" />
                </div>
                <h2 className="text-center font-display text-xl font-extrabold text-white uppercase italic">
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
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic transition ${
                  save.tickets >= MAX_TICKETS
                    ? 'bg-emerald-900/40 text-emerald-300'
                    : save.coins >= 350
                      ? 'bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] text-slate-950 hover:brightness-105'
                      : 'cursor-not-allowed bg-slate-800/80 text-slate-500'
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

            {/* Featured Gold Chest */}
            <div className="panel-bevel flex flex-col justify-between rounded-2xl border border-violet-400/50 p-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-violet-300 uppercase">
                    MYSTERY LOOT
                  </span>
                  <PackageOpen className="h-4 w-4 text-violet-300" />
                </div>
                <div className="my-4 flex justify-center">
                  <GoldChestIcon className="h-16 w-16" />
                </div>
                <h2 className="text-center font-display text-xl font-extrabold text-white uppercase italic">
                  GOLD CHEST
                </h2>
                <p className="mt-1 text-center text-xs text-slate-400">
                  Contains 2,500–5,500 Coins plus +1x of all 3 Boosters!
                </p>
              </div>
              <button
                type="button"
                disabled={save.gems < 30}
                onClick={() => {
                  const res = onOpenChest('gold');
                  if (res) setLootBanner(res);
                }}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic transition ${
                  save.gems >= 30
                    ? 'bg-gradient-to-b from-violet-400 to-fuchsia-600 text-white hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800/80 text-slate-500'
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
              { title: 'JACK HILL CRAWL VAULT', coins: 20000, gems: 60 },
            ].map((pack) => (
              <div
                key={pack.title}
                className="panel-bevel flex flex-col justify-between rounded-2xl border border-amber-400/40 p-5"
              >
                <div className="text-center">
                  <div className="my-3 flex justify-center">
                    <CoinIcon className="h-16 w-16" />
                  </div>
                  <h2 className="font-display text-2xl font-extrabold text-white uppercase italic">
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
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic ${
                    save.gems >= pack.gems
                      ? 'bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] text-slate-950 hover:brightness-105'
                      : 'cursor-not-allowed bg-slate-800/80 text-slate-500'
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
                icon: <NitroBottleIcon className="h-14 w-14" />,
              },
              {
                key: 'coinMagnet' as const,
                name: 'COIN MAGNET',
                desc: 'Expands coin pickup radius across steep jumps & ridges.',
                cost: 500,
                owned: save.boosters.coinMagnet,
                icon: <MagnetBoostIcon className="h-14 w-14" />,
              },
            ].map((b) => (
              <div
                key={b.key}
                className="panel-bevel flex flex-col justify-between rounded-2xl border border-white/15 p-5"
              >
                <div className="text-center">
                  <span className="rounded bg-emerald-500/20 px-2.5 py-0.5 font-mono-num text-xs font-bold text-emerald-300">
                    OWNED: {b.owned}
                  </span>
                  <div className="my-4 flex justify-center">{b.icon}</div>
                  <h2 className="font-display text-xl font-extrabold uppercase italic">
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
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic ${
                    save.coins >= b.cost
                      ? 'bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] text-slate-950 hover:brightness-105'
                      : 'cursor-not-allowed bg-slate-800/80 text-slate-500'
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
            <div className="panel-bevel flex flex-col justify-between rounded-2xl border border-orange-400/45 p-5">
              <div className="text-center">
                <div className="my-4 flex justify-center">
                  <BronzeCrateIcon className="h-16 w-16" />
                </div>
                <h2 className="font-display text-2xl font-extrabold uppercase italic">
                  BRONZE CRATE
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Awards 800–1,600 Coins plus 4–9 bonus Gems!
                </p>
              </div>
              <button
                type="button"
                disabled={save.coins < 600}
                onClick={() => {
                  const res = onOpenChest('bronze');
                  if (res) setLootBanner(res);
                }}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic ${
                  save.coins >= 600
                    ? 'bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] text-slate-950 hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800/80 text-slate-500'
                }`}
              >
                <CoinIcon className="h-4 w-4" />
                600 COINS
              </button>
            </div>

            <div className="panel-bevel flex flex-col justify-between rounded-2xl border border-violet-400/50 p-5">
              <div className="text-center">
                <div className="my-4 flex justify-center">
                  <GoldChestIcon className="h-16 w-16" />
                </div>
                <h2 className="font-display text-2xl font-extrabold uppercase italic">
                  GOLD CHEST
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Awards 2,500–5,500 Coins plus +1x of all 3 Boosters!
                </p>
              </div>
              <button
                type="button"
                disabled={save.gems < 30}
                onClick={() => {
                  const res = onOpenChest('gold');
                  if (res) setLootBanner(res);
                }}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic ${
                  save.gems >= 30
                    ? 'bg-gradient-to-b from-violet-400 to-fuchsia-600 text-white hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800/80 text-slate-500'
                }`}
              >
                <GemIcon className="h-4 w-4" />
                30 GEMS
              </button>
            </div>
          </div>
        )}

        {tab === 'GEMS' && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {/* Free Supply Card */}
            <div className="panel-bevel flex flex-col justify-between rounded-2xl border border-sky-400/50 p-5">
              <div className="text-center">
                <div className="my-3 flex justify-center">
                  <GemIcon className="h-16 w-16" />
                </div>
                <h2 className="font-display text-2xl font-extrabold text-white uppercase italic">
                  +15 FREE GEMS
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Zero-cost pit supply drop available every 2 minutes.
                </p>
              </div>
              <button
                type="button"
                disabled={!freeReady}
                onClick={() => {
                  const res = onClaimFreeGems();
                  if (res) setLootBanner(res);
                }}
                className={`mt-5 w-full rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic ${
                  freeReady
                    ? 'bg-gradient-to-b from-sky-300 to-blue-500 text-slate-950 hover:brightness-105'
                    : 'cursor-not-allowed bg-slate-800/80 text-slate-400'
                }`}
              >
                {freeReady ? 'CLAIM FREE' : `WAIT ${freeRemainSec}s`}
              </button>
            </div>

            {[
              { title: 'PROSPECTOR GEM POUCH', gems: 12, coins: 2200 },
              { title: 'LEONIDA GEM VAULT', gems: 35, coins: 5800 },
            ].map((deal) => (
              <div
                key={deal.title}
                className="panel-bevel flex flex-col justify-between rounded-2xl border border-sky-400/35 p-5"
              >
                <div className="text-center">
                  <div className="my-3 flex justify-center">
                    <GemIcon className="h-16 w-16" />
                  </div>
                  <h2 className="font-display text-2xl font-extrabold text-white uppercase italic">
                    +{deal.gems} GEMS
                  </h2>
                  <p className="mt-1 text-xs font-bold tracking-widest text-sky-300 uppercase">
                    {deal.title}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={save.coins < deal.coins}
                  onClick={() => {
                    if (onExchangeCoinsForGems(deal.coins, deal.gems)) {
                      setLootBanner({
                        title: `+${deal.gems} GEMS ACQUIRED`,
                        detail: `Exchanged ${deal.coins.toLocaleString()} Coins for +${deal.gems} Gems.`,
                      });
                    }
                  }}
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase italic ${
                    save.coins >= deal.coins
                      ? 'bg-gradient-to-b from-sky-300 to-blue-500 text-slate-950 hover:brightness-105'
                      : 'cursor-not-allowed bg-slate-800/80 text-slate-500'
                  }`}
                >
                  <CoinIcon className="h-4 w-4" />
                  {deal.coins.toLocaleString()} COINS
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom 5-Category Tabs */}
      <div className="grid grid-cols-5 gap-2 border-t border-white/10 pt-3">
        {(
          [
            { id: 'OFFERS', label: 'OFFERS' },
            { id: 'CURRENCY', label: 'CURRENCY' },
            { id: 'BOOSTS', label: 'BOOSTS' },
            { id: 'CHESTS', label: 'CHESTS' },
            { id: 'GEMS', label: 'GEMS' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl py-3 font-display text-xs font-extrabold tracking-wider uppercase italic transition sm:text-sm ${
              tab === t.id
                ? 'bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] text-slate-950 shadow-lg'
                : 'panel-bevel border border-white/15 text-slate-300 hover:border-white/35 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};
