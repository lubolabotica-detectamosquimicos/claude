import type { PaidPlan } from './entitlement.js';

/** Registro de un pago de Mercado Pago guardado en Firestore (colección "payments"). */
export interface PaymentRecord {
  paymentId: string;
  status: string;
  payerEmail: string;
  amount: number;
  currency: string;
  /** null = pago aprobado cuyo monto no corresponde a ningún plan (revisar manualmente) */
  plan: PaidPlan | null;
  approvedAt: string;
  expiresAt: string;
  updatedAt: string;
  /** veces que se reclamó (límite de dispositivos) */
  claims: number;
}

export interface PaymentStore {
  get(paymentId: string): Promise<PaymentRecord | null>;
  /** Crea o actualiza conservando el contador de reclamos existente. */
  upsert(record: Omit<PaymentRecord, 'claims'>): Promise<void>;
  incrementClaims(paymentId: string): Promise<number>;
}

/** Almacén en memoria (pruebas). */
export class MemoryPaymentStore implements PaymentStore {
  readonly data = new Map<string, PaymentRecord>();
  async get(id: string) {
    return this.data.get(id) ?? null;
  }
  async upsert(rec: Omit<PaymentRecord, 'claims'>) {
    const prev = this.data.get(rec.paymentId);
    this.data.set(rec.paymentId, { ...rec, claims: prev?.claims ?? 0 });
  }
  async incrementClaims(id: string) {
    const rec = this.data.get(id)!;
    rec.claims += 1;
    return rec.claims;
  }
}

/** Almacén real: Firestore con firebase-admin. Credenciales SOLO en variables privadas de Vercel. */
export async function createFirestoreStore(env: Record<string, string | undefined> = process.env): Promise<PaymentStore> {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

  const projectId = env.FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY en el servidor.');
  }
  const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const col = getFirestore(app).collection('payments');

  return {
    async get(id) {
      const snap = await col.doc(id).get();
      return snap.exists ? (snap.data() as PaymentRecord) : null;
    },
    async upsert(rec) {
      await col.doc(rec.paymentId).set(rec, { merge: true });
      await col.doc(rec.paymentId).set({ claims: FieldValue.increment(0) }, { merge: true });
    },
    async incrementClaims(id) {
      await col.doc(id).set({ claims: FieldValue.increment(1) }, { merge: true });
      const snap = await col.doc(id).get();
      return (snap.data()?.claims as number) ?? 1;
    },
  };
}
