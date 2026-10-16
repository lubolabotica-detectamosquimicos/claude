import React, { useState, useMemo } from 'react';
import { HistoryEntry, Product } from '../types';

interface HistoryScreenProps {
  history: HistoryEntry[];
  onSelectProduct: (product: Product) => void;
  onReScan: (product: Product) => void;
  onToggleBookmark: (product: Product) => void;
  onClearHistory: () => void;
  onExport: () => void;
}

type FilterOption = 'all' | 'clean' | 'caution' | 'danger';

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  history,
  onSelectProduct,
  onReScan,
  onToggleBookmark,
  onClearHistory,
  onExport,
}) => {
  const [filter, setFilter] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const p = item.product;
      const matchesFilter = filter === 'all' || p.overallStatus === filter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.upc.includes(q) ||
        p.ingredients.some((ing) => ing.name.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [history, filter, searchQuery]);

  const todayItems = filteredHistory.filter((i) => i.dateGroup === 'today');
  const yesterdayItems = filteredHistory.filter((i) => i.dateGroup === 'yesterday');

  // Overall counters
  const totalCount = history.length;
  const cleanCount = history.filter((i) => i.product.overallStatus === 'clean').length;
  const cautionCount = history.filter((i) => i.product.overallStatus === 'caution').length;
  const dangerCount = history.filter((i) => i.product.overallStatus === 'danger').length;

  return (
    <div className="flex flex-col w-full max-w-md mx-auto pt-2 pb-28">
      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#341011] text-white text-[12px] font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-[#cce510]">
          <span className="material-symbols-outlined text-[16px] text-[#cce510]">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header section with telemetry */}
      <section className="px-4 pt-1 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#341011] dark:text-[#cce510] text-[26px]">
              manage_search
            </span>
            <h1 className="text-[20px] font-bold text-[#341011] dark:text-white tracking-tight">
              Historial de Análisis
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onExport();
                showToast('Reporte de análisis exportado');
              }}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-white/10 text-[#341011] dark:text-white shadow-sm hover:bg-[#f3f3f4] active:scale-95 transition-all cursor-pointer"
              title="Exportar reporte"
              aria-label="Exportar"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('¿Deseas restablecer el historial de escaneos?')) {
                  onClearHistory();
                  showToast('Historial restablecido');
                }
              }}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-white/10 text-[#341011] dark:text-white shadow-sm hover:bg-[#f3f3f4] active:scale-95 transition-all cursor-pointer"
              title="Limpiar historial"
              aria-label="Limpiar historial"
            >
              <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
            </button>
          </div>
        </div>

        {/* 3 Telemetry Summary Pills */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/95 dark:bg-[#1f260d] backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-xs border border-[#341011]/5 dark:border-white/10">
            <span className="text-[20px] font-extrabold text-[#341011] dark:text-white leading-none">
              {totalCount}
            </span>
            <span className="text-[10px] font-bold text-[#464833] dark:text-white/70 uppercase tracking-wider mt-1">
              Escaneados
            </span>
          </div>
          <div className="bg-white/95 dark:bg-[#1f260d] backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-xs border border-[#341011]/5 dark:border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2A8743]"></span>
              <span className="text-[20px] font-extrabold text-[#2A8743] leading-none">
                {cleanCount}
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#464833] dark:text-white/70 uppercase tracking-wider mt-1">
              Seguros
            </span>
          </div>
          <div className="bg-white/95 dark:bg-[#1f260d] backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-xs border border-[#341011]/5 dark:border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
              <span className="text-[20px] font-extrabold text-[#ba1a1a] leading-none">
                {dangerCount}
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#464833] dark:text-white/70 uppercase tracking-wider mt-1">
              Alerta Roja
            </span>
          </div>
        </div>
      </section>

      {/* Main Container / Bottom Sheet layout */}
      <section className="bg-[#f9f9f9] dark:bg-[#151908] rounded-t-[2.25rem] shadow-[0_-8px_30px_rgba(52,16,17,0.08)] px-4 pt-5 flex flex-col gap-4 flex-1 min-h-[500px]">
        {/* Search Bar */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#464833] text-[22px]">
            search
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por producto, marca o aditivo..."
            className="w-full bg-white dark:bg-white/5 text-[#1a1c1c] dark:text-white text-[13px] pl-12 pr-11 py-3.5 rounded-2xl shadow-xs outline-none border border-[#341011]/5 dark:border-white/10 placeholder:text-[#464833]/60 focus:ring-2 focus:ring-[#cce510]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap shadow-xs transition-all active:scale-95 cursor-pointer ${
              filter === 'all'
                ? 'bg-[#341011] text-white dark:bg-[#cce510] dark:text-[#341011]'
                : 'bg-white dark:bg-white/5 text-[#464833] dark:text-white/70 hover:text-[#341011]'
            }`}
          >
            Todos ({totalCount})
          </button>
          <button
            onClick={() => setFilter('clean')}
            className={`px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              filter === 'clean'
                ? 'bg-[#341011] text-white dark:bg-[#cce510] dark:text-[#341011]'
                : 'bg-white dark:bg-white/5 text-[#464833] dark:text-white/70 hover:text-[#341011]'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#2A8743]"></span>
            Limpio ({cleanCount})
          </button>
          <button
            onClick={() => setFilter('caution')}
            className={`px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              filter === 'caution'
                ? 'bg-[#341011] text-white dark:bg-[#cce510] dark:text-[#341011]'
                : 'bg-white dark:bg-white/5 text-[#464833] dark:text-white/70 hover:text-[#341011]'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#EBB414]"></span>
            Precaución ({cautionCount})
          </button>
          <button
            onClick={() => setFilter('danger')}
            className={`px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              filter === 'danger'
                ? 'bg-[#341011] text-white dark:bg-[#cce510] dark:text-[#341011]'
                : 'bg-white dark:bg-white/5 text-[#464833] dark:text-white/70 hover:text-[#341011]'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]"></span>
            No consumir ({dangerCount})
          </button>
        </div>

        {/* Empty state */}
        {filteredHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-[#464833] mb-3 shadow-xs">
              <span className="material-symbols-outlined text-[32px]">filter_alt_off</span>
            </div>
            <h3 className="text-[16px] font-bold text-[#341011] dark:text-white">Sin coincidencias</h3>
            <p className="text-[12px] text-[#464833] dark:text-white/60 max-w-xs mt-1">
              No hay escaneos que coincidan con la búsqueda o filtro seleccionado.
            </p>
          </div>
        )}

        {/* Group 1: HOY */}
        {todayItems.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] font-bold text-[#341011] dark:text-white tracking-tight">
                HOY, 24 OCTUBRE
              </span>
              <span className="text-[10px] font-bold text-[#464833] dark:text-white/60 uppercase tracking-wider">
                {todayItems.length} {todayItems.length === 1 ? 'Análisis' : 'Análisis'}
              </span>
            </div>
            {todayItems.map((entry) => renderHistoryCard(entry))}
          </div>
        )}

        {/* Group 2: AYER */}
        {yesterdayItems.length > 0 && (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] font-bold text-[#341011] dark:text-white tracking-tight">
                AYER, 23 OCTUBRE
              </span>
              <span className="text-[10px] font-bold text-[#464833] dark:text-white/60 uppercase tracking-wider">
                {yesterdayItems.length} Análisis
              </span>
            </div>
            {yesterdayItems.map((entry) => renderHistoryCard(entry))}
          </div>
        )}
      </section>
    </div>
  );

  function renderHistoryCard(entry: HistoryEntry) {
    const p = entry.product;
    const isDanger = p.overallStatus === 'danger';
    const isCaution = p.overallStatus === 'caution';
    const isClean = p.overallStatus === 'clean';
    const stripeColor = isDanger
      ? 'bg-[#ba1a1a]'
      : isCaution
      ? 'bg-[#EBB414]'
      : 'bg-[#2A8743]';

    return (
      <article
        key={entry.id}
        className="bg-white dark:bg-[#1f260d] rounded-3xl p-4 shadow-sm relative overflow-hidden flex flex-col gap-2.5 transition-all hover:shadow-md border border-[#341011]/5 dark:border-white/10"
      >
        {/* Risk Stripe Left */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripeColor}`} />

        {/* Main Content Info */}
        <div className="flex items-start gap-3 pl-1.5">
          <div className="w-16 h-16 rounded-2xl bg-[#f3f3f4] shrink-0 overflow-hidden relative shadow-inner">
            <img
              src={p.imageUrl}
              alt={p.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  isDanger ? 'text-[#ba1a1a]' : 'text-[#464833] dark:text-white/60'
                }`}
              >
                {entry.timeLabel}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(p);
                }}
                className="text-[#464833] hover:text-[#341011] dark:hover:text-white p-1 rounded-full active:scale-90 transition-transform cursor-pointer"
                title={p.isSaved ? 'Quitar guardado' : 'Guardar en Botica'}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={p.isSaved ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {p.isSaved ? 'bookmark' : 'bookmark_border'}
                </span>
              </button>
            </div>
            <h2 className="text-[15px] font-bold text-[#341011] dark:text-white truncate mt-0.5">
              {p.name}
            </h2>
            <p className="text-[12px] text-[#464833] dark:text-white/60 truncate">
              {p.brand} · {p.weight}
            </p>
          </div>
        </div>

        {/* Diagnostic Status Badge & Additive Tags */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5 pl-1.5">
          {isClean && (
            <div className="flex items-center gap-1.5 bg-[#2A8743]/10 text-[#2A8743] px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#2A8743]"></span>
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                LIMPIO / Seguro
              </span>
            </div>
          )}
          {isCaution && (
            <div className="flex items-center gap-1.5 bg-[#EBB414]/15 text-[#341011] dark:text-[#EBB414] px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#EBB414]"></span>
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                PRECAUCIÓN / Aditivos
              </span>
            </div>
          )}
          {isDanger && (
            <div className="flex items-center gap-1.5 bg-[#ffdad6] text-[#93000a] px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse"></span>
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                NO CONSUMIR / Tóxico
              </span>
            </div>
          )}
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              isDanger
                ? 'bg-[#ffdad6] text-[#ba1a1a]'
                : isCaution
                ? 'bg-[#f7b6b4]/40 text-[#794948]'
                : 'bg-[#dfe7bd]/80 text-[#5a6241]'
            }`}
          >
            {p.badgeLabel}
          </span>
        </div>

        {/* Highlighted ingredient descriptions or warning tags */}
        <div className="pl-1.5 pt-0.5">
          {isDanger ? (
            <div className="flex flex-wrap gap-1.5">
              {p.ingredients
                .filter((ing) => ing.tier === 'danger')
                .map((ing) => (
                  <span
                    key={ing.id}
                    className="bg-[#ffdad6]/60 text-[#93000a] px-2.5 py-0.5 rounded-lg text-[11px] font-bold"
                  >
                    {ing.name}
                  </span>
                ))}
            </div>
          ) : isCaution ? (
            <div className="flex flex-wrap gap-1.5">
              {p.ingredients
                .filter((ing) => ing.tier === 'caution' || ing.tier === 'healthy')
                .map((ing) => (
                  <span
                    key={ing.id}
                    className="bg-[#f3f3f4] dark:bg-white/10 text-[#341011] dark:text-white px-2.5 py-0.5 rounded-lg text-[11px]"
                  >
                    {ing.name}
                  </span>
                ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#464833] dark:text-white/70 leading-relaxed">
              <strong className="font-bold text-[#341011] dark:text-white">Componentes puros:</strong>{' '}
              {p.ingredients.map((i) => i.name).join(', ')}.
            </p>
          )}
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-end gap-2 pt-1 pl-1.5">
          <button
            onClick={() => onReScan(p)}
            className="px-3.5 py-2 rounded-xl bg-[#f3f3f4] dark:bg-white/10 hover:bg-[#e2e2e2] text-[#341011] dark:text-white text-[12px] font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
            Re-escanear
          </button>
          {isDanger ? (
            <button
              onClick={() => onSelectProduct(p)}
              className="px-4 py-2 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-[12px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Ver toxicidad
              <span className="material-symbols-outlined text-[16px]">warning</span>
            </button>
          ) : (
            <button
              onClick={() => onSelectProduct(p)}
              className="px-4 py-2 rounded-xl bg-[#cce510] hover:bg-[#bbd200] text-[#341011] text-[12px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Ver reporte
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          )}
        </div>
      </article>
    );
  }
};
