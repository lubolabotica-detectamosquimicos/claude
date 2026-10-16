import { PlanType } from '../types';

/** Límites y precios del modelo de suscripción (COP). Única fuente de verdad. */
export const FREE_WEEKLY_CAMERA_SCANS = 2;
export const UNLIMITED = 999999;

export const PLAN_DAYS: Record<Exclude<PlanType, 'free'>, number> = {
  monthly: 30,
  annual: 365,
};

/** Duración del acceso que habilita el aporte voluntario. */
export const SUPPORT_ACCESS_DAYS = 365;

export const PLAN_PRICE_COP: Record<Exclude<PlanType, 'free'>, number> = {
  monthly: 6500,
  annual: 30000,
};

export const formatCop = (value: number): string =>
  `$${value.toLocaleString('es-CO')} COP`;

export const PLAN_PRICE_LABEL: Record<Exclude<PlanType, 'free'>, string> = {
  monthly: formatCop(PLAN_PRICE_COP.monthly),
  annual: formatCop(PLAN_PRICE_COP.annual),
};
