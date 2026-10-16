import React, { useEffect, useState } from 'react';
import { Product, ScanAnalysis } from '../types';
import { analyzeIngredientsText, getFunctionalRiskOrBenefit, getIngredientLight } from '../services/ingredientMatcher';
import { LocalVaultService } from '../services/localVault';
import { PLAN_PRICE_LABEL, FREE_WEEKLY_CAMERA_SCANS } from '../config/plans';
import { buildProductFromAnalysis } from '../services/productFactory';
import { TrafficLightBadge } from './TrafficLightBadge';

interface ScanScreenProps {
  currentProduct: Product;
  onOpenLiveScanner: () => void;
  onSelectProduct: (product: Product) => void;
  /** Se llama cuando el usuario activa el semáforo con un texto evaluado (queda en el historial). */
  onProductEvaluated?: (product: Product) => void;
  /** Cambia cada vez que la base LuBo se actualiza desde OneDrive (para recalcular el semáforo mostrado). */
  dbVersion?: number;
  onToggleBookmark: (product: Product) => void;
  onOpenFicha: (product: Product) => void;
  allProducts: Product[];
  onOpenInicioModal?: () => void;
}

export const ScanScreen: React.FC<ScanScreenProps> = ({
  currentProduct,
  onOpenLiveScanner,
  onSelectProduct,
  onProductEvaluated,
  dbVersion,
  onToggleBookmark,
  onOpenFicha,
  allProducts,
  onOpenInicioModal,
}) => {
  const [copiedShare, setCopiedShare] = useState(false);
  const [activeIngredientModal, setActiveIngredientModal] = useState<string | null>(null);
  const [ingredientInput, setIngredientInput] = useState('');
  const [evaluatedResult, setEvaluatedResult] = useState<ScanAnalysis | null>(null);

  // Si la base LuBo cambió (Excel de OneDrive), el semáforo mostrado se recalcula con la lista nueva.
  useEffect(() => {
    setEvaluatedResult((prev) => (prev ? analyzeIngredientsText(prev.rawText, LocalVaultService.getIngredients()) : prev));
  }, [dbVersion]);

  const handleEvaluateIngredient = (textToEvaluate?: string) => {
    const text = (textToEvaluate ?? ingredientInput).trim();
    if (!text) return;
    // Lectura 100% local: base maestra en memoria, sin red.
    setEvaluatedResult(analyzeIngredientsText(text, LocalVaultService.getIngredients()));
  };

  const handleApplyEvaluatedToScreen = () => {
    if (!evaluatedResult || evaluatedResult.matchedIngredients.length === 0) return;
    const product = buildProductFromAnalysis(evaluatedResult, { source: 'text' });
    (onProductEvaluated ?? onSelectProduct)(product);
    setEvaluatedResult(null);
    setIngredientInput('');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `LuBo - Ficha Bioquímica: ${currentProduct.name}`,
          text: `Análisis químico de ${currentProduct.name} (${currentProduct.statusLabel}). Detector de químicos LuBo.`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(
        `Ficha LuBo Botica: ${currentProduct.name} (${currentProduct.statusLabel}) - UPC: ${currentProduct.upc}`
      );
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const cleanAlternativeProduct = allProducts.find((p) => p.overallStatus === 'clean');

  const scanCheck = LocalVaultService.canPerformCameraScan();
  const isFreePlan = scanCheck.maxWeeklyScans <= FREE_WEEKLY_CAMERA_SCANS;
  const isWeeklyLimitReached = !scanCheck.allowed;

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 pt-3 pb-28 gap-4">
      {/* Banner Informativo si se alcanzó el límite semanal del Plan Free */}
      {isWeeklyLimitReached && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl p-3.5 shadow-sm flex flex-col gap-2 animate-fadeIn">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[20px] text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                lock
              </span>
              <div>
                <h4 className="text-[12px] font-black text-amber-900 dark:text-amber-200 uppercase">
                  Límite Semanal de Escaneos Alcanzado (2/2)
                </h4>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug mt-0.5">
                  Has completado los 2 escaneos semanales con cámara de tu Plan Free.
                </p>
              </div>
            </div>
            {onOpenInicioModal && (
              <button
                type="button"
                onClick={onOpenInicioModal}
                className="px-2.5 py-1 rounded-full bg-[#341011] text-[#cce510] text-[10px] font-extrabold shrink-0 shadow-xs hover:bg-black transition-all cursor-pointer"
              >
                Ver Planes ({PLAN_PRICE_LABEL.monthly})
              </button>
            )}
          </div>
          <div className="bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-[#2A8743] dark:text-[#a1e687] font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] shrink-0">check_circle</span>
            <span>
              <strong>¡Opciones Ilimitadas!</strong> Introducir ingredientes por texto, el semáforo y las alternativas son 100% ilimitados.
            </span>
          </div>
        </div>
      )}

      {/* 1. LENTE BIO-ESPECTRAL (Camera trigger banner) */}
      <div className="bg-white dark:bg-[#1f260d] rounded-2xl p-4 shadow-sm relative overflow-hidden border border-[#341011]/5 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col flex-1 pr-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="material-symbols-outlined text-[15px] text-[#586400] dark:text-[#cce510]">
                filter_center_focus
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#586400] dark:text-[#cce510]">
                Lente Bio-Espectral
              </span>
            </div>
            <h2 className="text-[18px] font-bold text-[#341011] dark:text-white leading-tight tracking-tight">
              Escanear nuevo producto
            </h2>
            <p className="text-[12px] text-[#464833] dark:text-white/70 mt-0.5 leading-snug">
              Enfoca etiqueta frontal, ingredientes o código UPC
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              {isFreePlan ? (
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    isWeeklyLimitReached
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                      : 'bg-[#cce510]/25 text-[#586400] dark:text-[#cce510]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[11px]">
                    {isWeeklyLimitReached ? 'lock' : 'schedule'}
                  </span>
                  <span>{scanCheck.weeklyScansUsed}/2 escaneos esta semana</span>
                </span>
              ) : (
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#2A8743]/20 text-[#2A8743] dark:text-[#cce510] inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                  <span>Escaneos Ilimitados</span>
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-3 pt-1 border-t border-[#341011]/5 dark:border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#53BB26] animate-pulse"></span>
                <span className="text-[10px] font-bold text-[#341011] dark:text-[#cce510]">
                  Sensor Botica v4.2 Activo
                </span>
              </div>
              <button
                onClick={onOpenLiveScanner}
                className="text-[11px] font-bold text-[#341011] dark:text-white flex items-center gap-1 hover:text-[#586400] transition-colors cursor-pointer"
              >
                <span>Modo Macro</span>
                <span className="material-symbols-outlined text-[15px]">tune</span>
              </button>
            </div>
          </div>

          {/* Interactive Optical Bio-Lens with Green Circuit Surround */}
          <div className="relative flex items-center justify-center shrink-0">
            {/* Animated Green Circuit Board Overlay */}
            <svg
              className="absolute -inset-2.5 w-[calc(100%+20px)] h-[calc(100%+20px)] pointer-events-none animate-spin"
              style={{ animationDuration: '28s' }}
              viewBox="0 0 120 120"
            >
              {/* Outer Circuit Track */}
              <circle
                cx="60"
                cy="60"
                r="56"
                fill="none"
                stroke="#2A8743"
                strokeWidth="1.5"
                strokeDasharray="8 4 2 4"
                opacity="0.85"
              />
              {/* Secondary Circuit Ring */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#cce510"
                strokeWidth="1.2"
                strokeDasharray="14 6 4 6"
                opacity="0.9"
              />
              {/* Circuit Micro-Nodes & Trace Connectors */}
              <circle cx="60" cy="4" r="3" fill="#53BB26" className="animate-pulse" />
              <line x1="60" y1="4" x2="60" y2="10" stroke="#53BB26" strokeWidth="1.5" />

              <circle cx="116" cy="60" r="3" fill="#53BB26" className="animate-pulse" />
              <line x1="116" y1="60" x2="110" y2="60" stroke="#53BB26" strokeWidth="1.5" />

              <circle cx="60" cy="116" r="3" fill="#53BB26" className="animate-pulse" />
              <line x1="60" y1="116" x2="60" y2="110" stroke="#53BB26" strokeWidth="1.5" />

              <circle cx="4" cy="60" r="3" fill="#53BB26" className="animate-pulse" />
              <line x1="4" y1="60" x2="10" y2="60" stroke="#53BB26" strokeWidth="1.5" />

              {/* Diagonal Circuit Trace Nodes */}
              <circle cx="98" cy="22" r="2.5" fill="#cce510" />
              <line x1="98" y1="22" x2="92" y2="28" stroke="#cce510" strokeWidth="1.2" />

              <circle cx="22" cy="98" r="2.5" fill="#cce510" />
              <line x1="22" y1="98" x2="28" y2="92" stroke="#cce510" strokeWidth="1.2" />

              <circle cx="22" cy="22" r="2.5" fill="#2A8743" />
              <circle cx="98" cy="98" r="2.5" fill="#2A8743" />
            </svg>

            {/* Glowing Circuit Pulse Halo */}
            <div className="absolute inset-0 rounded-full ring-4 ring-[#2A8743]/20 dark:ring-[#cce510]/30 animate-pulse pointer-events-none" />

            {/* Main Interactive Button with Inner Element matching largest green circle (w-16 h-16) */}
            <button
              onClick={onOpenLiveScanner}
              className="w-22 h-22 rounded-full bg-gradient-to-tr from-[#2A8743]/20 via-[#cce510]/35 to-[#e4f738]/50 flex items-center justify-center relative shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all group"
              title="Presiona para activar el escáner bio-espectral"
              aria-label="Activar escáner de cámara"
            >
              {/* Inner Circle matching exactly the size of the largest green circle (w-16 h-16 / 64px) */}
              <div className="w-16 h-16 rounded-full bg-[#2A8743] text-white flex items-center justify-center shadow-lg shadow-[#2A8743]/40 ring-4 ring-[#2A8743]/30 group-hover:scale-105 transition-all">
                <span className="material-symbols-outlined text-[34px] text-white group-hover:scale-110 transition-transform">
                  barcode_scanner
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SEMÁFORO BIO-TOXICOLÓGICO */}
      <div className="bg-white dark:bg-[#1f260d] rounded-2xl p-4 shadow-sm flex flex-col gap-3 border border-[#341011]/5 dark:border-white/10 relative overflow-hidden">
        {/* Faint Bio-Spectral Scanning Grid Overlay Effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.06] dark:opacity-[0.14] bg-[linear-gradient(to_right,#341011_1px,transparent_1px),linear-gradient(to_bottom,#341011_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#cce510_1px,transparent_1px),linear-gradient(to_bottom,#cce510_1px,transparent_1px)] bg-[size:16px_16px]" />
        <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#cce510] to-transparent opacity-75 animate-scan-laser pointer-events-none shadow-[0_0_10px_#cce510]" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#341011] dark:text-[#cce510] text-[20px]">
              traffic
            </span>
            <h3 className="text-[16px] font-bold text-[#341011] dark:text-white tracking-tight leading-none">
              Semáforo Bio-Toxicológico
            </h3>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#f3f3f4] dark:bg-white/10 text-[#464833] dark:text-white/80">
            Semáforo Oficial LuBo
          </span>
        </div>

        {/* 3 Status Columns with Enlarged & Doubled Selected Circles */}
        <div className="grid grid-cols-3 gap-2 pt-1 items-end relative z-10">
          {/* LIMPIO */}
          {(() => {
            const isClean = currentProduct.overallStatus === 'clean';
            return (
              <button
                onClick={() => {
                  const cleanItem = allProducts.find((p) => p.overallStatus === 'clean');
                  if (cleanItem) onSelectProduct(cleanItem);
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all duration-300 relative cursor-pointer min-h-[120px] ${
                  isClean
                    ? 'bg-[#2A8743]/15 ring-2 ring-[#2A8743] shadow-md scale-102 z-10'
                    : 'bg-[#f3f3f4]/80 dark:bg-white/5 opacity-70 hover:opacity-100'
                }`}
              >
                {isClean && (
                  <span className="absolute -top-2 px-2.5 py-0.5 rounded-full bg-[#2A8743] text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                    ACTIVO
                  </span>
                )}
                <div
                  className={`rounded-full flex items-center justify-center transition-all duration-300 ${
                    isClean
                      ? 'w-16 h-16 bg-[#2A8743]/25 ring-4 ring-[#2A8743]/30 shadow-md mb-2'
                      : 'w-9 h-9 bg-[#2A8743]/20 mb-2'
                  }`}
                >
                  <span
                    className={`rounded-full bg-[#2A8743] transition-all duration-300 ${
                      isClean ? 'w-8 h-8 shadow-sm' : 'w-4 h-4'
                    }`}
                  ></span>
                </div>
                <span
                  className={`text-[#341011] dark:text-white uppercase leading-none transition-all ${
                    isClean ? 'text-[12px] font-black' : 'text-[11px] font-bold'
                  }`}
                >
                  LIMPIO
                </span>
                <span className="text-[10px] text-[#464833] dark:text-white/60 mt-0.5">Seguro</span>
              </button>
            );
          })()}

          {/* PRECAUCIÓN */}
          {(() => {
            const isCaution = currentProduct.overallStatus === 'caution';
            return (
              <button
                onClick={() => {
                  const cautionItem = allProducts.find((p) => p.overallStatus === 'caution');
                  if (cautionItem) onSelectProduct(cautionItem);
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all duration-300 relative cursor-pointer min-h-[120px] ${
                  isCaution
                    ? 'bg-[#EBB414]/20 ring-2 ring-[#EBB414] shadow-md scale-102 z-10'
                    : 'bg-[#f3f3f4]/80 dark:bg-white/5 opacity-70 hover:opacity-100'
                }`}
              >
                {isCaution && (
                  <span className="absolute -top-2.5 px-2.5 py-0.5 rounded-full bg-[#EBB414] text-[#341011] text-[9px] font-black uppercase tracking-wider shadow-xs animate-pulse">
                    ACTIVO
                  </span>
                )}
                <div
                  className={`rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCaution
                      ? 'w-16 h-16 bg-[#EBB414]/30 ring-4 ring-[#EBB414]/40 shadow-md mb-2'
                      : 'w-9 h-9 bg-[#EBB414]/25 mb-2'
                  }`}
                >
                  <span
                    className={`rounded-full bg-[#EBB414] transition-all duration-300 ${
                      isCaution ? 'w-8 h-8 shadow-sm' : 'w-4 h-4'
                    }`}
                  ></span>
                </div>
                <span
                  className={`text-[#341011] dark:text-white uppercase leading-none transition-all ${
                    isCaution ? 'text-[12px] font-black' : 'text-[11px] font-bold'
                  }`}
                >
                  PRECAUCIÓN
                </span>
                <span className="text-[10px] text-[#464833] dark:text-white/60 mt-0.5">Aditivos</span>
              </button>
            );
          })()}

          {/* NO CONSUMIR */}
          {(() => {
            const isDanger = currentProduct.overallStatus === 'danger';
            return (
              <button
                onClick={() => {
                  const dangerItem = allProducts.find((p) => p.overallStatus === 'danger');
                  if (dangerItem) onSelectProduct(dangerItem);
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all duration-300 relative cursor-pointer min-h-[120px] ${
                  isDanger
                    ? 'bg-[#FF6161]/20 ring-2 ring-[#ba1a1a] shadow-md scale-102 z-10'
                    : 'bg-[#f3f3f4]/80 dark:bg-white/5 opacity-70 hover:opacity-100'
                }`}
              >
                {isDanger && (
                  <span className="absolute -top-2 px-2.5 py-0.5 rounded-full bg-[#ba1a1a] text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                    ACTIVO
                  </span>
                )}
                <div
                  className={`rounded-full flex items-center justify-center transition-all duration-300 ${
                    isDanger
                      ? 'w-16 h-16 bg-[#ba1a1a]/25 ring-4 ring-[#ba1a1a]/30 shadow-md mb-2'
                      : 'w-9 h-9 bg-[#ba1a1a]/20 mb-2'
                  }`}
                >
                  <span
                    className={`rounded-full bg-[#ba1a1a] transition-all duration-300 ${
                      isDanger ? 'w-8 h-8 shadow-sm animate-pulse' : 'w-4 h-4'
                    }`}
                  ></span>
                </div>
                <span
                  className={`text-[#341011] dark:text-white uppercase leading-none truncate w-full text-center transition-all ${
                    isDanger ? 'text-[11px] font-black' : 'text-[10px] font-bold'
                  }`}
                >
                  NO CONSUMIR
                </span>
                <span className="text-[10px] text-[#464833] dark:text-white/60 mt-0.5">Tóxico</span>
              </button>
            );
          })()}
        </div>

        {/* Detailed Risk Card: PRECAUCIÓN BIO-QUÍMICA */}
        <div
          className={`p-3 rounded-xl flex items-start gap-3 mt-1 ${
            currentProduct.overallStatus === 'danger'
              ? 'bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/20'
              : currentProduct.overallStatus === 'caution'
              ? 'bg-[#FFF8E1] text-[#673a39] border border-[#EBB414]/30'
              : 'bg-[#E8F5E9] text-[#1B5E20] border border-[#2A8743]/20'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              currentProduct.overallStatus === 'danger'
                ? 'bg-[#ba1a1a] text-white'
                : currentProduct.overallStatus === 'caution'
                ? 'bg-[#EBB414] text-[#341011]'
                : 'bg-[#2A8743] text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {currentProduct.overallStatus === 'danger'
                ? 'dangerous'
                : currentProduct.overallStatus === 'caution'
                ? 'warning'
                : 'check_circle'}
            </span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wide">
                {currentProduct.overallStatus === 'danger' || currentProduct.overallStatus === 'caution'
                  ? 'PRECAUCIÓN BIO-QUÍMICA'
                  : 'CONFORMIDAD BOTÁNICA'}
              </span>
              <span className="text-[10px] font-bold opacity-80">
                {currentProduct.substatusNote}
              </span>
            </div>
            <p className="text-[12px] font-normal leading-relaxed mt-0.5">
              {currentProduct.warningSummary}
            </p>
          </div>
        </div>
      </div>

      {/* 2.5 LECTOR Y COMPROBADOR DE INGREDIENTES (Base Interna OneDrive 100% Offline) */}
      <div id="escribir-ingredientes" className="bg-white dark:bg-[#1f260d] rounded-2xl p-4 shadow-sm border border-[#341011]/5 dark:border-white/10 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#586400] dark:text-[#cce510] text-[20px]">
              edit_note
            </span>
            <h3 className="text-[15px] font-bold text-[#341011] dark:text-white leading-tight">
              Escribir ingrediente o fórmula
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#cce510] text-[#341011] shadow-xs">
              Ilimitado · Free, Mensual y Anual
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ingredientInput}
            onChange={(e) => {
              setIngredientInput(e.target.value);
              if (e.target.value.trim().length >= 2) {
                handleEvaluateIngredient(e.target.value);
              } else {
                setEvaluatedResult(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleEvaluateIngredient();
              }
            }}
            placeholder="Escribe un ingrediente (ej. Tartrazina, Acaí, BHA)..."
            className="flex-1 bg-[#f3f3f4] dark:bg-white/10 text-[12px] px-3.5 py-2.5 rounded-xl border border-[#341011]/10 text-[#341011] dark:text-white outline-none focus:ring-2 focus:ring-[#cce510]"
          />
          <button
            onClick={() => handleEvaluateIngredient()}
            className="px-3.5 py-2.5 rounded-xl bg-[#341011] text-[#cce510] text-[12px] font-bold active:scale-95 cursor-pointer hover:bg-black transition-all shrink-0"
          >
            Evaluar
          </button>
        </div>

        {/* Quick Sample Pills from Master DB */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
          <span className="text-[10px] text-[#464833] dark:text-white/60 shrink-0 font-medium">Ejemplos:</span>
          {['Tartrazina', 'Acaí', 'Bromato de potasio', 'Aceite de aguacate', 'BHA / BHT', 'Aloe Vera'].map((term) => (
            <button
              key={term}
              onClick={() => {
                setIngredientInput(term);
                handleEvaluateIngredient(term);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#f3f3f4] dark:bg-white/10 hover:bg-[#cce510] hover:text-[#341011] text-[#464833] dark:text-white text-[10px] font-bold shrink-0 transition-colors cursor-pointer"
            >
              {term}
            </button>
          ))}
        </div>

        {/* Evaluated Result Preview */}
        {evaluatedResult && (
          <div
            className={`p-3 rounded-xl border flex flex-col gap-2 animate-in fade-in ${
              evaluatedResult.overallStatus === 'red'
                ? 'bg-[#ffdad6]/30 border-rose-300 dark:border-rose-900/50 text-[#93000a] dark:text-rose-200'
                : evaluatedResult.overallStatus === 'yellow'
                ? 'bg-[#FFF8E1] border-amber-300 dark:border-amber-900/50 text-[#673a39] dark:text-amber-200'
                : evaluatedResult.overallStatus === 'unknown'
                ? 'bg-[#f3f3f4] dark:bg-white/10 border-[#341011]/20 text-[#341011] dark:text-white'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    evaluatedResult.overallStatus === 'red'
                      ? 'bg-[#ba1a1a] animate-pulse'
                      : evaluatedResult.overallStatus === 'yellow'
                      ? 'bg-[#EBB414]'
                      : evaluatedResult.overallStatus === 'unknown'
                      ? 'bg-[#341011]/40'
                      : 'bg-[#2A8743]'
                  }`}
                />
                <span className="text-[13px] font-black uppercase">
                  {evaluatedResult.overallStatus === 'red'
                    ? '🔴 SEMÁFORO ROJO (TÓXICO)'
                    : evaluatedResult.overallStatus === 'yellow'
                    ? '🟡 SEMÁFORO AMARILLO (PRECAUCIÓN)'
                    : evaluatedResult.overallStatus === 'unknown'
                    ? '⚪ SIN COINCIDENCIAS EN BASE LUBO'
                    : '🟢 SEMÁFORO VERDE (ÓPTIMO / LIMPIO)'}
                </span>
              </div>
              <TrafficLightBadge status={evaluatedResult.overallStatus} size="md" />
            </div>

            <div className="mt-1 pt-1 border-t border-black/5 dark:border-white/10">
              <span className="text-[10px] font-black uppercase tracking-wide opacity-80 block text-[#341011] dark:text-white">
                {evaluatedResult.overallStatus === 'green' ? 'Beneficio Botánico:' : evaluatedResult.overallStatus === 'unknown' ? 'Resultado:' : 'PRECAUCIÓN BIO-QUÍMICA:'}
              </span>
              <p className="text-[12px] font-medium leading-relaxed mt-0.5">
                {evaluatedResult.verdict}
              </p>
            </div>

            {evaluatedResult.matchedIngredients.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1 border-t border-black/10 dark:border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  Coincidencias en base oficial ({evaluatedResult.matchedIngredients.length}):
                </span>
                {evaluatedResult.matchedIngredients.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] font-medium bg-black/5 dark:bg-white/5 p-1.5 rounded-lg">
                    <span className="font-bold">{m.ingredient.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#464833] dark:text-white/60 truncate max-w-[170px]">
                        {getFunctionalRiskOrBenefit(m.ingredient)}
                      </span>
                      <TrafficLightBadge status={getIngredientLight(m.ingredient)} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {evaluatedResult.summary.unrecognizedCount > 0 && evaluatedResult.overallStatus !== 'unknown' && (
              <p className="text-[10px] font-semibold opacity-80 pt-1 border-t border-black/10 dark:border-white/10">
                {evaluatedResult.summary.unrecognizedCount} término(s) no están en la base LuBo y no se clasificaron:{' '}
                {evaluatedResult.unrecognizedTokens.slice(0, 4).join(', ')}
              </p>
            )}

            {evaluatedResult.matchedIngredients.length > 0 && (
            <button
              onClick={handleApplyEvaluatedToScreen}
              className="mt-1 w-full py-2 rounded-xl bg-[#341011] text-[#cce510] text-[11px] font-black uppercase tracking-wider hover:bg-black transition-all active:scale-98 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>Activar Semáforo con este resultado</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
            )}
          </div>
        )}
      </div>

      {/* 3. ESPACIO DESTACADO DE PROMOCIÓN DE ALTERNATIVAS LIMPIAS (Gran formato y alta visibilidad) */}
      {(currentProduct.cleanAlternative || cleanAlternativeProduct) && (() => {
        const altData = currentProduct.cleanAlternative || {
          name: cleanAlternativeProduct?.name || 'Barra Avena & Dátiles',
          brand: cleanAlternativeProduct?.brand || 'Raíz Madre · Botica Certificada',
          note: cleanAlternativeProduct?.warningSummary || '0 aditivos químicos · Semáforo Verde 100% Óptimo',
        };
        const targetProduct = cleanAlternativeProduct || allProducts.find((p) => p.overallStatus === 'clean') || allProducts[0];

        return (
          <div className="bg-gradient-to-br from-[#271011] via-[#3a1517] to-[#17250e] text-white rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-[#cce510]/50 relative overflow-hidden transition-all hover:border-[#cce510] group">
            {/* Luminous glow flare background */}
            <div className="absolute -top-14 -right-14 w-48 h-48 bg-[#cce510]/20 rounded-full blur-2xl pointer-events-none group-hover:bg-[#cce510]/30 transition-all" />
            <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-[#2A8743]/20 rounded-full blur-xl pointer-events-none" />

            {/* Top Promotional Banner Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 relative z-10">
              <span className="inline-flex items-center gap-1.5 bg-[#cce510]/20 text-[#cce510] border border-[#cce510]/40 px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-black uppercase tracking-wider shadow-xs">
                <span className="material-symbols-outlined text-[15px] animate-pulse">sparkles</span>
                <span>Alternativas LuBo</span>
              </span>

              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Tu opción sin químicos dañinos</span>
              </span>
            </div>

            {/* Core Product Information Card with Large Typography */}
            <div className="flex items-start gap-3.5 relative z-10">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#2A8743] via-[#3ebd53] to-[#cce510] text-white flex items-center justify-center text-[30px] sm:text-[34px] shadow-lg shadow-[#2A8743]/40 ring-2 ring-[#cce510]/60 shrink-0 group-hover:scale-105 transition-transform">
                🌿
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[12px] sm:text-[13px] font-black text-[#cce510] uppercase tracking-wide">
                  {altData.brand}
                </span>
                <h3 className="text-[18px] sm:text-[21px] font-black text-white leading-tight tracking-tight mt-0.5">
                  {altData.name}
                </h3>
                <p className="text-[13px] sm:text-[14px] text-[#e8f5c8] leading-snug mt-1.5 font-medium">
                  {altData.note}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-emerald-300/90 font-semibold">
                  <span className="material-symbols-outlined text-[14px] text-[#cce510]">verified</span>
                  <span>Seleccionada por LuBo la botica para ti</span>
                </div>
              </div>
            </div>

            {/* High-Impact Eye-Catching Call-to-Action Button */}
            {targetProduct && (
              <div className="mt-4 pt-3 border-t border-white/10 relative z-10">
                <button
                  onClick={() => onSelectProduct(targetProduct)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#cce510] via-[#dcf52a] to-[#cce510] text-[#341011] text-[13px] sm:text-[14px] font-black uppercase tracking-wider shadow-lg shadow-[#cce510]/30 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#cce510] group-hover:shadow-[#cce510]/50"
                >
                  <span className="material-symbols-outlined text-[20px]">local_mall</span>
                  <span>CONOCER ESTA ALTERNATIVA LIMPIA</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 4. PRODUCT METADATA & INGREDIENT LIST */}
      <div className="bg-white dark:bg-[#1f260d] rounded-2xl p-4 shadow-sm flex flex-col gap-3 border border-[#341011]/5 dark:border-white/10">
        {/* Top Header UPC & Time */}
        <div className="flex items-center justify-between text-[11px] text-[#464833] dark:text-white/60">
          <div className="flex items-center gap-1 font-mono">
            <span className="material-symbols-outlined text-[15px]">barcode</span>
            <span>{currentProduct.upc}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span>Hace 2 min</span>
          </div>
        </div>

        {/* Product image & title */}
        <div className="flex items-start gap-3 pt-1">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#f3f3f4] shrink-0 border border-[#341011]/5 relative">
            <img
              src={currentProduct.imageUrl}
              alt={currentProduct.name}
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
              {currentProduct.weight}
            </span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#2A8743] bg-[#2A8743]/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[11px]">verified</span>
                Botica Artesanal
              </span>
            </div>
            <h1 className="text-[17px] font-bold text-[#341011] dark:text-white mt-1 leading-snug">
              {currentProduct.name}
            </h1>
            <p className="text-[11px] text-[#464833] dark:text-white/60 mt-0.5">
              {currentProduct.lotNumber || 'Lote: BTO-8893 · Origen Certificado'}
            </p>
          </div>
        </div>

        {/* Ingredients Title */}
        <div className="flex items-center justify-between pt-2 border-t border-[#341011]/5 dark:border-white/10">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#341011] dark:text-[#cce510] text-[18px]">
              science
            </span>
            <h4 className="text-[14px] font-bold text-[#341011] dark:text-white">
              Ingredientes ({currentProduct.ingredients.length})
            </h4>
          </div>
          <button
            onClick={() => onOpenFicha(currentProduct)}
            className="text-[11px] text-[#586400] dark:text-[#cce510] font-bold hover:underline cursor-pointer"
          >
            Ficha Completa
          </button>
        </div>

        {/* Ingredient List Items */}
        <div className="flex flex-col gap-2">
          {currentProduct.ingredients.map((ing) => {
            const isDanger = ing.tier === 'danger';
            const isCaution = ing.tier === 'caution';
            const isHealthy = ing.tier === 'healthy';
            const dotColor = isDanger
              ? 'bg-[#ba1a1a]'
              : isCaution
              ? 'bg-[#EBB414]'
              : isHealthy
              ? 'bg-[#53BB26]'
              : 'bg-[#2A8743]';
            const badgeBg = isDanger
              ? 'bg-[#ffdad6] text-[#ba1a1a]'
              : isCaution
              ? 'bg-[#FFF8E1] text-[#B78103]'
              : isHealthy
              ? 'bg-[#E8F5E9] text-[#2E7D32]'
              : 'bg-[#E8F5E9] text-[#1B5E20]';
            const tierLabel = isDanger
              ? 'No Consumir'
              : isCaution
              ? 'Precaución'
              : 'Limpio';

            const riskOrBenefit = ing.functionalRiskOrBenefit || ing.details || getFunctionalRiskOrBenefit(ing);

            return (
              <div
                key={ing.id}
                onClick={() => setActiveIngredientModal(ing.name)}
                className="p-2.5 rounded-xl bg-[#f9f9f9] dark:bg-white/5 border border-[#341011]/5 dark:border-white/5 flex items-center justify-between gap-2 hover:bg-[#f3f3f4] dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0 mt-1`}></span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-bold text-[#341011] dark:text-white leading-tight truncate">
                      {ing.name}
                    </span>
                    <span className="text-[11px] text-[#464833] dark:text-white/60 mt-0.5 leading-snug truncate">
                      {riskOrBenefit}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${badgeBg}`}
                >
                  {tierLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Actions Row: Compartir Ficha & Bookmark */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleShare}
            className="flex-1 py-3 px-4 rounded-full bg-[#f3f3f4] dark:bg-white/10 hover:bg-[#eeeeee] active:scale-98 transition-all flex items-center justify-center gap-2 text-[#341011] dark:text-white font-bold text-[13px] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copiedShare ? 'check' : 'share'}
            </span>
            <span>{copiedShare ? 'Enlace Copiado' : 'Compartir ficha'}</span>
          </button>
          <button
            onClick={() => onToggleBookmark(currentProduct)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentProduct.isSaved
                ? 'bg-[#cce510] text-[#341011] shadow-sm'
                : 'bg-[#f3f3f4] dark:bg-white/10 text-[#464833] dark:text-white/70 hover:text-[#341011]'
            }`}
            title={currentProduct.isSaved ? 'Guardado en tu Botica' : 'Guardar en Favoritos'}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={currentProduct.isSaved ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {currentProduct.isSaved ? 'bookmark' : 'bookmark_border'}
            </span>
          </button>
        </div>
      </div>

      {/* Ingredient Quick Popover info */}
      {activeIngredientModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setActiveIngredientModal(null)}
        >
          <div
            className="bg-white dark:bg-[#1a220a] rounded-2xl p-5 max-w-sm w-full shadow-xl flex flex-col gap-3 border border-[#341011]/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#586400] dark:text-[#cce510]">
                Ficha de Componente
              </span>
              <button
                onClick={() => setActiveIngredientModal(null)}
                className="p-1 rounded-full text-gray-500 hover:text-black dark:hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <h3 className="text-[16px] font-bold text-[#341011] dark:text-white">
              {activeIngredientModal}
            </h3>
            <p className="text-[13px] text-[#464833] dark:text-white/80 leading-relaxed">
              Analizado por el algoritmo botánico LuBo según índices internacionales de aditivos seguros, botánica pura
              e inocuidad alimentaria.
            </p>
            <button
              onClick={() => setActiveIngredientModal(null)}
              className="w-full py-2.5 rounded-full bg-[#cce510] text-[#341011] font-bold text-[13px] mt-1 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
