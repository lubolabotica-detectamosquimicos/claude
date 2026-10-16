/**
 * Derechos de acceso firmados (ECDSA P-256 / SHA-256).
 * El servidor FIRMA con la clave privada (variable ENTITLEMENT_PRIVATE_KEY, solo en Vercel).
 * La app VERIFICA con la clave pública (VITE_ENTITLEMENT_PUBLIC_KEY). Con la clave pública no se
 * puede fabricar un derecho: así un usuario no puede auto-otorgarse un plan editando su navegador.
 */
import { createPrivateKey, sign } from 'node:crypto';

export type PaidPlan = 'monthly' | 'annual' | 'support';

export interface EntitlementPayload {
  v: 1;
  email: string;
  plan: PaidPlan;
  /** id del pago de Mercado Pago */
  pid: string;
  /** emitido / vence (segundos Unix) */
  iat: number;
  exp: number;
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export function signEntitlement(payload: EntitlementPayload, privateKeyPem: string): string {
  const key = createPrivateKey(privateKeyPem.replace(/\\n/g, '\n'));
  const data = b64url(JSON.stringify(payload));
  const signature = sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `${data}.${b64url(signature)}`;
}
