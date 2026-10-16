/**
 * Verificación (en el dispositivo) de un derecho de acceso firmado por el servidor.
 * Módulo puro: solo Web Crypto, sin dependencias de la app (se prueba también en Node).
 */
export type PaidPlan = 'monthly' | 'annual' | 'support';

export interface EntitlementPayload {
  v: 1;
  email: string;
  plan: PaidPlan;
  pid: string;
  iat: number;
  exp: number;
}

const fromB64url = (s: string): Uint8Array<ArrayBuffer> => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Devuelve el contenido si la firma es válida y no venció; si no, null. */
export async function verifyEntitlementToken(
  token: string,
  publicKeySpkiBase64: string,
  nowMs: number = Date.now()
): Promise<EntitlementPayload | null> {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const key = await crypto.subtle.importKey(
      'spki',
      fromB64url(publicKeySpkiBase64.replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      fromB64url(sig),
      new TextEncoder().encode(data)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(data))) as EntitlementPayload;
    if (payload.v !== 1 || !payload.email || !payload.exp) return null;
    if (payload.exp * 1000 <= nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}
