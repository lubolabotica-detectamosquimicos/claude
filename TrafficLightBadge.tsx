import React from 'react';
import { ScanStatus } from '../types';
import { ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';

interface Props {
  status: ScanStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  /** Para usarla sobre fondos oscuros (p. ej. el escáner): textos claros. */
  onDark?: boolean;
}

/** Insignia del semáforo LuBo. Colores oficiales: verde #2A8743 · amarillo #EBB414 · rojo #ba1a1a. */
export const TrafficLightBadge: React.FC<Props> = ({ status, size = 'md', showLabel = true, onDark = false }) => {
  const configs: Record<ScanStatus, {
    bg: string;
    dot: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = {
    green: {
      bg: 'bg-[#2A8743]/12 text-[#1d6130] border-[#2A8743]/40 dark:bg-[#2A8743]/25 dark:text-[#a1e687] dark:border-[#2A8743]/60',
      dot: 'bg-[#2A8743]',
      label: 'Seguro / Apto',
      icon: ShieldCheck,
    },
    yellow: {
      bg: 'bg-[#EBB414]/20 text-[#6b5000] border-[#EBB414]/60 dark:bg-[#EBB414]/20 dark:text-[#f5d56b] dark:border-[#EBB414]/50',
      dot: 'bg-[#EBB414]',
      label: 'Precaución',
      icon: AlertTriangle,
    },
    red: {
      bg: 'bg-[#ba1a1a]/10 text-[#93000a] border-[#ba1a1a]/40 dark:bg-[#ba1a1a]/25 dark:text-[#ffb4ab] dark:border-[#ba1a1a]/60',
      dot: 'bg-[#ba1a1a] animate-pulse',
      label: 'Evitar / Tóxico',
      icon: AlertOctagon,
    },
    unknown: {
      bg: 'bg-[#341011]/8 text-[#341011] border-[#341011]/25 dark:bg-white/10 dark:text-white dark:border-white/20',
      dot: 'bg-[#341011]/40 dark:bg-white/50',
      label: 'Sin datos',
      icon: HelpCircle,
    },
  };

  const darkText: Record<ScanStatus, string> = {
    green: 'bg-[#2A8743]/30 text-[#a1e687] border-[#2A8743]/70',
    yellow: 'bg-[#EBB414]/25 text-[#f5d56b] border-[#EBB414]/60',
    red: 'bg-[#ba1a1a]/35 text-[#ffb4ab] border-[#ba1a1a]/70',
    unknown: 'bg-white/10 text-white border-white/25',
  };
  const conf = { ...(configs[status] || configs.unknown) };
  if (onDark) conf.bg = darkText[status] || darkText.unknown;
  const Icon = conf.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs md:text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-sm md:text-base px-3 py-1.5 gap-2',
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium border transition-all ${conf.bg} ${sizeClasses[size]}`}>
      <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
      <Icon className="w-3.5 h-3.5" />
      {showLabel && <span>{conf.label}</span>}
    </span>
  );
};
