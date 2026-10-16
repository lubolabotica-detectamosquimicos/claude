/**
 * POST /api/mercadopago-webhook
 * Mercado Pago avisa aquí cada vez que cambia un pago. Flujo:
 *   1. Se valida la firma (x-signature) si viene; sin firma solo se aceptan avisos IPN "topic=payment".
 *   2. Se consulta el pago REAL a la API de Mercado Pago (no se confía en el cuerpo recibido).
 *   3. Se guarda/actualiza en Firestore (colección "payments"). Aprobado → habilita; reembolsado/anulado → revoca.
 * Responde 200 a lo que no interesa y 5xx ante fallos transitorios (Mercado Pago reintenta).
 */
import { DAYS, detectPlan, fetchPayment, planConfigFromEnv, verifyWebhookSignature, type MpPayment, type PlanConfig } from './_lib/mercadopago.js';
import { createFirestoreStore, type PaymentStore } from './_lib/store.js';

interface Deps {
  store?: PaymentStore;
  getPayment?: (id: string) => Promise<MpPayment>;
  secret?: string;
  planConfig?: PlanConfig;
  now?: () => Date;
}

const reply = (status: number, body: Record<string, unknown> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function handleWebhook(request: Request, deps: Deps = {}): Promise<Response> {
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido' });

  const url = new URL(request.url);
  const raw = await request.text();
  let body: { type?: string; topic?: string; data?: { id?: string | number } } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    /* IPN clásico puede venir sin JSON */
  }

  const type = body.type ?? body.topic ?? url.searchParams.get('type') ?? url.searchParams.get('topic');
  const dataId = String(body.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '');

  const xSignature = request.headers.get('x-signature');
  if (xSignature) {
    const secret = deps.secret ?? process.env.MP_WEBHOOK_SECRET;
    if (!secret) return reply(500, { error: 'MP_WEBHOOK_SECRET no configurada' });
    const ok = verifyWebhookSignature({ xSignature, xRequestId: request.headers.get('x-request-id'), dataId: dataId || null, secret });
    if (!ok) return reply(401, { error: 'Firma inválida' });
  } else if (url.searchParams.get('topic') !== 'payment') {
    return reply(401, { error: 'Falta la firma del webhook' });
  }

  if (type !== 'payment' || !dataId) return reply(200, { ignored: true });

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const getPayment = deps.getPayment ?? (async (id: string) => {
    if (!accessToken) throw new Error('MP_ACCESS_TOKEN no configurado');
    return fetchPayment(id, accessToken);
  });

  try {
    const payment = await getPayment(dataId);
    const store = deps.store ?? (await createFirestoreStore());
    const cfg = deps.planConfig ?? planConfigFromEnv();
    const now = (deps.now ?? (() => new Date()))();

    const approved = payment.status === 'approved';
    const plan = approved ? detectPlan(Number(payment.transaction_amount), payment.currency_id, cfg) : null;
    const approvedAt = new Date(payment.date_approved ?? now.toISOString());
    const days = plan ? DAYS[plan] : 0;

    await store.upsert({
      paymentId: String(payment.id),
      status: payment.status,
      payerEmail: (payment.payer?.email ?? '').trim().toLowerCase(),
      amount: Number(payment.transaction_amount),
      currency: payment.currency_id,
      plan,
      approvedAt: approvedAt.toISOString(),
      expiresAt: new Date(approvedAt.getTime() + days * 86400000).toISOString(),
      updatedAt: now.toISOString(),
    });
    return reply(200, { ok: true, status: payment.status, plan });
  } catch (e) {
    console.error('webhook error:', (e as Error).message);
    return reply(502, { error: 'No se pudo procesar el pago; se reintentará.' });
  }
}

export function POST(request: Request): Promise<Response> {
  return handleWebhook(request);
}
