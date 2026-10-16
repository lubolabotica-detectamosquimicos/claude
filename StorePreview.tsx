import React, { useState } from 'react';
import { ShoppingBag, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';
import { LUBOCLEAN_PRODUCTS } from '../data/productSuggestions';
import { ProductSuggestion } from '../types';

export const StorePreview: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cartCount, setCartCount] = useState<number>(0);
  const [purchasedItem, setPurchasedItem] = useState<string | null>(null);

  const categories = ['all', 'Cuidado Facial', 'Cuidado Capilar', 'Bálsamos y Labios'];

  const filteredProducts = selectedCategory === 'all'
    ? LUBOCLEAN_PRODUCTS
    : LUBOCLEAN_PRODUCTS.filter((p) => p.category === selectedCategory);

  const handleBuy = (prod: ProductSuggestion) => {
    setCartCount((c) => c + 1);
    setPurchasedItem(prod.name);
    setTimeout(() => {
      setPurchasedItem(null);
    }, 4000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fase 2: Sugerencias & Venta de Productos</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Catálogo Limpio & Alternativas Lubo
          </h2>
          <p className="mt-2 text-sm sm:text-base text-emerald-100/90 leading-relaxed">
            Cuando el escáner detecta ingredientes en <strong className="text-rose-300">Rojo</strong> (como sulfatos abrasivos,
            parabenos o siliconas), la app sugiere formulaciones botánicas certificadas sin tóxicos, preparando el terreno
            para la tienda de venta directa.
          </p>
        </div>
      </div>

      {/* Categories & Cart Notification */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat === 'all' ? 'Todos los Productos' : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>Carrito Lubo: {cartCount} artículos</span>
          </div>
        </div>
      </div>

      {purchasedItem && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ¡Añadido al carrito con éxito: <strong>{purchasedItem}</strong>!
          </span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Demostración interactiva</span>
        </div>
      )}

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {filteredProducts.map((prod) => (
          <div
            key={prod.id}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="relative aspect-16/10 bg-slate-100 dark:bg-slate-950 overflow-hidden">
                <img
                  src={prod.image}
                  alt={prod.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-emerald-900/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>100% Clasificación Verde</span>
                </div>
                <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white font-extrabold text-xs px-2.5 py-1 rounded-lg shadow-sm">
                  ${prod.price.toFixed(2)} {prod.currency}
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    {prod.category}
                  </span>
                  <span className="text-xs text-slate-400">Score: {prod.luboScore} / 10</span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                  {prod.name}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {prod.description}
                </p>

                {/* Replaced bad ingredients badge */}
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Sustituye tóxicos comunes:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {prod.replacedIngredients.map((ing: string, i: number) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40 line-through"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="p-5 sm:p-6 pt-0">
              <button
                onClick={() => handleBuy(prod)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-98"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Comprar / Probar Alternativa Limpia</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
