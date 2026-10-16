import React from 'react';
import { LUBO_LOGO_URL } from '../data/mockData';

interface HeaderProps {
  onOpenInicioModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenInicioModal }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-[#cce510] dark:bg-[#1a220a] shadow-[0_2px_8px_rgba(52,16,17,0.06)] border-b border-[#341011]/10 dark:border-white/10 transition-colors">
      <div className="h-16 px-4 max-w-md mx-auto w-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo Badge */}
          <div className="flex items-center justify-center w-11 h-11 rounded-full p-1.5 overflow-hidden shrink-0 bg-white shadow-sm ring-1 ring-[#341011]/10">
            <img
              alt="Logo LuBo la botica"
              className="w-full h-full object-contain"
              src={LUBO_LOGO_URL}
            />
          </div>

          {/* Brand Identity */}
          <div className="flex flex-col flex-1 min-w-0">
            <span
              className="font-brand text-[20px] font-bold text-[#341011] dark:text-[#cce510] leading-tight tracking-tight select-none"
              style={{ letterSpacing: '-0.01em' }}
            >
              LuBo la botica
            </span>
            <div className="flex items-center w-full">
              <span className="text-[11px] text-[#341011] dark:text-white/80 uppercase tracking-wider font-extrabold truncate w-full text-left">
                Detector de químicos
              </span>
            </div>
          </div>
        </div>

        {onOpenInicioModal && (
          <button
            type="button"
            onClick={onOpenInicioModal}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#341011] hover:bg-[#4a1819] text-[#cce510] text-[11px] font-extrabold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            title="Ver Planes y Aporte Voluntario"
          >
            <span className="material-symbols-outlined text-[14px]">tune</span>
            <span>Planes</span>
          </button>
        )}
      </div>
    </header>
  );
};
