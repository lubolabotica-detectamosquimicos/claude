import React, { useState } from 'react';
import { UserProfile } from '../types';
import { PLAN_PRICE_LABEL } from '../config/plans';

interface ProfileScreenProps {
  user: UserProfile;
  onOpenLegalModal: (title: string, type: 'faq' | 'terms' | 'data' | 'privacy') => void;
  onUpdateUser: (user: Partial<UserProfile>) => void;
  onOpenInicioModal?: () => void;
  onOpenAdmin?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onOpenLegalModal,
  onUpdateUser,
  onOpenInicioModal,
  onOpenAdmin,
  darkMode,
  onToggleDarkMode,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user.name);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateUser({ name: tempName.trim() });
      setIsEditingName(false);
      showToast('Perfil actualizado');
    }
  };

  const handleLogout = () => {
    if (window.confirm('¿Deseas cerrar tu sesión segura en este dispositivo?')) {
      showToast('Sesión cerrada');
      if (onOpenInicioModal) {
        setTimeout(() => {
          onOpenInicioModal();
        }, 400);
      }
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 pt-2 pb-28 gap-3">
      {/* Toast popup */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#341011] text-white text-[12px] font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-[#cce510]">
          <span className="material-symbols-outlined text-[16px] text-[#cce510]">
            check_circle
          </span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Tarjeta Principal de Usuario */}
      <div className="relative bg-white dark:bg-[#1f260d] rounded-2xl p-4 shadow-sm flex flex-col gap-3 overflow-hidden border border-[#341011]/5 dark:border-white/10">
        {/* Indicador decorativo botánico sutil */}
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-[#cce510]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3">
          {/* Avatar con insignia botánica */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden shadow-sm bg-[#f3f3f4] flex items-center justify-center border border-[#341011]/5">
              <img
                className="w-full h-full object-cover"
                src={user.avatarUrl}
                alt={user.name}
              />
            </div>
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-[#586400] rounded-full shadow-sm flex items-center justify-center text-white ring-2 ring-white">
              <span
                className="material-symbols-outlined text-[10px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                eco
              </span>
            </span>
          </div>

          {/* Datos del usuario */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="text-[16px] font-bold text-[#1a1c1c] dark:text-white border-b border-[#341011] outline-none max-w-[150px] bg-transparent"
                    autoFocus
                  />
                  <button type="submit" className="text-[12px] font-bold text-[#586400] dark:text-[#cce510] cursor-pointer">
                    OK
                  </button>
                </form>
              ) : (
                <h2 className="text-[18px] font-bold text-[#1a1c1c] dark:text-white truncate">
                  {user.name}
                </h2>
              )}
              <button
                onClick={() => setIsEditingName(!isEditingName)}
                className="p-1 rounded-full text-[#464833] dark:text-white/70 hover:text-[#1a1c1c] transition-colors cursor-pointer"
                title="Editar Nombre"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">
                  edit_note
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#cce510] text-[#341011] text-[10px] font-extrabold uppercase tracking-wide shadow-sm">
                <span
                  className="material-symbols-outlined text-[12px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
                {user.membership}
              </span>

              {/* Detalle del plan */}
              {(!user.tier || user.tier === 'free' || user.membership.toLowerCase().includes('free')) ? (
                <span className="text-[10px] text-[#464833] dark:text-white/70 font-semibold">
                  (2 escaneos/sem · Ingredientes ilimitados)
                </span>
              ) : (
                <span className="text-[10px] text-[#2A8743] dark:text-[#cce510] font-bold">
                  (Acceso Completo Ilimitado)
                </span>
              )}

              {onOpenInicioModal && (
                <button
                  type="button"
                  onClick={onOpenInicioModal}
                  className="text-[10px] font-bold text-[#586400] dark:text-[#cce510] hover:underline flex items-center gap-0.5 cursor-pointer bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full"
                  title="Cambiar plan en Formulario de Inicio"
                >
                  <span>Cambiar</span>
                  <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                </button>
              )}
            </div>

            <p className="text-[12px] text-[#464833] dark:text-white/60 mt-1 truncate">
              {user.email}
            </p>
          </div>
        </div>

        {/* Nivel de Consciencia Bioquímica */}
        <div className="bg-[#f3f3f4] dark:bg-white/5 rounded-xl p-3 flex flex-col gap-1.5 border border-[#341011]/5 dark:border-white/5">
          <div className="flex justify-between items-center text-[#1a1c1c] dark:text-white">
            <span className="text-[12px] font-bold flex items-center gap-1 text-[#341011] dark:text-[#cce510]">
              <span
                className="material-symbols-outlined text-[16px] text-[#586400] dark:text-[#cce510]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                psychiatry
              </span>
              Nivel Botica
            </span>
            <span className="text-[12px] font-bold text-[#586400] dark:text-[#cce510]">
              {user.levelPoints} pts
            </span>
          </div>
          <div className="w-full h-2 bg-[#e2e2e2] dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#cce510] transition-all duration-500 rounded-full"
              style={{ width: `${(user.levelPoints / user.maxPoints) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Métricas e Impacto Positivo (3 columnas) */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-[#1f260d] rounded-2xl p-3 shadow-sm flex flex-col items-center text-center justify-between min-h-[96px] border border-[#341011]/5 dark:border-white/10">
          <div className="w-8 h-8 rounded-full bg-[#f3f3f4] dark:bg-white/10 flex items-center justify-center text-[#341011] dark:text-white">
            <span className="material-symbols-outlined text-[18px]">
              barcode_scanner
            </span>
          </div>
          <div>
            <span className="text-[20px] font-extrabold text-[#1a1c1c] dark:text-white block leading-none">
              {user.scansCount}
            </span>
            <span className="text-[10px] font-bold text-[#464833] dark:text-white/60 block mt-1 uppercase tracking-wider">
              Escaneos
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f260d] rounded-2xl p-3 shadow-sm flex flex-col items-center text-center justify-between min-h-[96px] border border-[#341011]/5 dark:border-white/10">
          <div className="w-8 h-8 rounded-full bg-[#cce510]/60 flex items-center justify-center text-[#341011]">
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              spa
            </span>
          </div>
          <div>
            <span className="text-[20px] font-extrabold text-[#586400] dark:text-[#cce510] block leading-none">
              {user.cleanProductsCount}
            </span>
            <span className="text-[10px] font-bold text-[#464833] dark:text-white/60 block mt-1 uppercase tracking-wider">
              Prod. Limpios
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f260d] rounded-2xl p-3 shadow-sm flex flex-col items-center text-center justify-between min-h-[96px] border border-[#341011]/5 dark:border-white/10">
          <div className="w-8 h-8 rounded-full bg-[#fdbcba]/50 flex items-center justify-center text-[#835150]">
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              shield_with_heart
            </span>
          </div>
          <div>
            <span className="text-[20px] font-extrabold text-[#835150] block leading-none">
              {user.toxicsAvoidedCount}
            </span>
            <span className="text-[10px] font-bold text-[#464833] dark:text-white/60 block mt-1 uppercase tracking-wider">
              Tóxicos Evitados
            </span>
          </div>
        </div>
      </div>

      {/* Banner de Membresía (Free vs Mensual / Anual) */}
      {(!user.tier || user.tier === 'free' || user.membership.toLowerCase().includes('free')) ? (
        <div className="bg-gradient-to-r from-[#cce510]/35 via-[#cce510]/20 to-transparent border border-[#586400]/40 dark:border-[#cce510]/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#341011] text-[#cce510] flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-[12.5px] font-black text-[#341011] dark:text-white truncate">
                Mejorar a Plan Mensual o Anual
              </h4>
              <p className="text-[10.5px] text-[#464833] dark:text-white/80 leading-tight">
                {PLAN_PRICE_LABEL.monthly} (30 días) o {PLAN_PRICE_LABEL.annual} (365 días) · Escaneos ilimitados
              </p>
            </div>
          </div>
          {onOpenInicioModal && (
            <button
              type="button"
              onClick={onOpenInicioModal}
              className="px-3 py-1.5 rounded-full bg-[#341011] hover:bg-[#4a1819] text-[#cce510] text-[11px] font-extrabold flex items-center gap-1 shrink-0 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">credit_card</span>
              <span>Ver Planes</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-r from-[#2A8743]/20 via-[#cce510]/15 to-transparent border border-[#2A8743]/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#2A8743] text-white flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#2A8743] text-white">
                  Suscripción Activa
                </span>
                <span className="text-[11px] font-bold text-[#1a1c1c] dark:text-white">
                  {user.membership.includes('Aporte') ? 'Acceso por aporte voluntario / 365 días' : user.membership.includes('Anual') ? `${PLAN_PRICE_LABEL.annual} / 365 días` : `${PLAN_PRICE_LABEL.monthly} / 30 días`}
                </span>
              </div>
              <p className="text-[10.5px] text-[#464833] dark:text-white/80 mt-0.5">
                {user.membership.includes('Anual')
                  ? 'Activo por 365 días y después nuevo pago'
                  : 'Activo por 30 días y después nuevo pago'}
              </p>
            </div>
          </div>
          {onOpenInicioModal && (
            <button
              type="button"
              onClick={onOpenInicioModal}
              className="px-3 py-1.5 rounded-full bg-[#341011] hover:bg-[#4a1819] text-[#cce510] text-[11px] font-extrabold flex items-center gap-1 shrink-0 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">tune</span>
              <span>Gestionar</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Botones de Acción */}
      <div className="flex flex-col gap-2 mt-1">
        {onOpenInicioModal && (
          <button
            onClick={onOpenInicioModal}
            className="w-full h-[52px] rounded-full bg-white dark:bg-[#1f260d] hover:bg-[#cce510]/20 text-[#341011] dark:text-white font-bold text-[14px] shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] border border-[#cce510]/80 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px] text-[#586400] dark:text-[#cce510]">
              app_registration
            </span>
            <span>Formulario de Inicio (Free / Mensual / Anual)</span>
          </button>
        )}

        <button
          onClick={handleLogout}
          className="w-full h-[52px] rounded-full bg-white dark:bg-[#1f260d] hover:bg-[#ffdad6]/40 text-[#835150] font-bold text-[14px] shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] border border-[#341011]/5 dark:border-white/10 cursor-pointer"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Cerrar Sesión Segura</span>
        </button>
      </div>

      {/* 4. Pie Botánico Informativo (Links) */}
      <div className="bg-white dark:bg-[#1f260d] rounded-2xl p-3 shadow-sm flex flex-col gap-1 border border-[#cce510]/80 mt-1">
        <button
          onClick={() => onOpenLegalModal('Preguntas Frecuentes', 'faq')}
          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#f3f3f4] dark:hover:bg-white/5 transition-colors text-[#441d1d] dark:text-[#cce510] text-[12px] font-bold text-left cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#441d1d]/80 dark:text-[#cce510]">
              quiz
            </span>
            <span>Preguntas frecuentes</span>
          </span>
          <span className="material-symbols-outlined text-[16px] text-[#441d1d]/60">
            chevron_right
          </span>
        </button>
        <div className="h-[1px] bg-[#cce510]/40 mx-2" />
        <button
          onClick={() => onOpenLegalModal('Términos y Condiciones', 'terms')}
          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#f3f3f4] dark:hover:bg-white/5 transition-colors text-[#441d1d] dark:text-[#cce510] text-[12px] font-bold text-left cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#441d1d]/80 dark:text-[#cce510]">
              gavel
            </span>
            <span>Términos y condiciones</span>
          </span>
          <span className="material-symbols-outlined text-[16px] text-[#441d1d]/60">
            chevron_right
          </span>
        </button>
        <div className="h-[1px] bg-[#cce510]/40 mx-2" />
        <button
          onClick={() => onOpenLegalModal('Política de Tratamiento de Datos', 'data')}
          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#f3f3f4] dark:hover:bg-white/5 transition-colors text-[#441d1d] dark:text-[#cce510] text-[12px] font-bold text-left cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#441d1d]/80 dark:text-[#cce510]">
              database
            </span>
            <span>Política de tratamiento de datos</span>
          </span>
          <span className="material-symbols-outlined text-[16px] text-[#441d1d]/60">
            chevron_right
          </span>
        </button>
        <div className="h-[1px] bg-[#cce510]/40 mx-2" />
        <button
          onClick={() => onOpenLegalModal('Política de Privacidad', 'privacy')}
          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#f3f3f4] dark:hover:bg-white/5 transition-colors text-[#441d1d] dark:text-[#cce510] text-[12px] font-bold text-left cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#441d1d]/80 dark:text-[#cce510]">
              privacy_tip
            </span>
            <span>Política de privacidad</span>
          </span>
          <span className="material-symbols-outlined text-[16px] text-[#441d1d]/60">
            chevron_right
          </span>
        </button>
      </div>

      {onToggleDarkMode && (
        <button
          onClick={onToggleDarkMode}
          className="flex items-center justify-center gap-1.5 mx-auto px-3 py-1.5 rounded-full text-[10px] font-bold text-[#464833] dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">{darkMode ? 'light_mode' : 'dark_mode'}</span>
          {darkMode ? 'Modo claro' : 'Modo oscuro'}
        </button>
      )}
      {onOpenAdmin && (
        <button
          onClick={onOpenAdmin}
          className="flex items-center justify-center gap-1.5 mx-auto px-3 py-1.5 rounded-full text-[10px] font-bold text-[#464833] dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
          Panel administrativo
        </button>
      )}

      {/* 5. Pie de Firma y Versión */}
      <div className="text-center mt-2 pb-2 flex flex-col items-center gap-0.5">
        <span className="text-[10px] font-extrabold text-[#464833] dark:text-white/60 uppercase tracking-widest opacity-80">
          LuBo la botica · v1.0.0
        </span>
        <span className="text-[11px] text-[#464833] dark:text-white/60 opacity-70">
          Certificación Vida sin Químicos
        </span>
      </div>
    </div>
  );
};
