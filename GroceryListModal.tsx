import React, { useState } from 'react';
import { Product } from '../types';

interface GroceryListModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onTogglePurchased: (productId: string) => void;
  onRemoveFromList: (productId: string) => void;
  onAddCustomItem: (name: string) => void;
}

export const GroceryListModal: React.FC<GroceryListModalProps> = ({
  isOpen,
  onClose,
  products,
  onTogglePurchased,
  onRemoveFromList,
  onAddCustomItem,
}) => {
  const [newItemName, setNewItemName] = useState('');

  if (!isOpen) return null;

  const listItems = products.filter((p) => p.isInList);
  const purchasedCount = listItems.filter((p) => p.isPurchased).length;

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemName.trim()) {
      onAddCustomItem(newItemName.trim());
      setNewItemName('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a220a] rounded-t-[2rem] sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col p-5 pb-8 border border-[#341011]/10 text-[#341011] dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-[#341011]/20 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#341011]/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#341011] dark:text-[#cce510] text-[22px]">
              checklist_rtl
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-[#341011] dark:text-white">
                Lista Rápida Súper
              </h2>
              <span className="text-[11px] text-[#464833] dark:text-white/60">
                {purchasedCount} de {listItems.length} comprados
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f3f3f4] dark:bg-white/10 text-[#341011] dark:text-white flex items-center justify-center hover:bg-[#e2e2e2] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Add custom item */}
        <form onSubmit={handleAddItem} className="flex gap-2 mt-3">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Añadir producto limpio..."
            className="flex-1 bg-[#f3f3f4] dark:bg-white/10 text-[13px] px-3.5 py-2.5 rounded-full outline-none focus:ring-2 focus:ring-[#cce510] text-[#341011] dark:text-white placeholder:text-[#464833]/60"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#cce510] text-[#341011] text-[12px] font-bold rounded-full active:scale-95 cursor-pointer"
          >
            Añadir
          </button>
        </form>

        {/* Checklist */}
        <div className="flex flex-col gap-2 mt-4">
          {listItems.length === 0 ? (
            <div className="text-center py-8 text-[#464833] dark:text-white/60 text-[13px]">
              No tienes productos en tu lista de compras. Agrega desde Guardados con el botón de carrito.
            </div>
          ) : (
            listItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onTogglePurchased(item.id)}
                className={`p-3 rounded-2xl flex items-center justify-between gap-3 border transition-all cursor-pointer ${
                  item.isPurchased
                    ? 'bg-[#E8F5E9]/60 dark:bg-[#1a381f] border-[#2A8743]/30 text-gray-400 line-through'
                    : 'bg-[#f9f9f9] dark:bg-white/5 border-[#341011]/10 text-[#341011] dark:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                      item.isPurchased
                        ? 'bg-[#2A8743] border-[#2A8743] text-white'
                        : 'border-[#341011]/30 bg-white'
                    }`}
                  >
                    {item.isPurchased && (
                      <span className="material-symbols-outlined text-[15px]">
                        check
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-bold truncate">
                      {item.name}
                    </span>
                    <span className="text-[11px] opacity-75">
                      {item.brand} · ${item.priceMxn.toFixed(2)} MXN
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromList(item.id);
                  }}
                  className="p-1 rounded-full text-gray-400 hover:text-red-500 cursor-pointer"
                  title="Eliminar de la lista"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    delete
                  </span>
                </button>
              </div>
            ))
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-full bg-[#341011] text-white text-[13px] font-bold cursor-pointer"
        >
          Listo
        </button>
      </div>
    </div>
  );
};
