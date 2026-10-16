/**
 * Pruebas del backend: OneDrive (solo lectura), webhook de Mercado Pago → Firestore (simulado en memoria),
 * reclamo de pago y derechos firmados. Ejecutar: npm test
 */
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadIngredientSource, shareApiUrl, SourceError } from '../api/_lib/onedrive.js';
import { handleIngredients } from '../api/ingredients.js';
import { handleWebhook } from '../api/mercadopago-webhook.js';
import { handleClaim } from '../api/claim-payment.js';
import { detectPlan, verifyWebhookSignature, planConfigFromEnv, type MpPayment } from '../api/_lib/mercadopago.js';
import { MemoryPaymentStore } from '../api/_lib/store.js';
import { verifyEntitlementToken } from '../src/services/entitlementCrypto.js';
import { OneDriveSyncService } from '../src/services/oneDriveSync.js';
import { analyzeIngredientsText } from '../src/services/ingredientMatcher.js';

let passed = 0, failed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').join('\n      ')}`); }
};

const xlsx = readFileSync(new URL('./fixtures/lubo-sample.xlsx', import.meta.url));
const okFetch = (async () => new Response(xlsx, { status: 200 })) as unknown as typeof fetch;

console.log('\n── OneDrive (solo lectura) ──');
await test('codifica el enlace compartido como u!<base64url> (API de shares)', () => {
  const u = shareApiUrl('https://1drv.ms/x/c/abc/DEF?e=xyz');
  assert.match(u, /^https:\/\/api\.onedrive\.com\/v1\.0\/shares\/u![A-Za-z0-9_-]+\/root\/content$/);
  assert.ok(!u.includes('=') && !u.includes('+'));
});
await test('descarga el .xlsx, elige la hoja correcta y lo convierte a CSV', async () => {
  const src = await loadIngredientSource('https://1drv.ms/x/c/abc/DEF?e=xyz', { fetchImpl: okFetch });
  assert.equal(src.sheet, 'Ingredientes');
  assert.equal(src.rowCount, 4);
  assert.equal(src.hash.length, 32);
});
await test('el CSV generado lo entiende el importador: colores, tildes y celdas multilínea', async () => {
  const src = await loadIngredientSource('https://x', { fetchImpl: okFetch });
  const parsed = OneDriveSyncService.parseOneDriveCsv(src.csv);
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.ingredients.map((i) => i.trafficLight), ['red', 'green', 'yellow', 'green']);
  assert.match(parsed.ingredients[1].functionalRiskOrBenefit || '', /cicatrizante\s+y calmante/);
  assert.equal(analyzeIngredientsText('Sorbato de potasio', parsed.ingredients).overallStatus, 'yellow');
});
await test('mismo contenido → mismo hash (no cambia si no cambian los datos)', async () => {
  const a = await loadIngredientSource('https://x', { fetchImpl: okFetch });
  const b = await loadIngredientSource('https://x', { fetchImpl: okFetch });
  assert.equal(a.hash, b.hash);
});
await test('solo hace GET (nunca escribe en OneDrive)', async () => {
  const methods: string[] = [];
  const spy = (async (_u: string, init?: RequestInit) => { methods.push(init?.method ?? 'GET'); return new Response(xlsx); }) as unknown as typeof fetch;
  await loadIngredientSource('https://x', { fetchImpl: spy });
  assert.deepEqual([...new Set(methods)], ['GET']);
});
await test('si el primer método falla, prueba el segundo', async () => {
  let n = 0;
  const flaky = (async () => (++n === 1 ? new Response('no', { status: 403 }) : new Response(xlsx))) as unknown as typeof fetch;
  assert.equal((await loadIngredientSource('https://x', { fetchImpl: flaky })).rowCount, 4);
});
await test('enlace privado (devuelve HTML de login) → error claro, no datos basura', async () => {
  const html = (async () => new Response('<html>login</html>', { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(() => loadIngredientSource('https://x', { fetchImpl: html }), (e: any) => e instanceof SourceError && /Cualquier persona/.test(e.message));
});
await test('GET /api/ingredients: changed:true con datos; con since igual → changed:false', async () => {
  const load = async () => loadIngredientSource('https://x', { fetchImpl: okFetch });
  const r1 = await (await handleIngredients(new Request('https://app/api/ingredients'), { sourceUrl: 'https://x', load })).json();
  assert.equal(r1.changed, true);
  assert.ok(r1.csv.includes('Tartrazina'));
  const r2 = await (await handleIngredients(new Request(`https://app/api/ingredients?since=${r1.hash}`), { sourceUrl: 'https://x', load })).json();
  assert.deepEqual([r2.changed, r2.csv], [false, undefined]);
});
await test('sin ONEDRIVE_FILE_URL → 503; POST → 405; OneDrive caído → 502', async () => {
  assert.equal((await handleIngredients(new Request('https://a/api/ingredients'), { sourceUrl: '' })).status, 503);
  assert.equal((await handleIngredients(new Request('https://a/api/ingredients', { method: 'POST' }), { sourceUrl: 'https://x' })).status, 405);
  const bad = (async () => { throw new SourceError('caído'); });
  assert.equal((await handleIngredients(new Request('https://a/api/ingredients'), { sourceUrl: 'https://x', load: bad })).status, 502);
});

console.log('\n── Firma del webhook de Mercado Pago ──');
const SECRET = 'whsec_test';
const sign = (dataId: string, reqId: string, ts: string, secret = SECRET) =>
  `ts=${ts},v1=${createHmac('sha256', secret).update(`id:${dataId.toLowerCase()};request-id:${reqId};ts:${ts};`).digest('hex')}`;
await test('firma válida se acepta; manifest con id en minúsculas', () =>
  assert.equal(verifyWebhookSignature({ xSignature: sign('ABC123', 'req-1', '1700000000'), xRequestId: 'req-1', dataId: 'ABC123', secret: SECRET }), true));
await test('firma con otro secreto / id alterado / sin firma se rechaza', () => {
  assert.equal(verifyWebhookSignature({ xSignature: sign('1', 'r', '1', 'otro'), xRequestId: 'r', dataId: '1', secret: SECRET }), false);
  assert.equal(verifyWebhookSignature({ xSignature: sign('1', 'r', '1'), xRequestId: 'r', dataId: '2', secret: SECRET }), false);
  assert.equal(verifyWebhookSignature({ xSignature: null, xRequestId: 'r', dataId: '1', secret: SECRET }), false);
});

console.log('\n── Detección de plan por monto ──');
const cfg = planConfigFromEnv({});
await test('6.500 → mensual · 30.000 → anual · otros ≥ 5.000 → aporte voluntario', () => {
  assert.equal(detectPlan(6500, 'COP', cfg), 'monthly');
  assert.equal(detectPlan(30000, 'COP', cfg), 'annual');
  assert.equal(detectPlan(20000, 'COP', cfg), 'support');
});
await test('monto bajo o moneda distinta → no habilita nada', () => {
  assert.equal(detectPlan(1000, 'COP', cfg), null);
  assert.equal(detectPlan(6500, 'USD', cfg), null);
});

console.log('\n── Webhook → Firestore → reclamo → derecho firmado ──');
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PRIV = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUB = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const NOW = new Date('2026-10-20T12:00:00Z');

const payments: Record<string, MpPayment> = {
  '551001': { id: 551001, status: 'approved', transaction_amount: 6500, currency_id: 'COP', date_approved: '2026-10-20T11:00:00Z', payer: { email: 'Ana@Correo.com' } },
  '551002': { id: 551002, status: 'approved', transaction_amount: 30000, currency_id: 'COP', date_approved: '2026-10-01T10:00:00Z', payer: { email: 'luis@correo.com' } },
  '551003': { id: 551003, status: 'approved', transaction_amount: 20000, currency_id: 'COP', date_approved: '2026-10-20T11:30:00Z', payer: { email: 'maria@correo.com' } },
  '551004': { id: 551004, status: 'pending', transaction_amount: 6500, currency_id: 'COP', payer: { email: 'pend@correo.com' } },
  '551005': { id: 551005, status: 'approved', transaction_amount: 6500, currency_id: 'COP', date_approved: '2026-08-01T11:00:00Z', payer: { email: 'viejo@correo.com' } },
};
const store = new MemoryPaymentStore();
const getPayment = async (id: string) => { if (!payments[id]) throw new Error('no existe'); return payments[id]; };
const hook = (id: string, extra: Partial<{ sig: string | null; body: unknown; query: string }> = {}) => {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-request-id': 'req-' + id };
  const sig = extra.sig === undefined ? sign(id, 'req-' + id, '1700000000') : extra.sig;
  if (sig) headers['x-signature'] = sig;
  return handleWebhook(new Request('https://app/api/mercadopago-webhook' + (extra.query ?? `?data.id=${id}&type=payment`), {
    method: 'POST', headers, body: JSON.stringify(extra.body ?? { type: 'payment', data: { id } }),
  }), { store, getPayment, secret: SECRET, planConfig: cfg, now: () => NOW });
};
const claim = (email: string, paymentId: string, ip = '9.9.9.9') =>
  handleClaim(new Request('https://app/api/claim-payment', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify({ email, paymentId }) }),
    { store, privateKey: PRIV, now: () => NOW });

await test('webhook con firma válida guarda el pago aprobado (plan mensual, correo en minúsculas)', async () => {
  const r = await hook('551001');
  assert.equal(r.status, 200);
  const rec = (await store.get('551001'))!;
  assert.deepEqual([rec.plan, rec.payerEmail, rec.status], ['monthly', 'ana@correo.com', 'approved']);
  assert.equal(rec.expiresAt, '2026-11-19T11:00:00.000Z');
});
await test('anual y aporte voluntario se registran con 365 días', async () => {
  await hook('551002'); await hook('551003');
  assert.equal((await store.get('551002'))!.plan, 'annual');
  const s = (await store.get('551003'))!;
  assert.equal(s.plan, 'support');
  assert.equal(s.expiresAt, '2027-10-20T11:30:00.000Z');
});
await test('firma falsa → 401 y NO se guarda nada', async () => {
  const r = await hook('551004', { sig: 'ts=1,v1=deadbeef' });
  assert.equal(r.status, 401);
  assert.equal(await store.get('551004'), null);
});
await test('sin firma y sin topic=payment → 401', async () => assert.equal((await hook('551004', { sig: null, query: '' })).status, 401));
await test('aviso IPN clásico (topic=payment&id=...) sin firma: se acepta y se consulta a Mercado Pago', async () => {
  const r = await hook('551005', { sig: null, query: '?topic=payment&id=551005', body: {} });
  assert.equal(r.status, 200);
  assert.equal((await store.get('551005'))!.plan, 'monthly');
});
await test('pago pendiente se guarda sin habilitar plan', async () => {
  await hook('551004');
  const rec = (await store.get('551004'))!;
  assert.deepEqual([rec.status, rec.plan], ['pending', null]);
});
await test('eventos que no son de pago se ignoran (200)', async () => {
  const r = await hook('551001', { body: { type: 'subscription_preapproval', data: { id: '551001' } }, query: '?data.id=551001&type=subscription_preapproval' });
  assert.equal((await r.json()).ignored, true);
});
await test('si Mercado Pago no responde → 502 (para que reintente)', async () => assert.equal((await hook('9999')).status, 502));

await test('RECLAMO correcto: devuelve derecho firmado que la app verifica con la clave pública', async () => {
  const r = await claim('ANA@correo.com ', '551001');
  assert.equal(r.status, 200);
  const { token, plan } = await r.json();
  assert.equal(plan, 'monthly');
  const p = await verifyEntitlementToken(token, PUB, NOW.getTime());
  assert.deepEqual([p?.email, p?.plan, p?.pid], ['ana@correo.com', 'monthly', '551001']);
});
await test('RECLAMO: correo equivocado / pago inexistente / pendiente → 404 con el mismo mensaje', async () => {
  const msgs = await Promise.all([claim('otro@correo.com', '551001'), claim('ana@correo.com', '5555555'), claim('pend@correo.com', '551004')]
    .map(async (p) => { const r = await p; return [r.status, (await r.json()).error]; }));
  assert.ok(msgs.every(([s]) => s === 404));
  assert.equal(new Set(msgs.map(([, m]) => m)).size, 1);
});
await test('RECLAMO: pago vencido → 410', async () => assert.equal((await claim('viejo@correo.com', '551005')).status, 410));
await test('RECLAMO: datos mal formados → 400', async () => {
  assert.equal((await claim('no-es-correo', '551001')).status, 400);
  assert.equal((await claim('ana@correo.com', 'abc')).status, 400);
});
await test('REEMBOLSO: si Mercado Pago avisa refunded, el acceso se revoca', async () => {
  payments['551002'] = { ...payments['551002'], status: 'refunded' };
  await hook('551002');
  assert.equal((await claim('luis@correo.com', '551002')).status, 404);
});
await test('límite de dispositivos: máximo 5 activaciones por pago', async () => {
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await claim('maria@correo.com', '551003', '1.1.1.' + i)).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
});
await test('límite por IP: tras 10 intentos → 429', async () => {
  let last = 0;
  for (let i = 0; i < 12; i++) last = (await claim('x@y.com', '123456', '7.7.7.7')).status;
  assert.equal(last, 429);
});

console.log('\n── Derechos firmados: no se pueden falsificar ──');
const good = await (await claim('ana@correo.com', '551001', '2.2.2.2')).json();
await test('token válido se verifica', async () => assert.ok(await verifyEntitlementToken(good.token, PUB, NOW.getTime())));
await test('token con el contenido alterado (plan anual) → rechazado', async () => {
  const [data, sig] = good.token.split('.');
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
  payload.plan = 'annual'; payload.exp += 99999999;
  const forged = Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + sig;
  assert.equal(await verifyEntitlementToken(forged, PUB, NOW.getTime()), null);
});
await test('token firmado con OTRA clave → rechazado', async () => {
  const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const otherPub = other.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  assert.equal(await verifyEntitlementToken(good.token, otherPub, NOW.getTime()), null);
});
await test('token vencido → rechazado', async () =>
  assert.equal(await verifyEntitlementToken(good.token, PUB, new Date('2027-01-01').getTime()), null));
await test('basura → null (no lanza)', async () => {
  assert.equal(await verifyEntitlementToken('abc', PUB), null);
  assert.equal(await verifyEntitlementToken('a.b', 'no-es-clave'), null);
});

console.log(`\n${failed === 0 ? '✅' : '❌'}  ${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed === 0 ? 0 : 1);
