import React from 'react';
import { Product } from '../types';

interface FichaTecnicaModalProps {
  product: Product | null;
  onClose: () => void;
  onToggleBookmark: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export const FichaTecnicaModal: React.FC<FichaTecnicaModalProps> = ({
  product,
  onClose,
  onToggleBookmark,
  onAddToCart,
}) => {
  if (!product) return null;

  const isDanger = product.overallStatus === 'danger';
  const isCaution = product.overallStatus === 'caution';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a220a] rounded-t-[2rem] sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col p-5 pb-8 border border-[#341011]/10 text-[#341011] dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle on Mobile */}
        <div className="w-12 h-1.5 bg-[#341011]/20 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-[#341011]/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#586400] dark:text-[#cce510]">
              biotech
            </span>
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#341011] dark:text-white">
              Ficha Técnica Bio-Clínica
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f3f3f4] dark:bg-white/10 text-[#341011] dark:text-white flex items-center justify-center hover:bg-[#e2e2e2] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Product Headline */}
        <div className="flex items-start gap-3 mt-3">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#f3f3f4] shrink-0 border border-[#341011]/10">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase text-[#586400] dark:text-[#cce510]">
              {product.category}
            </span>
            <h2 className="text-[16px] font-bold text-[#341011] dark:text-white leading-tight mt-0.5">
              {product.name}
            </h2>
            <p className="text-[12px] text-[#464833] dark:text-white/60">
              {product.brand} · {product.weight} · UPC {product.upc}
            </p>
          </div>
        </div>

        {/* Risk Score Pill Card */}
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between mt-3 ${
            isDanger
              ? 'bg-[#ffdad6] text-[#93000a]'
              : isCaution
              ? 'bg-[#FFF8E1] text-[#341011]'
              : 'bg-[#E8F5E9] text-[#1B5E20]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[24px]">
              {isDanger ? 'warning' : isCaution ? 'report' : 'verified_user'}
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">
                {product.statusLabel}
              </span>
              <span className="text-[12px] font-medium">
                {product.disruptorCount === 0
                  ? '0 Disruptores identificados'
                  : `${product.disruptorCount} aditivos bajo sospecha`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/10 dark:bg-white/10 shrink-0">
            <span
              className={`w-3 h-3 rounded-full ${
                isDanger ? 'bg-[#ba1a1a] animate-pulse' : isCaution ? 'bg-[#EBB414]' : 'bg-[#2A8743]'
              }`}
            />
            <span className="text-[11px] font-black uppercase tracking-wider">
              {isDanger ? 'Semáforo Rojo' : isCaution ? 'Semáforo Amarillo' : 'Semáforo Verde'}
            </span>
          </div>
        </div>

        {/* Detailed Warning Summary: PRECAUCIÓN BIO-QUÍMICA */}
        <div className="mt-3 p-3 rounded-xl bg-[#f9f9f9] dark:bg-white/5 border border-[#341011]/5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#464833] dark:text-white/60 block mb-1">
            {isDanger || isCaution ? 'PRECAUCIÓN BIO-QUÍMICA' : 'CONFORMIDAD BOTÁNICA'}
          </span>
          <p className="text-[12px] text-[#341011] dark:text-white/90 leading-relaxed font-medium">
            {product.warningSummary}
          </p>
        </div>

        {/* Ingredients Decomposition */}
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[12px] font-bold text-[#341011] dark:text-white">
            Desglose de Ingredientes ({product.ingredients.length})
          </span>
          <div className="flex flex-col gap-2">
            {product.ingredients.map((ing) => (
              <div
                key={ing.id}
                className="p-2.5 rounded-xl bg-[#f9f9f9] dark:bg-white/5 border border-[#341011]/5 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#341011] dark:text-white">
                    {ing.name}
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      ing.tier === 'danger'
                        ? 'bg-[#ffdad6] text-[#ba1a1a]'
                        : ing.tier === 'caution'
                        ? 'bg-[#FFF8E1] text-[#EBB414]'
                        : 'bg-[#E8F5E9] text-[#2A8743]'
                    }`}
                  >
                    {ing.tier === 'danger' ? 'No Consumir' : ing.tier === 'caution' ? 'Precaución' : 'Limpio'}
                  </span>
                </div>
                <p className="text-[11px] text-[#464833] dark:text-white/70 leading-snug">
                  {ing.functionalRiskOrBenefit || ing.details || ing.risks}
                </p>
                {ing.riskNote && (
                  <span className="text-[11px] font-medium text-[#ba1a1a] bg-red-50 dark:bg-red-950/40 p-1 rounded">
                    ⚠️ {ing.riskNote}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center gap-2 mt-5 pt-3 border-t border-[#341011]/10">
          <button
            onClick={() => onAddToCart(product)}
            className="flex-1 py-3 px-4 rounded-full bg-[#cce510] text-[#341011] text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#bbd200] active:scale-98 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              add_shopping_cart
            </span>
            <span>Agregar al Súper</span>
          </button>
          <button
            onClick={() => onToggleBookmark(product)}
            className={`w-12 h-12 rounded-full flex items-center justify-center border border-[#341011]/10 cursor-pointer ${
              product.isSaved ? 'bg-[#341011] text-[#cce510]' : 'bg-[#f3f3f4] dark:bg-white/10 text-[#341011] dark:text-white'
            }`}
            title="Guardar en Botica"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={product.isSaved ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {product.isSaved ? 'bookmark' : 'bookmark_border'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
