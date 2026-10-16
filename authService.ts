/**
 * CAPA BACKEND — Autenticación con Firebase (correo + contraseña) SOLO para el panel administrativo.
 *
 *  - La sesión se guarda de forma persistente (IndexedDB): se inicia sesión UNA vez y no se vuelve a pedir.
 *  - Funciona sin internet una vez iniciada la sesión (Firebase restaura el usuario desde el almacenamiento local).
 *  - El escáner y el semáforo NO dependen de Firebase: nunca se carga para escanear.
 *  - El SDK se importa de forma diferida: no pesa en la carga inicial de la app.
 */
import type { Auth, User } from 'firebase/auth';
import { ENV, isFirebaseConfigured } from '../config/env';

let authPromise: Promise<Auth> | null = null;

async function getFirebaseAuth(): Promise<Auth> {
  if (!isFirebaseConfigured) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }
  if (!authPromise) {
    authPromise = (async () => {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence } = await import('firebase/auth');
      const app = getApps().length
        ? getApp()
        : initializeApp({
            apiKey: ENV.firebase.apiKey,
            authDomain: ENV.firebase.authDomain,
            projectId: ENV.firebase.projectId,
            appId: ENV.firebase.appId,
            storageBucket: ENV.firebase.storageBucket || undefined,
            messagingSenderId: ENV.firebase.messagingSenderId || undefined,
          });
      try {
        return initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
      } catch {
        return getAuth(app); // ya inicializado (p. ej. recarga en caliente)
      }
    })();
  }
  return authPromise;
}

/** Escucha el estado de sesión. `null` = sin sesión. Devuelve la función para dejar de escuchar. */
export async function onAdminAuthChange(callback: (user: User | null) => void): Promise<() => void> {
  const auth = await getFirebaseAuth();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, callback);
}

export async function signInAdmin(email: string, password: string): Promise<User> {
  const auth = await getFirebaseAuth();
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signOutAdmin(): Promise<void> {
  const auth = await getFirebaseAuth();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

export async function sendAdminPasswordReset(email: string): Promise<void> {
  const auth = await getFirebaseAuth();
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(auth, email.trim());
}

/** Traduce los códigos de error de Firebase a mensajes claros en español. */
export function friendlyAuthError(error: unknown): string {
  const code = String((error as { code?: string })?.code || (error as Error)?.message || '');
  if (code.includes('FIREBASE_NOT_CONFIGURED')) return 'Firebase no está configurado en esta instalación.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Correo o contraseña incorrectos.';
  if (code.includes('invalid-email')) return 'El correo no es válido.';
  if (code.includes('too-many-requests')) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  if (code.includes('network-request-failed')) return 'Sin conexión: se necesita internet SOLO para iniciar sesión la primera vez.';
  if (code.includes('operation-not-allowed')) return 'Activa "Correo/contraseña" en Firebase Authentication.';
  return 'No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.';
}
