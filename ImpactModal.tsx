import React from 'react';

interface ImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  avoidedCount: number;
}

export const ImpactModal: React.FC<ImpactModalProps> = ({
  isOpen,
  onClose,
  avoidedCount,
}) => {
  if (!isOpen) return null;

  const avoidedChemicals = [
    {
      name: 'Jarabe de Alta Fructosa',
      effect: 'Prevención de esteatosis hepática e inflamación metabólica.',
      icon: 'science',
    },
    {
      name: 'Tartrazina (Amarillo 5)',
      effect: 'Cero colorantes sintéticos azoicos con riesgo neuroconductual.',
      icon: 'palette',
    },
    {
      name: 'TBHQ (E319)',
      effect: 'Eliminación de antioxidantes sintéticos derivados del petróleo.',
      icon: 'oil_barrel',
    },
    {
      name: 'Grasas Trans Hidrogenadas',
      effect: 'Protección cardiovascular y perfil lipídico limpio.',
      icon: 'favorite',
    },
    {
      name: 'Carragenina',
      effect: 'Preservación de la barrera intestinal y permeabilidad digestiva.',
      icon: 'spa',
    },
    {
      name: 'Sorbato y Benzoato Químico',
      effect: 'Sin conservadores agresivos en flora intestinal benéfica.',
      icon: 'shield',
    },
    {
      name: 'Glutamato Monosódico Oculto',
      effect: 'Sabor 100% derivado de hierbas, frutas y fermentos reales.',
      icon: 'nutrition',
    },
    {
      name: 'Edulcorantes Sintéticos',
      effect: 'Microbiota equilibrada sin disrupción por sucralosa o sacarina.',
      icon: 'biotech',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a220a] rounded-t-[2rem] sm:rounded-3xl w-full max-w-md max-h-[88vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col p-5 pb-8 border border-[#341011]/10 text-[#341011] dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-[#341011]/20 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#341011]/10">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[#cce510] text-[24px] bg-[#341011] p-1 rounded-full"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              eco
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-[#341011] dark:text-white">
                Despensa 100% Consciente
              </h2>
              <span className="text-[11px] text-[#586400] dark:text-[#cce510] font-bold">
                Ecosistema 0% Toxinas
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

        {/* Big impact counter */}
        <div className="p-4 rounded-2xl bg-[#341011] text-white flex items-center justify-between mt-3 shadow-md">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-[#cce510] font-extrabold">
              Impacto Acumulado
            </span>
            <span className="text-[28px] font-extrabold text-white leading-none mt-1">
              {avoidedCount}
            </span>
            <span className="text-[12px] text-[#dfe7bd] mt-0.5">
              Tóxicos y disruptores evitados
            </span>
          </div>
          <div className="w-14 h-14 rounded-full bg-[#cce510]/20 flex items-center justify-center text-[28px]">
            🌱
          </div>
        </div>

        {/* Breakdown of 8 chemicals avoided */}
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[12px] font-bold text-[#341011] dark:text-white">
            8 Químicos Reemplazados con Alternativas Botánicas:
          </span>
          <div className="flex flex-col gap-2">
            {avoidedChemicals.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-[#f9f9f9] dark:bg-white/5 border border-[#341011]/5 flex items-start gap-2.5"
              >
                <span className="w-6 h-6 rounded-full bg-[#cce510] text-[#341011] flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">
                  ✓
                </span>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-[#341011] dark:text-white">
                    {item.name}
                  </span>
                  <span className="text-[11px] text-[#464833] dark:text-white/70 leading-snug">
                    {item.effect}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-3 rounded-full bg-[#cce510] text-[#341011] text-[13px] font-bold cursor-pointer"
        >
          Continuar Comprando Limpio
        </button>
      </div>
    </div>
  );
};
