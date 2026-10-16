import React from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'faq' | 'terms' | 'data' | 'privacy';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  title,
  type,
}) => {
  if (!isOpen) return null;

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

        <div className="flex items-center justify-between pb-3 border-b border-[#341011]/10">
          <h2 className="text-[17px] font-bold text-[#341011] dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f3f3f4] dark:bg-white/10 text-[#341011] dark:text-white flex items-center justify-center hover:bg-[#e2e2e2] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="mt-4 text-[13px] text-[#464833] dark:text-white/80 leading-relaxed flex flex-col gap-3">
          {type === 'faq' && (
            <>
              <div>
                <h4 className="font-bold text-[#341011] dark:text-[#cce510]">¿Cómo detecta LuBo los químicos tóxicos?</h4>
                <p>
                  Nuestro sensor bio-espectral analiza el código UPC y coteja la lista de ingredientes contra bases toxicológicas de la EFSA, FDA y normativas botánicas orgánicas mexicanas.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#341011] dark:text-[#cce510]">¿Qué significa cada nivel del semáforo?</h4>
                <p>
                  Verde (Limpio): Ingredientes puros de origen botánico sin disruptores. Amarillo (Precaución): Aditivos procesados moderados. Rojo (No Consumir): Químicos prohibidos, carcinógenos sospechosos o colorantes azoicos.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#341011] dark:text-[#cce510]">¿Cómo gano puntos en Nivel Botica?</h4>
                <p>
                  Cada vez que escaneas un producto en el supermercado y eliges una alternativa limpia acumulas puntos de consciencia bio-química.
                </p>
              </div>
            </>
          )}

          {type === 'terms' && (
            <>
              <p>
                <strong>Términos de Servicio:</strong> LuBo la botica es un software informativo para decisiones de compra consciente. No sustituye asesoría médica, alergológica o farmacológica.
              </p>
              <p>
                Los fabricantes pueden alterar formulaciones sin previo aviso. Siempre verifique la etiqueta física del empaque antes de ingerir en caso de alergias severas.
              </p>
            </>
          )}

          {type === 'data' && (
            <>
              <p>
                <strong>Tratamiento de Datos:</strong> Sus hábitos de escaneo se procesan localmente en su dispositivo de manera privada y anónima. No comercializamos su historial con anunciantes de alimentos procesados.
              </p>
              <p>
                La cámara sólo se activa durante el encuadre activo del código de barras y ninguna transmisión de video continuo se almacena en la nube.
              </p>
            </>
          )}

          {type === 'privacy' && (
            <>
              <p>
                <strong>Aviso de Privacidad:</strong> Cumplimos estrictamente con los estándares internacionales de privacidad y la legislación mexicana en protección de datos personales.
              </p>
              <p>
                Usted puede exportar o eliminar todo su historial de análisis en cualquier momento desde la pestaña Historial.
              </p>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 rounded-full bg-[#cce510] text-[#341011] text-[13px] font-bold cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
