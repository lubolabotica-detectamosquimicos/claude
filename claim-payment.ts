/**
 * POST /api/claim-payment   { email, paymentId }
 * La persona que pagó ingresa el correo con el que pagó y el número de operación del comprobante.
 * Si coincide con un pago APROBADO registrado por el webhook, se devuelve un derecho de acceso FIRMADO
 * que la app verifica localmente con la clave pública y guarda en la bóveda cifrada.
 */
import { signEntitlement, type EntitlementPayload } from './_lib/entitlement.js';
import { createFirestoreStore, type PaymentStore } from './_lib/store.js';

interface Deps {
  store?: PaymentStore;
  privateKey?: string;
  now?: () => Date;
}

const MAX_CLAIMS = 5; // reinstalaciones / dispositivos por pago
const attempts = new Map<string, { n: number; reset: number }>();

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const NOT_FOUND = 'No encontramos un pago aprobado con esos datos. Revisa el correo con el que pagaste y el número de operación.';

/** Límite simple por IP (por instancia; frena adivinanzas básicas). */
function tooManyAttempts(ip: string, nowMs: number): boolean {
  const rec = attempts.get(ip);
  if (!rec || nowMs > rec.reset) {
    attempts.set(ip, { n: 1, reset: nowMs + 10 * 60_000 });
    return false;
  }
  rec.n += 1;
  return rec.n > 10;
}

export async function handleClaim(request: Request, deps: Deps = {}): Promise<Response> {
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido' });
  const now = (deps.now ?? (() => new Date()))();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (tooManyAttempts(ip, now.getTime())) return reply(429, { error: 'Demasiados intentos. Espera unos minutos.' });

  let input: { email?: string; paymentId?: string | number };
  try {
    input = await request.json();
  } catch {
    return reply(400, { error: 'Solicitud inválida' });
  }
  const email = String(input.email ?? '').trim().toLowerCase();
  const paymentId = String(input.paymentId ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^\d{6,20}$/.test(paymentId)) {
    return reply(400, { error: 'Ingresa un correo válido y el número de operación (solo dígitos).' });
  }

  const privateKey = deps.privateKey ?? process.env.ENTITLEMENT_PRIVATE_KEY;
  if (!privateKey) return reply(500, { error: 'El servidor de pagos no está configurado.' });

  try {
    const store = deps.store ?? (await createFirestoreStore());
    const rec = await store.get(paymentId);
    // Misma respuesta para "no existe", "correo distinto" o "no aprobado": no revela qué falló.
    if (!rec || rec.status !== 'approved' || !rec.plan || rec.payerEmail !== email) return reply(404, { error: NOT_FOUND });
    if (new Date(rec.expiresAt).getTime() <= now.getTime()) {
      return reply(410, { error: 'Ese pago ya venció. Realiza un nuevo pago para renovar.' });
    }
    if (rec.claims >= MAX_CLAIMS) {
      return reply(429, { error: 'Este pago ya se activó en el máximo de dispositivos permitidos.' });
    }
    await store.incrementClaims(paymentId);

    const payload: EntitlementPayload = {
      v: 1,
      email,
      plan: rec.plan,
      pid: rec.paymentId,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(new Date(rec.expiresAt).getTime() / 1000),
    };
    return reply(200, { token: signEntitlement(payload, privateKey), plan: rec.plan, expiresAt: rec.expiresAt });
  } catch (e) {
    console.error('claim error:', (e as Error).message);
    return reply(502, { error: 'No se pudo verificar el pago en este momento. Inténtalo de nuevo.' });
  }
}

export function POST(request: Request): Promise<Response> {
  return handleClaim(request);
}
