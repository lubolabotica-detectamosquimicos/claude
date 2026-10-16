import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { 
  verifyWebhookSignature, 
  fetchPayment, 
  planConfigFromEnv, 
  detectPlan 
} from '../src/mercadopago-utils.js'; // Ajusta la ruta a donde tengas las funciones auxiliares

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' 
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Configuración de CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Signature, X-Request-ID, Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ---------------------------------------------------------------------------
  // RUTA A: Crear Preferencia de Pago (Llamado desde tu Frontend)
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && req.body?.action === 'create_preference') {
    try {
      const { planType, userEmail } = req.body;
      const cfg = planConfigFromEnv();

      let amount = cfg.monthlyAmount;
      let title = 'Suscripción Mensual - LuBo';

      if (planType === 'annual') {
        amount = cfg.annualAmount;
        title = 'Suscripción Anual - LuBo';
      } else if (planType === 'support') {
        amount = cfg.supportMinAmount;
        title = 'Aporte Voluntario - LuBo';
      }

      const preference = new Preference(client);
      const result = await preference.create({
        body: {
          items: [
            {
              id: planType || 'monthly',
              title: title,
              quantity: 1,
              unit_price: amount,
              currency_id: 'COP',
            },
          ],
          payer: userEmail ? { email: userEmail } : undefined,
          back_urls: {
            success: `${req.headers.origin || 'https://tudominio.com'}/success`,
            failure: `${req.headers.origin || 'https://tudominio.com'}/failure`,
            pending: `${req.headers.origin || 'https://tudominio.com'}/pending`,
          },
          auto_return: 'approved',
          notification_url: `${req.headers.host ? `https://${req.headers.host}` : ''}/api/mercadopago`,
        }
      });

      return res.status(200).json({
        id: result.id,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point
      });

    } catch (error: any) {
      console.error('Error al crear preferencia:', error);
      return res.status(500).json({ error: error.message || 'Error interno' });
    }
  }

  // ---------------------------------------------------------------------------
  // RUTA B: Webhook / Notificaciones (Llamado automáticamente por Mercado Pago)
  // ---------------------------------------------------------------------------
  if (req.method === 'POST') {
    try {
      const xSignature = req.headers['x-signature'] as string || null;
      const xRequestId = req.headers['x-request-id'] as string || null;
      const webhookSecret = process.env.MP_WEBHOOK_SECRET || '';

      const topic = req.query.topic || req.body?.type;
      const dataId = req.query['data.id'] || req.body?.data?.id;

      // Validar firma del webhook si configuraste un secreto
      if (webhookSecret && xSignature) {
        const isValid = verifyWebhookSignature({
          xSignature,
          xRequestId,
          dataId: dataId ? String(dataId) : null,
          secret: webhookSecret,
        });

        if (!isValid) {
          console.warn('Firma de webhook inválida');
          return res.status(401).json({ error: 'Firma inválida' });
        }
      }

      // Procesar si es una notificación de pago
      if (topic === 'payment' && dataId) {
        const paymentId = String(dataId);
        
        // Consultar la fuente de verdad en MP
        const payment = await fetchPayment(paymentId, process.env.MERCADOPAGO_ACCESS_TOKEN || '');

        if (payment.status === 'approved') {
          const cfg = planConfigFromEnv();
          const plan = detectPlan(payment.transaction_amount, payment.currency_id, cfg);
          const payerEmail = payment.payer?.email;

          // TODO: Aquí actualizas la base de datos (Firebase) para activar el plan al usuario
          console.log(`Pago aprobado ${paymentId} por ${payment.transaction_amount} COP. Plan detectado:`, plan, 'Usuario:', payerEmail);
        }
      }

      return res.status(200).json({ received: true });

    } catch (error: any) {
      console.error('Error procesando webhook:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  res.setHeader('Allow', ['POST']);
  return res.status(405).json({ error: `Método ${req.method} no permitido` });
}
