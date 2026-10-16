/**
 * Pagos verificados: Mercado Pago → webhook → Firebase (servidor) → derecho firmado → bóveda local.
 *
 *  1. La persona paga con el enlace de Mercado Pago.
 *  2. El webhook (servidor) registra el pago aprobado en Firestore.
 *  3. La persona ingresa su correo + número de operación → /api/claim-payment devuelve un derecho FIRMADO.
 *  4. La app lo verifica con la clave pública y lo guarda en la bóveda local cifrada.
 *  Sin derecho firmado válido, un plan de pago NO se activa (no hay manera de auto-otorgárselo).
 */
import { ENV, isPaymentsConfigured } from '../config/env';
import { LocalVaultService } from './localVault';
import { verifyEntitlementToken, type PaidPlan } from './entitlementCrypto';

export type ClaimResult =
  | { ok: true; plan: PaidPlan; expiresAt: string; email: string }
  | { ok: false; message: string };

/** Al arrancar: verifica el derecho guardado (firma + vencimiento). Si no es válido, vuelve a Free. */
export async function initEntitlements(): Promise<void> {
  LocalVaultService.configureTrust({ allowUnverifiedPaid: ENV.allowUnverifiedPlans });
  const session = LocalVaultService.getUserSession();
  if (session.tier !== 'paid' || ENV.allowUnverifiedPlans) return;

  const payload =
    session.entitlementToken && isPaymentsConfigured
      ? await verifyEntitlementToken(session.entitlementToken, ENV.entitlementPublicKey)
      : null;
  if (payload) LocalVaultService.setEntitlementVerified(true);
  else LocalVaultService.downgradeToFree(session);
}

/** Convierte "correo + número de operación" en un plan activo (si el pago está aprobado en el servidor). */
export async function claimPayment(email: string, paymentId: string): Promise<ClaimResult> {
  if (!isPaymentsConfigured) {
    return { ok: false, message: 'Los pagos verificados aún no están configurados en esta instalación.' };
  }
  try {
    const res = await fetch('/api/claim-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, paymentId: paymentId.replace(/\D/g, '') }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: body?.error || 'No se pudo verificar el pago.' };

    const payload = await verifyEntitlementToken(body.token, ENV.entitlementPublicKey);
    if (!payload) return { ok: false, message: 'La respuesta del servidor no es válida. Contacta a soporte.' };

    LocalVaultService.applyEntitlement(payload, body.token);
    return { ok: true, plan: payload.plan, expiresAt: new Date(payload.exp * 1000).toISOString(), email: payload.email };
  } catch {
    return { ok: false, message: 'Sin conexión con el servidor de pagos. Inténtalo de nuevo con internet.' };
  }
}
