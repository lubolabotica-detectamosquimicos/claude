/**
 * Acceso centralizado y tipado a las variables de entorno.
 *
 * ⚠️  IMPORTANTE — todo lo que empieza con VITE_ termina DENTRO del JavaScript que se
 *     descarga en el navegador, es decir, es PÚBLICO. Aquí solo van valores públicos por
 *     diseño (config web de Firebase, enlaces de pago, correos de administrador).
 *     NUNCA pongas aquí: claves de servicio / Admin SDK de Firebase, tokens de Mercado Pago,
 *     claves de Gemini u otras API privadas. Esas, si algún día se usan, van en una
 *     función de servidor (Vercel Functions) con variables SIN prefijo VITE_.
 */

const read = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const ENV = {
  firebase: {
    apiKey: read(import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: read(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: read(import.meta.env.VITE_FIREBASE_PROJECT_ID),
    appId: read(import.meta.env.VITE_FIREBASE_APP_ID),
    storageBucket: read(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: read(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  },

  /** Correos autorizados para ver el Panel Administrativo (separados por coma). */
  adminEmails: read(import.meta.env.VITE_ADMIN_EMAILS)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  /** Clave PÚBLICA (SPKI base64) para verificar los derechos de acceso firmados por el servidor. */
  entitlementPublicKey: read(import.meta.env.VITE_ENTITLEMENT_PUBLIC_KEY),

  /** Cada cuántos minutos la app revisa si el Excel de OneDrive cambió. */
  syncMinutes: Math.max(1, Number(read(import.meta.env.VITE_SYNC_INTERVAL_MINUTES)) || 10),

  /** SOLO desarrollo (npm run dev): permite activar planes sin pago para probar la interfaz. */
  allowUnverifiedPlans: import.meta.env.DEV && read(import.meta.env.VITE_DEV_ALLOW_UNVERIFIED_PLANS) === 'true',

  /** Enlaces de pago. Si no se definen, se usan los enlaces oficiales actuales de LuBo. */
  paymentLinks: {
    monthly: read(import.meta.env.VITE_PAYMENT_LINK_MONTHLY) || 'https://mpago.li/1TxnQQk',
    annual: read(import.meta.env.VITE_PAYMENT_LINK_ANNUAL) || 'https://mpago.li/1uCi2kF',
    support:
      read(import.meta.env.VITE_PAYMENT_LINK_SUPPORT) ||
      'https://link.mercadopago.com.co/graciasporayudarnos',
  },
} as const;

/** True si están las 4 variables mínimas de Firebase Auth. */
export const isFirebaseConfigured: boolean =
  Boolean(ENV.firebase.apiKey) &&
  Boolean(ENV.firebase.authDomain) &&
  Boolean(ENV.firebase.projectId) &&
  Boolean(ENV.firebase.appId);

/** ¿Están configurados los pagos verificados? (clave pública de firma) */
export const isPaymentsConfigured: boolean = Boolean(ENV.entitlementPublicKey);

export const isAdminEmail = (email?: string | null): boolean =>
  Boolean(email) && ENV.adminEmails.includes(String(email).trim().toLowerCase());
