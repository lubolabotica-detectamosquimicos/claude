import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { Ingredient, TrafficLight } from '../types';
import { ENV, isAdminEmail, isFirebaseConfigured } from '../config/env';
import { LocalVaultService } from '../services/localVault';
import { onIngredientsUpdated, syncIngredients } from '../services/ingredientSync';
import { findDatabaseConflicts, getIngredientLight } from '../services/ingredientMatcher';
import {
  friendlyAuthError,
  onAdminAuthChange,
  sendAdminPasswordReset,
  signInAdmin,
  signOutAdmin,
} from '../services/authService';

interface Props {
  onClose: () => void;
}

const LIGHT_DOT: Record<TrafficLight, string> = { green: 'bg-[#2A8743]', yellow: 'bg-[#EBB414]', red: 'bg-[#ba1a1a]' };
const LIGHT_LABEL: Record<TrafficLight, string> = { green: 'Verde', yellow: 'Amarillo', red: 'Rojo' };

const countLights = (list: Ingredient[]) => {
  const c = { green: 0, yellow: 0, red: 0 };
  list.forEach((i) => c[getIngredientLight(i)]++);
  return c;
};

/**
 * Panel administrativo. Acceso: Firebase Auth (correo + contraseña, una sola vez) y correo en VITE_ADMIN_EMAILS.
 * Muestra el estado de la sincronización con el Excel de OneDrive (fuente única, solo lectura).
 * No edita la base: los cambios se hacen en el Excel y la app se actualiza sola.
 */
const AdminPanelModal: React.FC<Props> = ({ onClose }) => {
  const [user, setUser] = useState<User | null | undefined>(isFirebaseConfigured ? undefined : null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    onAdminAuthChange((u) => setUser(u))
      .then((fn) => (cancelled ? fn() : (unsub = fn)))
      .catch(() => setUser(null));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setAuthError(null);
    try {
      await signInAdmin(email, password);
      setPassword('');
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    }
    setBusy(false);
  };

  const handleReset = async () => {
    if (!email.trim()) return setAuthError('Escribe tu correo arriba y vuelve a pulsar "Olvidé mi contraseña".');
    try {
      await sendAdminPasswordReset(email);
      setInfo('Te enviamos un correo para restablecer la contraseña.');
      setAuthError(null);
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/65 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-[#1a220a] rounded-3xl shadow-2xl border border-[#cce510]/60 text-[#341011] dark:text-[#f3f4e8]">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#341011] to-[#4e1c1e] text-white">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#cce510] text-[20px]">admin_panel_settings</span>
            <h2 className="text-[15px] font-bold">Panel administrativo</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer" title="Cerrar">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );

  // 1) Firebase sin configurar
  if (!isFirebaseConfigured) {
    return shell(
      <div className="text-[12.5px] leading-relaxed flex flex-col gap-2">
        <p className="font-bold">Firebase no está configurado.</p>
        <p>
          Define <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_AUTH_DOMAIN</code>, <code>VITE_FIREBASE_PROJECT_ID</code> y{' '}
          <code>VITE_FIREBASE_APP_ID</code> (archivo <code>.env.local</code> en tu PC y "Environment Variables" en Vercel). Guía completa en el README.
        </p>
      </div>
    );
  }

  // 2) Cargando sesión
  if (user === undefined) return shell(<p className="text-[12.5px]">Comprobando sesión…</p>);

  // 3) Sin sesión → login (solo la primera vez)
  if (user === null) {
    return shell(
      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <p className="text-[12px] opacity-80">Inicia sesión una sola vez: el dispositivo recordará tu acceso.</p>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo del administrador"
          className="px-3.5 py-2.5 rounded-xl bg-[#f3f3f4] dark:bg-white/10 border border-[#341011]/10 text-[13px] outline-none focus:ring-2 focus:ring-[#cce510]"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="px-3.5 py-2.5 rounded-xl bg-[#f3f3f4] dark:bg-white/10 border border-[#341011]/10 text-[13px] outline-none focus:ring-2 focus:ring-[#cce510]"
        />
        {authError && <p className="text-[12px] font-semibold text-[#ba1a1a]">{authError}</p>}
        {info && <p className="text-[12px] font-semibold text-[#2A8743]">{info}</p>}
        <button type="submit" disabled={busy} className="py-3 rounded-full bg-[#341011] text-[#cce510] text-[13px] font-extrabold disabled:opacity-50 cursor-pointer">
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <button type="button" onClick={handleReset} className="text-[11px] font-bold underline opacity-70 cursor-pointer">
          Olvidé mi contraseña
        </button>
      </form>
    );
  }

  // 4) Con sesión pero sin permiso
  if (!isAdminEmail(user.email)) {
    return shell(
      <div className="flex flex-col gap-3 text-[12.5px]">
        <p className="font-bold text-[#ba1a1a]">Tu cuenta ({user.email}) no está autorizada como administradora.</p>
        {ENV.adminEmails.length === 0 && <p>No hay correos definidos en <code>VITE_ADMIN_EMAILS</code>.</p>}
        <button onClick={() => signOutAdmin()} className="py-2.5 rounded-full bg-[#341011] text-[#cce510] text-[12px] font-bold cursor-pointer">
          Cerrar sesión
        </button>
      </div>
    );
  }

  return shell(<AdminDashboard adminEmail={user.email || ''} />);
};

// ─────────────────────────────────────────────────────────────────────────────

const AdminDashboard: React.FC<{ adminEmail: string }> = ({ adminEmail }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => LocalVaultService.getIngredients());
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const meta = LocalVaultService.getSyncMetadata();
  const counts = useMemo(() => countLights(ingredients), [ingredients]);
  const conflicts = useMemo(() => findDatabaseConflicts(ingredients), [ingredients]);

  useEffect(() => onIngredientsUpdated(() => setIngredients([...LocalVaultService.getIngredients()])), []);

  const syncNow = async () => {
    setSyncing(true);
    setMessage(null);
    const r = await syncIngredients();
    setSyncing(false);
    if (r.status === 'updated') setMessage({ kind: 'ok', text: `Lista actualizada desde OneDrive: ${r.count} ingredientes.` });
    else if (r.status === 'unchanged') setMessage({ kind: 'ok', text: 'La lista ya está al día: el Excel de OneDrive no tiene cambios.' });
    else setMessage({ kind: 'error', text: r.message || 'No se pudo sincronizar.' });
  };

  const btn = 'px-3 py-2 rounded-xl text-[11.5px] font-bold cursor-pointer transition-colors';
  const btnDark = `${btn} bg-[#341011] text-[#cce510] hover:bg-black disabled:opacity-50`;

  return (
    <>
      <div className="flex items-center justify-between text-[11px]">
        <span className="opacity-70 truncate">Sesión: {adminEmail}</span>
        <button onClick={() => signOutAdmin()} className="font-bold underline cursor-pointer shrink-0 ml-2">Cerrar sesión</button>
      </div>

      {message && (
        <div className={`text-[12px] font-semibold rounded-xl px-3 py-2 ${message.kind === 'ok' ? 'bg-[#2A8743]/15 text-[#1d6130] dark:text-[#a1e687]' : 'bg-[#ba1a1a]/15 text-[#93000a] dark:text-[#ffb4ab]'}`}>
          {message.text}
        </div>
      )}

      <section className="rounded-2xl border border-[#341011]/10 dark:border-white/10 p-3.5 flex flex-col gap-1.5">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider">Base LuBo · fuente única: Excel en OneDrive</h3>
        <p className="text-[12px]"><strong>{ingredients.length}</strong> ingredientes en este dispositivo</p>
        <p className="text-[11px] opacity-80">Fuente: {meta.source}</p>
        {meta.lastSyncDate && (
          <p className="text-[11px] opacity-70">Última actualización: {new Date(meta.lastSyncDate).toLocaleString('es-CO')} · {meta.checksum}</p>
        )}
        <div className="flex gap-3 text-[12px] font-bold">
          {(['green', 'yellow', 'red'] as TrafficLight[]).map((l) => (
            <span key={l} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${LIGHT_DOT[l]}`} />{counts[l]} {LIGHT_LABEL[l]}</span>
          ))}
        </div>
        <p className="text-[11px] opacity-70 leading-snug">
          La app lee el Excel en modo solo lectura y se actualiza sola al abrirse, cada {ENV.syncMinutes} min y al recuperar la conexión.
          Para cambiar la lista, edita el Excel en OneDrive: el semáforo se actualiza solo.
        </p>
        <div>
          <button className={btnDark} onClick={syncNow} disabled={syncing}>{syncing ? 'Sincronizando…' : 'Sincronizar ahora'}</button>
        </div>
      </section>

      {conflicts.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider">Revisión del Excel ({conflicts.length})</h3>
          <p className="text-[11.5px] opacity-80 leading-snug">Estos términos apuntan a ingredientes con semáforo distinto. El motor usa el de coincidencia exacta con el nombre; conviene unificarlos en el Excel.</p>
          <ul className="text-[11.5px] list-disc pl-4 max-h-28 overflow-y-auto">
            {conflicts.slice(0, 20).map((c) => (
              <li key={c.term}><strong>{c.term}</strong>: {c.entries.map((e) => `${e.name} (${LIGHT_LABEL[e.light]})`).join(' vs ')}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};

export default AdminPanelModal;
