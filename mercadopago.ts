import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaidPlan } from './entitlement.js';

export interface MpPayment {
  id: number | string;
  status: string; // approved | pending | rejected | refunded | cancelled | charged_back ...
  transaction_amount: number;
  currency_id: string;
  date_approved?: string | null;
  payer?: { email?: string | null } | null;
}

export interface PlanConfig {
  monthlyAmount: number;
  annualAmount: number;
  /** Monto mínimo (COP) para considerar un pago como aporte voluntario */
  supportMinAmount: number;
}

export const DAYS: Record<PaidPlan, number> = { monthly: 30, annual: 365, support: 365 };

export function planConfigFromEnv(env: Record<string, string | undefined> = process.env): PlanConfig {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    monthlyAmount: n(env.PLAN_PRICE_MONTHLY, 6500),
    annualAmount: n(env.PLAN_PRICE_ANNUAL, 30000),
    supportMinAmount: n(env.SUPPORT_MIN_AMOUNT, 5000),
  };
}

/** Deduce el plan por el monto pagado (COP). Monto exacto de mensual/anual primero; el resto = aporte voluntario. */
export function detectPlan(amount: number, currency: string, cfg: PlanConfig): PaidPlan | null {
  if (currency !== 'COP') return null;
  if (amount === cfg.monthlyAmount) return 'monthly';
  if (amount === cfg.annualAmount) return 'annual';
  if (amount >= cfg.supportMinAmount) return 'support';
  return null;
}

/**
 * Verifica la firma del webhook de Mercado Pago (cabecera x-signature):
 *   manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"  →  HMAC-SHA256 con la clave secreta.
 */
export function verifyWebhookSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = opts;
  if (!xSignature) return false;
  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  );
  if (!parts.ts || !parts.v1) return false;

  let manifest = '';
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${parts.ts};`;

  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Consulta el pago real a Mercado Pago (la fuente de verdad: nunca se confía en el cuerpo del webhook). */
export async function fetchPayment(id: string, accessToken: string, fetchImpl: typeof fetch = fetch): Promise<MpPayment> {
  const res = await fetchImpl(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Mercado Pago respondió HTTP ${res.status}`);
  return (await res.json()) as MpPayment;
}
