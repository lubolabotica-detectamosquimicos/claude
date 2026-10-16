import React from 'react';

export type TabId = 'escanear' | 'historial' | 'guardados' | 'perfil';

interface BottomNavProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  savedCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  savedCount,
}) => {
  const tabs: { id: TabId; label: string; icon: string; filledIcon?: string }[] = [
    { id: 'escanear', label: 'Escanear', icon: 'barcode_scanner' },
    { id: 'historial', label: 'Historial', icon: 'history' },
    { id: 'guardados', label: 'Guardados', icon: 'bookmark_border', filledIcon: 'bookmark' },
    { id: 'perfil', label: 'Perfil', icon: 'person' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-[#f9f9f9]/95 dark:bg-[#151908]/95 backdrop-blur-xl border-t border-[#341011]/5 dark:border-white/10 shadow-[0_-4px_20px_rgba(52,16,17,0.08)]"
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const iconName = isActive && tab.filledIcon ? tab.filledIcon : tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[70px] min-h-[48px] px-3 py-1 rounded-full transition-all duration-200 select-none cursor-pointer ${
                isActive
                  ? 'text-[#341011] bg-[#cce510] font-bold shadow-sm scale-102 ring-1 ring-[#341011]/10'
                  : 'text-[#464833] dark:text-white/70 hover:text-[#1a1c1c] dark:hover:text-white active:scale-95'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className={`material-symbols-outlined text-[23px] transition-transform ${
                  isActive ? 'scale-110 font-bold' : ''
                }`}
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1, 'wght' 700" }
                    : { fontVariationSettings: "'FILL' 0, 'wght' 500" }
                }
              >
                {iconName}
              </span>
              <span className="text-[10px] tracking-tight leading-none font-semibold">
                {tab.label}
              </span>
              {tab.id === 'guardados' && savedCount !== undefined && savedCount > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#2A8743] ring-1 ring-white" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
