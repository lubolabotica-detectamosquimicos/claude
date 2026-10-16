import React, { useState } from 'react';
import { Product } from '../types';

interface SavedScreenProps {
  products: Product[];
  onOpenFicha: (product: Product) => void;
  onToggleBookmark: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onOpenGroceryList: () => void;
  onOpenImpactModal: () => void;
  onExportSaved: () => void;
}

export const SavedScreen: React.FC<SavedScreenProps> = ({
  products,
  onOpenFicha,
  onToggleBookmark,
  onAddToCart,
  onOpenGroceryList,
  onOpenImpactModal,
  onExportSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'favs' | 'lists'>('favs');
  const [cartAlert, setCartAlert] = useState<string | null>(null);

  const savedProducts = products.filter((p) => p.isSaved);
  const groceryItems = products.filter((p) => p.isInList);
  const purchasedCount = groceryItems.filter((p) => p.isPurchased).length;

  const handleCartClick = (p: Product) => {
    onAddToCart(p);
    setCartAlert(`"${p.name}" agregado a tu lista`);
    setTimeout(() => setCartAlert(null), 2000);
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 pt-3 pb-28 gap-4">
      {/* Toast Alert */}
      {cartAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#341011] text-white text-[12px] font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-[#cce510]">
          <span className="material-symbols-outlined text-[16px] text-[#cce510]">
            shopping_bag
          </span>
          <span>{cartAlert}</span>
        </div>
      )}

      {/* 1. Header: Tu Botica Segura & 12 verificados */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[#341011] dark:text-[#cce510] text-[24px]">
            verified
          </span>
          <h1 className="text-[18px] font-bold text-[#341011] dark:text-white tracking-tight">
            Tu Botica Segura
          </h1>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#1f260d] shadow-xs border border-[#341011]/5 dark:border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-[#586400] dark:bg-[#cce510] animate-pulse"></span>
          <span className="text-[12px] font-bold text-[#341011] dark:text-white">
            {savedProducts.length} verificados
          </span>
        </div>
      </div>

      {/* 2. Disclaimer legal/médico */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60 dark:bg-white/5 text-[#464833] dark:text-white/70 text-[11px] leading-relaxed shadow-xs border border-[#341011]/5 dark:border-white/10">
        <span className="material-symbols-outlined text-[16px] text-[#5a6241] dark:text-[#cce510] shrink-0 mt-0.5">
          info
        </span>
        <p className="leading-snug m-0">
          Lubo la botica es una herramienta informativa y de apoyo para decisiones de consumo consciente, no un diagnóstico médico ni farmacológico.
        </p>
      </div>

      {/* 3. Tab Buttons */}
      <div className="flex p-1 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur-xs shadow-xs border border-[#341011]/5 dark:border-white/10">
        <button
          onClick={() => setActiveTab('favs')}
          className={`flex-1 py-2 px-3 rounded-full text-[12px] font-bold text-center transition-all cursor-pointer ${
            activeTab === 'favs'
              ? 'bg-[#341011] text-[#cce510] shadow-sm'
              : 'text-[#464833] dark:text-white/70 hover:text-[#341011]'
          }`}
        >
          Mis Favoritos Limpios
        </button>
        <button
          onClick={() => {
            setActiveTab('lists');
            onOpenGroceryList();
          }}
          className={`flex-1 py-2 px-3 rounded-full text-[12px] font-bold text-center transition-all cursor-pointer ${
            activeTab === 'lists'
              ? 'bg-[#341011] text-[#cce510] shadow-sm'
              : 'text-[#464833] dark:text-white/70 hover:text-[#341011]'
          }`}
        >
          Listas de Compras
        </button>
      </div>

      {/* 4. Hero Card: Despensa 100% Consciente */}
      <div className="rounded-2xl p-4 bg-[#341011] text-white shadow-md flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-[#cce510]/10 pointer-events-none blur-xl" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className="material-symbols-outlined text-[#cce510] text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              eco
            </span>
            <span className="text-[12px] font-extrabold text-[#cce510] uppercase tracking-wider">
              Alternativas Limpias
            </span>
          </div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#cce510]/20 text-[#cce510]">
            Ecosistema 0% Toxinas
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-[19px] font-bold text-white leading-tight">
            Despensa 100% Consciente
          </h3>
          <p className="text-[13px] text-[#c3cba2] leading-relaxed">
            Has reemplazado 8 químicos de alto riesgo con ingredientes puros de origen botánico comprobado.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <div className="w-7 h-7 rounded-full bg-[#cce510] flex items-center justify-center text-[#341011] text-[12px] shadow-sm">
                🌿
              </div>
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-[#341011] text-[12px] shadow-sm">
                🌾
              </div>
              <div className="w-7 h-7 rounded-full bg-[#dfe7bd] flex items-center justify-center text-[#341011] text-[12px] shadow-sm">
                🍯
              </div>
            </div>
            <span className="text-[11px] text-[#dfe7bd] font-semibold">
              +4 marcas éticas
            </span>
          </div>
          <button
            onClick={onOpenImpactModal}
            className="flex items-center gap-1 text-[12px] font-bold text-[#cce510] hover:underline cursor-pointer"
          >
            <span>Ver impacto</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* 5. Guardados Recientes Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[18px] font-bold text-[#341011] dark:text-white">Guardados Recientes</span>
          <span className="text-[13px] text-[#673a39] dark:text-[#cce510] font-medium">
            ({savedProducts.length})
          </span>
        </div>
        <button
          onClick={onExportSaved}
          className="flex items-center gap-1 text-[#341011] dark:text-white text-[12px] font-bold px-3 py-1 rounded-full bg-white/70 dark:bg-white/10 hover:bg-white transition-all shadow-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px]">share</span>
          <span>Exportar</span>
        </button>
      </div>

      {/* 6. Product Cards List */}
      <div className="flex flex-col gap-3">
        {savedProducts.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl bg-white dark:bg-[#1f260d] p-3.5 shadow-sm flex flex-col gap-2.5 border border-[#341011]/5 dark:border-white/10 transition-all hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#f3f3f4] border border-[#341011]/5">
                <img
                  className="w-full h-full object-cover"
                  src={p.imageUrl}
                  alt={p.name}
                />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-[#586400] dark:text-[#cce510] font-extrabold truncate">
                    {p.category}
                  </span>
                  <button
                    onClick={() => onToggleBookmark(p)}
                    className="text-[#464833] hover:text-[#ba1a1a] transition-colors p-1 cursor-pointer"
                    title="Quitar de guardados"
                  >
                    <span
                      className="material-symbols-outlined text-[20px] text-[#341011] dark:text-white"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      bookmark
                    </span>
                  </button>
                </div>
                <h4 className="text-[16px] font-bold text-[#341011] dark:text-white truncate mt-0.5">
                  {p.name}
                </h4>
                <p className="text-[12px] text-[#464833] dark:text-white/60">
                  {p.brand} · {p.weight}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-[#cce510] text-[#341011] text-[10px] font-extrabold">
                    {p.statusLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#dfe7bd] text-[#181e04] text-[10px] font-bold">
                    {p.badgeLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#341011]/5 dark:border-white/10">
              <div className="flex items-baseline gap-1">
                <span className="text-[18px] font-extrabold text-[#341011] dark:text-white">
                  ${p.priceMxn.toFixed(2)}
                </span>
                <span className="text-[11px] text-[#464833] dark:text-white/60">MXN</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenFicha(p)}
                  className="h-9 px-3.5 rounded-full bg-[#cce510] text-[#341011] text-[12px] font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#bbd200] active:scale-95 transition-all cursor-pointer"
                >
                  <span>Ficha Técnica</span>
                  <span className="material-symbols-outlined text-[16px]">science</span>
                </button>
                <button
                  onClick={() => handleCartClick(p)}
                  className="w-9 h-9 rounded-full bg-[#f3f3f4] dark:bg-white/10 text-[#341011] dark:text-white flex items-center justify-center hover:bg-[#e2e2e2] active:scale-95 transition-all cursor-pointer"
                  title="Agregar a lista de compras"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    add_shopping_cart
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 7. Bottom Checklist preview tile: Lista Rápida Súper */}
      <div className="rounded-2xl p-3.5 bg-white/90 dark:bg-[#1f260d] backdrop-blur-xs flex items-center justify-between shadow-sm border border-[#341011]/5 dark:border-white/10 mt-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#d5ddb4] flex items-center justify-center text-[#341011]">
            <span className="material-symbols-outlined text-[22px]">
              checklist_rtl
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-[#341011] dark:text-white">
              Lista Rápida Súper
            </span>
            <span className="text-[12px] text-[#464833] dark:text-white/60">
              {purchasedCount} de {groceryItems.length} comprados hoy
            </span>
          </div>
        </div>
        <button
          onClick={onOpenGroceryList}
          className="h-10 px-4 rounded-full bg-[#341011] text-white text-[12px] font-bold flex items-center gap-1 hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
        >
          <span>Abrir</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
