import React from 'react';
import { UpgradeKey, VehicleId } from '../types/game';

export const CoinIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <defs>
      <radialGradient id="hcrCoinG" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="55%" stopColor="#facc15" />
        <stop offset="100%" stopColor="#b45309" />
      </radialGradient>
    </defs>
    <circle cx="16" cy="16" r="14" fill="url(#hcrCoinG)" stroke="#fef9c3" strokeWidth="2" />
    <circle cx="16" cy="16" r="10.2" fill="none" stroke="#92400e" strokeWidth="1.4" strokeOpacity="0.45" />
    <path d="M16 9.5v13M12.5 13.2c0-1.5 1.6-2.4 3.5-2.4s3.5.9 3.5 2.4c0 2.9-7 1.7-7 4.9 0 1.6 1.6 2.6 3.5 2.6s3.5-.9 3.5-2.4" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </svg>
);

export const GemIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="hcrGemG" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#bae6fd" />
        <stop offset="50%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
    </defs>
    <polygon points="8,5 24,5 29,12 16,28 3,12" fill="url(#hcrGemG)" stroke="#e0f2fe" strokeWidth="1.6" strokeLinejoin="round" />
    <polyline points="3,12 29,12" stroke="#e0f2fe" strokeWidth="1.2" strokeOpacity="0.7" fill="none" />
    <polyline points="8,5 12,12 16,28 20,12 24,5" stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.55" fill="none" />
  </svg>
);

export const FuelCanIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path d="M8 9a2 2 0 0 1 2-2h7l5 5v15a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V9z" fill="#dc2626" stroke="#fecaca" strokeWidth="1.5" />
    <path d="M11 7V4.5h5V7" fill="none" stroke="#facc15" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M21 7l4-3 2 2-3.5 3.5" fill="#facc15" />
    <path d="M12.5 14.5l7 7M19.5 14.5l-7 7" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.85" />
  </svg>
);

export const DriverAvatarIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <rect width="40" height="40" rx="8" fill="#1e293b" />
    <circle cx="20" cy="24" r="9" fill="#eab38c" />
    <path d="M11 20c0-6 4-10 9-10s9 4 9 10H11z" fill="#dc2626" />
    <path d="M19 18h14v3H19z" fill="#b91c1c" />
    <circle cx="23" cy="24" r="1.4" fill="#1e293b" />
    <path d="M16 28c1.5 1.2 4.5 1.2 6 0" stroke="#7c2d12" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M10 38c1.5-5 5.5-7 10-7s8.5 2 10 7" fill="#dc2626" />
  </svg>
);

export const UpgradePartIcon: React.FC<{ part: UpgradeKey; className?: string }> = ({
  part,
  className = 'w-11 h-11',
}) => {
  if (part === 'engine') {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <rect x="10" y="16" width="24" height="20" rx="3" fill="#3b82f6" stroke="#bfdbfe" strokeWidth="1.6" />
        <rect x="15" y="10" width="14" height="6" rx="1.5" fill="#93c5fd" />
        <path d="M34 22h6v8h-6M6 21h4v10H6" fill="#64748b" />
        <circle cx="22" cy="26" r="5" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="1.5" />
        <path d="M19 26h6M22 23v6" stroke="#facc15" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (part === 'suspension') {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <rect x="21" y="6" width="6" height="36" rx="2" fill="#cbd5e1" />
        <path d="M15 14h18l-18 6h18l-18 6h18l-18 6h18" fill="none" stroke="#f59e0b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="8" r="4" fill="#64748b" stroke="#e2e8f0" strokeWidth="1.4" />
        <circle cx="24" cy="40" r="4" fill="#64748b" stroke="#e2e8f0" strokeWidth="1.4" />
      </svg>
    );
  }
  if (part === 'tires') {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <circle cx="24" cy="24" r="17" fill="#1f2937" stroke="#22c55e" strokeWidth="2.5" strokeDasharray="5 3" />
        <circle cx="24" cy="24" r="10" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="4" fill="#1e293b" />
        <path d="M24 14v20M14 24h20M17 17l14 14M31 17L17 31" stroke="#334155" strokeWidth="1.6" />
      </svg>
    );
  }
  if (part === 'awd') {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <rect x="11" y="9" width="5" height="12" rx="2" fill="#475569" stroke="#cbd5e1" strokeWidth="1.2" />
        <rect x="32" y="9" width="5" height="12" rx="2" fill="#475569" stroke="#cbd5e1" strokeWidth="1.2" />
        <rect x="11" y="27" width="5" height="12" rx="2" fill="#475569" stroke="#cbd5e1" strokeWidth="1.2" />
        <rect x="32" y="27" width="5" height="12" rx="2" fill="#475569" stroke="#cbd5e1" strokeWidth="1.2" />
        <path d="M16 15h16M16 33h16M24 15v18" stroke="#a855f7" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="4.5" fill="#c084fc" stroke="#ffffff" strokeWidth="1.2" />
      </svg>
    );
  }
  return <FuelCanIcon className={className} />;
};

export const VehicleSilhouetteIcon: React.FC<{
  vehicleId: VehicleId;
  color?: string;
  className?: string;
}> = ({ vehicleId, color = '#d92b1e', className = 'w-20 h-11' }) => {
  if (vehicleId === 'monster') {
    return (
      <svg viewBox="0 0 96 54" className={className} aria-hidden="true">
        <path d="M14 26h18l5-11h24l7 11h14v10H14z" fill={color} stroke="#0f172a" strokeWidth="2" />
        <rect x="38" y="17" width="18" height="7" rx="1.5" fill="#7dd3fc" />
        <circle cx="26" cy="40" r="11" fill="#1e293b" stroke="#facc15" strokeWidth="2.5" />
        <circle cx="70" cy="40" r="11" fill="#1e293b" stroke="#facc15" strokeWidth="2.5" />
        <circle cx="26" cy="40" r="4.5" fill="#94a3b8" />
        <circle cx="70" cy="40" r="4.5" fill="#94a3b8" />
      </svg>
    );
  }
  if (vehicleId === 'buggy') {
    return (
      <svg viewBox="0 0 96 54" className={className} aria-hidden="true">
        <path d="M18 32l12-16h24l18 11 10 5H18z" fill="none" stroke="#94a3b8" strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M16 31h64l3 6H15z" fill={color} />
        <path d="M16 18l10-3 2 5H16z" fill="#334155" />
        <circle cx="27" cy="39" r="9.5" fill="#1e293b" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx="72" cy="40" r="8" fill="#1e293b" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx="27" cy="39" r="4" fill="#94a3b8" />
        <circle cx="72" cy="40" r="3.5" fill="#94a3b8" />
      </svg>
    );
  }
  if (vehicleId === 'muscle') {
    return (
      <svg viewBox="0 0 96 54" className={className} aria-hidden="true">
        <path d="M10 34l4-10h16l12-9h20l10 9h14l2 10H10z" fill={color} stroke="#0f172a" strokeWidth="2" />
        <rect x="65" y="21" width="7" height="4" fill="#cbd5e1" />
        <path d="M35 23l8-6h15l6 6z" fill="#7dd3fc" />
        <circle cx="27" cy="39" r="8.5" fill="#1e293b" stroke="#e2e8f0" strokeWidth="2" />
        <circle cx="71" cy="39" r="8" fill="#1e293b" stroke="#e2e8f0" strokeWidth="2" />
        <circle cx="27" cy="39" r="4" fill="#cbd5e1" />
        <circle cx="71" cy="39" r="3.8" fill="#cbd5e1" />
      </svg>
    );
  }
  if (vehicleId === 'superbike') {
    return (
      <svg viewBox="0 0 96 54" className={className} aria-hidden="true">
        <path d="M22 28l18 4 12-10h16l10 9-8 4H36z" fill={color} stroke="#0f172a" strokeWidth="1.8" />
        <path d="M58 20l10 3 6 12" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="26" cy="39" r="8.5" fill="#1e293b" stroke="#ef4444" strokeWidth="2.2" />
        <circle cx="71" cy="39" r="8.5" fill="#1e293b" stroke="#ef4444" strokeWidth="2.2" />
        <circle cx="26" cy="39" r="4" fill="#64748b" />
        <circle cx="71" cy="39" r="4" fill="#64748b" />
      </svg>
    );
  }
  if (vehicleId === 'cheetah_vc') {
    return (
      <svg viewBox="0 0 96 54" className={className} aria-hidden="true">
        <path d="M12 24h5v8H12z" fill="#0f172a" />
        <path d="M9 22h11v3H9z" fill={color} stroke="#0f172a" strokeWidth="1.2" />
        <path d="M12 36l6-9 18-3 12-7h14l14 7 12 4-2 8H12z" fill={color} stroke="#0f172a" strokeWidth="1.8" />
        <path d="M40 24l9-5h11l7 5z" fill="#67e8f9" />
        <circle cx="27" cy="38" r="8" fill="#111827" stroke="#22d3ee" strokeWidth="2" />
        <circle cx="72" cy="38" r="7.5" fill="#111827" stroke="#22d3ee" strokeWidth="2" />
        <circle cx="27" cy="38" r="4.5" fill="#e2e8f0" />
        <circle cx="72" cy="38" r="4.2" fill="#e2e8f0" />
      </svg>
    );
  }
  if (vehicleId === 'donk_leonida') {
    return (
      <svg viewBox="0 0 96 54" className={className} aria-hidden="true">
        <path d="M10 27l4-8h18l9-7h18l9 7h17l3 8H10z" fill={color} stroke="#0f172a" strokeWidth="1.8" />
        <rect x="38" y="14" width="19" height="6" rx="1" fill="#7dd3fc" />
        <rect x="10" y="25" width="76" height="2" fill="#f8fafc" />
        <circle cx="26" cy="38" r="11.5" fill="#111827" stroke="#f472b6" strokeWidth="2" />
        <circle cx="70" cy="38" r="11.5" fill="#111827" stroke="#f472b6" strokeWidth="2" />
        <circle cx="26" cy="38" r="8" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <circle cx="70" cy="38" r="8" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
      </svg>
    );
  }
  // Default: Ranger Jeep
  return (
    <svg viewBox="0 0 96 54" className={className} aria-hidden="true">
      <rect x="10" y="24" width="6" height="12" rx="1.5" fill="#1e293b" />
      <path d="M16 22h16v8h18v-8h10l18 4 4 10H16z" fill={color} stroke="#0f172a" strokeWidth="2" />
      <path d="M26 22l4-10h24l5 10" fill="none" stroke="#1e293b" strokeWidth="2.5" />
      <circle cx="29" cy="39" r="9" fill="#1e293b" stroke="#cbd5e1" strokeWidth="2" />
      <circle cx="69" cy="39" r="9" fill="#1e293b" stroke="#cbd5e1" strokeWidth="2" />
      <circle cx="29" cy="39" r="4" fill="#94a3b8" />
      <circle cx="69" cy="39" r="4" fill="#94a3b8" />
    </svg>
  );
};

export const BronzeCrateIcon: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="hcrCrateWood" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
    </defs>
    <rect x="8" y="14" width="48" height="40" rx="5" fill="url(#hcrCrateWood)" stroke="#fbbf24" strokeWidth="2.5" />
    <path d="M8 26h48M8 42h48M22 14v40M42 14v40" stroke="#451a03" strokeWidth="2.5" />
    <rect x="26" y="24" width="12" height="14" rx="2.5" fill="#1e293b" stroke="#fbbf24" strokeWidth="2" />
    <circle cx="32" cy="30" r="2.5" fill="#facc15" />
    <circle cx="14" cy="20" r="1.8" fill="#fde68a" />
    <circle cx="50" cy="20" r="1.8" fill="#fde68a" />
    <circle cx="14" cy="48" r="1.8" fill="#fde68a" />
    <circle cx="50" cy="48" r="1.8" fill="#fde68a" />
  </svg>
);

export const GoldChestIcon: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="hcrGoldChest" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="45%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#92400e" />
      </linearGradient>
    </defs>
    <path d="M10 24c0-7 6-12 22-12s22 5 22 12v6H10v-6z" fill="url(#hcrGoldChest)" stroke="#fef9c3" strokeWidth="2.2" />
    <rect x="8" y="29" width="48" height="25" rx="4" fill="#4c1d95" stroke="#fde047" strokeWidth="2.5" />
    <rect x="16" y="29" width="6" height="25" fill="url(#hcrGoldChest)" />
    <rect x="42" y="29" width="6" height="25" fill="url(#hcrGoldChest)" />
    <rect x="26" y="25" width="12" height="14" rx="3" fill="#0f172a" stroke="#fef08a" strokeWidth="2" />
    <polygon points="32,27 36,31 32,37 28,31" fill="#38bdf8" />
  </svg>
);

export const NitroBottleIcon: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="hcrNitroBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="60%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#0c4a6e" />
      </linearGradient>
    </defs>
    <rect x="26" y="6" width="12" height="7" rx="2" fill="#94a3b8" />
    <path d="M22 18c0-3 4-5 10-5s10 2 10 5v34a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V18z" fill="url(#hcrNitroBody)" stroke="#bae6fd" strokeWidth="2" />
    <rect x="22" y="34" width="20" height="7" fill="#0f172a" fillOpacity="0.45" />
    <path d="M33 21l-5 9h5l-2 9 7-11h-5l2-7z" fill="#fef08a" />
  </svg>
);

export const MagnetBoostIcon: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <path d="M18 14v18a14 14 0 0 0 28 0V14h-9v18a5 5 0 0 1-10 0V14h-9z" fill="#ef4444" stroke="#fecaca" strokeWidth="2" strokeLinejoin="round" />
    <rect x="18" y="12" width="9" height="8" rx="1" fill="#cbd5e1" />
    <rect x="37" y="12" width="9" height="8" rx="1" fill="#cbd5e1" />
    <path d="M28 52c3 2 5 2 8 0M24 56c5 3 11 3 16 0" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </svg>
);

export const RankShieldIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M12 2l8 3.5V11c0 5.2-3.4 9.7-8 11-4.6-1.3-8-5.8-8-11V5.5L12 2z" fill="#1e293b" stroke="#ffc52e" strokeWidth="1.8" />
    <path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L12 14.7l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#ffc52e" />
  </svg>
);

