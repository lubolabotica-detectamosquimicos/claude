import { Ingredient, UserSession, PlanType } from '../types';
import { INITIAL_INGREDIENTS } from '../data/initialIngredients';
import { FREE_WEEKLY_CAMERA_SCANS, UNLIMITED, PLAN_DAYS } from '../config/plans';

/**
 * CAPA DE DATOS LOCAL ("backend" en el dispositivo).
 * - Sesión/suscripción y base de ingredientes personalizada, guardadas cifradas en localStorage.
 * - Cero red. La base de fábrica viaja dentro de la app (INITIAL_INGREDIENTS).
 *
 * ⚠️ Sobre el cifrado: es un cifrado ligero con una llave ALEATORIA POR DISPOSITIVO (ya no hay
 * llaves en el código). Protege contra lectura casual y contra copiar datos entre equipos, pero NO
 * es una barrera de seguridad frente a quien controla su propio navegador. Para que un plan de
 * pago no pueda auto-otorgarse hace falta verificación externa (ver README, "Verificación de pagos").
 */

const KEY_INGREDIENTS = 'lubo_vault_ingredients_enc';
const KEY_SESSION = 'lubo_vault_session_enc';
const KEY_SYNC_HASH = 'lubo_vault_sync_hash';
const KEY_SYNC_META = 'lubo_vault_sync_meta_enc';
const KEY_DEVICE = 'lubo_vault_dk';

// ── Cifrado ligero por dispositivo ───────────────────────────────────────────

function getDeviceKey(): string {
  try {
    let k = localStorage.getItem(KEY_DEVICE);
    if (!k || k.length < 32) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      k = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY_DEVICE, k);
    }
    return k;
  } catch {
    return 'lubo-volatile-key';
  }
}

function xorString(input: string): string {
  const key = getDeviceKey();
  let out = '';
  for (let i = 0; i < input.length; i++) {
    out += String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function encryptData(text: string): string {
  return btoa(xorString(encodeURIComponent(text)));
}

function decryptData(cipherText: string): string {
  try {
    return decodeURIComponent(xorString(atob(cipherText)));
  } catch {
    return '';
  }
}

function computeChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return 'LBC-' + Math.abs(hash).toString(16).toUpperCase();
}

export function getCurrentWeekKey(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

const DAY_MS = 86400000;

/** Sesión inicial de un usuario NUEVO: plan Free (antes arrancaba como "paid" y como dueño). */
function freshSession(): UserSession {
  return {
    email: '',
    tier: 'free',
    planType: 'free',
    scansUsedThisMonth: 0,
    weeklyScansUsed: 0,
    maxWeeklyScans: FREE_WEEKLY_CAMERA_SCANS,
    currentWeekKey: getCurrentWeekKey(),
    maxFreeScans: FREE_WEEKLY_CAMERA_SCANS,
    isLoggedIn: false,
    token: '',
    lastLogin: new Date().toISOString(),
  };
}

// ── Confianza en los planes de pago ──────────────────────────────────────────
// Un plan de pago solo vale si trae un derecho firmado por el servidor y verificado en este arranque.
let allowUnverifiedPaid = false; // solo desarrollo (ver config/env.ts)
let entitlementVerified = false;

// Caché en memoria: evita descifrar/parsear cientos de KB en cada tecla o render.
let ingredientsCache: Ingredient[] | null = null;
let metaCache: { lastSyncDate: string; source: string; totalCount: number; checksum: string } | null = null;

export const LocalVaultService = {
  // ── Base de ingredientes ───────────────────────────────────────────────────

  /** Base activa: la personalizada por el administrador, o si no existe, la oficial de fábrica. */
  getIngredients(): Ingredient[] {
    if (ingredientsCache) return ingredientsCache;
    try {
      const raw = localStorage.getItem(KEY_INGREDIENTS);
      if (raw) {
        const parsed = JSON.parse(decryptData(raw));
        if (Array.isArray(parsed) && parsed.length > 0) {
          ingredientsCache = parsed as Ingredient[];
          return ingredientsCache;
        }
      }
    } catch {
      /* cae a la base de fábrica */
    }
    ingredientsCache = INITIAL_INGREDIENTS;
    return ingredientsCache;
  },

  isCustomDatabase(): boolean {
    return Boolean(localStorage.getItem(KEY_INGREDIENTS));
  },

  saveIngredients(ingredients: Ingredient[], source = 'Local Vault'): boolean {
    try {
      const payload = JSON.stringify(ingredients);
      localStorage.setItem(KEY_INGREDIENTS, encryptData(payload));
      metaCache = {
        lastSyncDate: new Date().toISOString(),
        source,
        totalCount: ingredients.length,
        checksum: computeChecksum(payload),
      };
      localStorage.setItem(KEY_SYNC_META, JSON.stringify(metaCache));
      ingredientsCache = ingredients;
      return true;
    } catch (e) {
      console.error('No se pudo guardar la base de ingredientes:', e);
      return false;
    }
  },

  getSyncMetadata() {
    if (metaCache) return metaCache;
    try {
      const raw = localStorage.getItem(KEY_SYNC_META);
      if (raw && localStorage.getItem(KEY_INGREDIENTS)) {
        metaCache = JSON.parse(raw);
        return metaCache!;
      }
    } catch {
      /* usa metadatos de fábrica */
    }
    return {
      lastSyncDate: '',
      source: 'Copia de arranque incluida en la app (aún sin sincronizar con OneDrive)',
      totalCount: INITIAL_INGREDIENTS.length,
      checksum: computeChecksum(String(INITIAL_INGREDIENTS.length)),
    };
  },

  /** Hash del contenido del Excel de OneDrive sincronizado por última vez (para detectar cambios). */
  getSyncHash(): string {
    return localStorage.getItem(KEY_SYNC_HASH) || '';
  },
  setSyncHash(hash: string): void {
    localStorage.setItem(KEY_SYNC_HASH, hash);
  },

  /** Descarta la copia sincronizada y vuelve a la copia de arranque incluida en la app. */
  resetToDefaultIngredients(): Ingredient[] {
    localStorage.removeItem(KEY_SYNC_HASH);
    localStorage.removeItem(KEY_INGREDIENTS);
    localStorage.removeItem(KEY_SYNC_META);
    ingredientsCache = INITIAL_INGREDIENTS;
    metaCache = null;
    return INITIAL_INGREDIENTS;
  },

  // ── Sesión y suscripción ───────────────────────────────────────────────────

  getUserSession(): UserSession {
    const week = getCurrentWeekKey();
    try {
      const raw = localStorage.getItem(KEY_SESSION);
      if (!raw) return freshSession();
      const decrypted = decryptData(raw);
      if (!decrypted) return freshSession();
      const session: UserSession = { ...freshSession(), ...JSON.parse(decrypted) };

      if (session.currentWeekKey !== week) {
        session.currentWeekKey = week;
        session.weeklyScansUsed = 0;
        this.saveUserSession(session);
      }

      // Un plan de pago sin derecho firmado (p. ej. activado a mano) no es válido.
      if (session.tier === 'paid' && !session.entitlementToken && !allowUnverifiedPaid) {
        return this.downgradeToFree(session);
      }

      // Vencimiento del plan de pago
      if (session.tier === 'paid' && session.subscriptionExpiresAt && Date.now() > new Date(session.subscriptionExpiresAt).getTime()) {
        session.tier = 'free';
        session.planType = 'free';
        session.maxWeeklyScans = FREE_WEEKLY_CAMERA_SCANS;
        session.maxFreeScans = FREE_WEEKLY_CAMERA_SCANS;
        this.saveUserSession(session);
      }
      return session;
    } catch {
      return freshSession();
    }
  },

  downgradeToFree(session: UserSession): UserSession {
    const free: UserSession = {
      ...session,
      tier: 'free',
      planType: 'free',
      maxWeeklyScans: FREE_WEEKLY_CAMERA_SCANS,
      maxFreeScans: FREE_WEEKLY_CAMERA_SCANS,
      subscriptionActivatedAt: undefined,
      subscriptionExpiresAt: undefined,
      entitlementToken: undefined,
      entitlementPlan: undefined,
    };
    entitlementVerified = false;
    this.saveUserSession(free);
    return free;
  },

  /** Configuración de arranque (solo desarrollo permite planes sin verificar). */
  configureTrust(opts: { allowUnverifiedPaid: boolean }): void {
    allowUnverifiedPaid = opts.allowUnverifiedPaid;
  },
  setEntitlementVerified(ok: boolean): void {
    entitlementVerified = ok;
  },

  /** Activa un plan de pago a partir de un derecho YA verificado criptográficamente. */
  applyEntitlement(payload: { email: string; plan: 'monthly' | 'annual' | 'support'; iat: number; exp: number }, token: string): UserSession {
    const updated: UserSession = {
      ...this.getUserSession(),
      email: payload.email,
      tier: 'paid',
      planType: payload.plan === 'monthly' ? 'monthly' : 'annual',
      maxWeeklyScans: UNLIMITED,
      maxFreeScans: UNLIMITED,
      subscriptionActivatedAt: new Date(payload.iat * 1000).toISOString(),
      subscriptionExpiresAt: new Date(payload.exp * 1000).toISOString(),
      entitlementToken: token,
      entitlementPlan: payload.plan,
    };
    entitlementVerified = true;
    this.saveUserSession(updated);
    return updated;
  },

  saveUserSession(session: UserSession): void {
    try {
      localStorage.setItem(KEY_SESSION, encryptData(JSON.stringify(session)));
    } catch (e) {
      console.error('No se pudo guardar la sesión:', e);
    }
  },

  /** Cambia el plan. Free = 2 escaneos de cámara/semana; Mensual 30 días; Anual 365 días. */
  setSubscriptionPlan(plan: PlanType): UserSession {
    if (plan !== 'free' && !allowUnverifiedPaid) {
      throw new Error('Un plan de pago solo se activa con un pago verificado.');
    }
    const current = this.getUserSession();
    const now = Date.now();
    const updated: UserSession =
      plan === 'free'
        ? {
            ...current,
            tier: 'free',
            planType: 'free',
            maxWeeklyScans: FREE_WEEKLY_CAMERA_SCANS,
            maxFreeScans: FREE_WEEKLY_CAMERA_SCANS,
            subscriptionActivatedAt: undefined,
            subscriptionExpiresAt: undefined,
          }
        : {
            ...current,
            tier: 'paid',
            planType: plan,
            maxWeeklyScans: UNLIMITED,
            maxFreeScans: UNLIMITED,
            subscriptionActivatedAt: new Date(now).toISOString(),
            subscriptionExpiresAt: new Date(now + PLAN_DAYS[plan] * DAY_MS).toISOString(),
          };
    this.saveUserSession(updated);
    return updated;
  },

  /** ¿Puede hacer un escaneo con cámara/foto? (el texto escrito es siempre ilimitado) */
  canPerformCameraScan(): {
    allowed: boolean;
    weeklyScansUsed: number;
    maxWeeklyScans: number;
    remainingScans: number;
    reason?: string;
  } {
    const session = this.getUserSession();
    if (session.tier === 'paid' && (entitlementVerified || allowUnverifiedPaid)) {
      return { allowed: true, weeklyScansUsed: session.weeklyScansUsed || 0, maxWeeklyScans: UNLIMITED, remainingScans: UNLIMITED };
    }
    const used = session.weeklyScansUsed || 0;
    const max = FREE_WEEKLY_CAMERA_SCANS;
    if (used >= max) {
      return {
        allowed: false,
        weeklyScansUsed: used,
        maxWeeklyScans: max,
        remainingScans: 0,
        reason: `Alcanzaste el límite semanal de ${max} escaneos con cámara del Plan Free. Escribir ingredientes es ilimitado.`,
      };
    }
    return { allowed: true, weeklyScansUsed: used, maxWeeklyScans: max, remainingScans: max - used };
  },

  /** Registra UN escaneo con cámara/foto. Llamar una sola vez por escaneo exitoso. */
  incrementScanUsage(): UserSession {
    const current = this.getUserSession();
    const week = getCurrentWeekKey();
    const updated: UserSession = {
      ...current,
      currentWeekKey: week,
      weeklyScansUsed: (current.currentWeekKey === week ? current.weeklyScansUsed || 0 : 0) + 1,
      scansUsedThisMonth: (current.scansUsedThisMonth || 0) + 1,
    };
    this.saveUserSession(updated);
    return updated;
  },

  exportVault(): string {
    return JSON.stringify(
      {
        exportVersion: '3.0',
        exportedAt: new Date().toISOString(),
        metadata: this.getSyncMetadata(),
        ingredients: this.getIngredients(),
      },
      null,
      2
    );
  },
};
