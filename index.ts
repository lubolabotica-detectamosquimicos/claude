export type SafetyTier = 'optimal' | 'healthy' | 'caution' | 'danger';
export type TrafficLight = 'green' | 'yellow' | 'red';
/** Resultado global de un análisis: además del semáforo, 'unknown' = nada coincidió con la base LuBo. */
export type ScanStatus = TrafficLight | 'unknown';

export interface Ingredient {
  id: string;
  name: string;
  details?: string;
  tier?: SafetyTier;
  riskNote?: string;
  risks?: string;
  functionalRiskOrBenefit?: string;
  category?: 'botanical' | 'nutrient' | 'emulsifier' | 'sweetener' | 'preservative' | 'colorant' | string;
  inciName?: string;
  synonyms?: string[];
  score?: number;
  description?: string;
  recommendedAlternative?: string;
  trafficLight?: TrafficLight;
  origin?: 'natural' | 'sintético' | 'mixto';
  toxicityPercentage?: number;
  mainUse?: string;
  foundIn?: string;
  updatedAt?: string;
}

export interface MatchedIngredientResult {
  ingredient: Ingredient;
  rawMatchedSnippet: string;
  confidence: number;
}

export interface ScanAnalysis {
  rawText: string;
  timestamp: string;
  matchedIngredients: MatchedIngredientResult[];
  unrecognizedTokens: string[];
  overallStatus: ScanStatus;
  summary: {
    total: number;
    greenCount: number;
    yellowCount: number;
    redCount: number;
    unrecognizedCount: number;
    safetyScore: number;
    /** Proporción de términos de la etiqueta que SÍ están en la base LuBo (0 a 1). */
    coverage: number;
  };
  verdict: string;
}

export interface Product {
  id: string;
  upc: string;
  name: string;
  brand: string;
  category: string;
  weight: string;
  priceMxn: number;
  imageUrl: string;
  safetyScore: number; // 1.0 (pure) to 3.0 (toxic)
  overallStatus: 'clean' | 'caution' | 'danger';
  statusLabel: string;
  badgeLabel: string;
  substatusNote: string;
  warningSummary?: string;
  isSaved?: boolean;
  isInList?: boolean;
  isPurchased?: boolean;
  /** Origen del registro: catálogo de muestra, foto con cámara o texto escrito. */
  source?: 'catalog' | 'camera' | 'text';
  /** Texto analizado (cámara/texto): permite re-clasificar si la base LuBo cambia. */
  rawText?: string;
  lotNumber?: string;
  verifiedOrganic?: boolean;
  disruptorCount: number;
  ingredients: Ingredient[];
  cleanAlternative?: {
    name: string;
    brand: string;
    note: string;
  };
}

export interface ProductSuggestion {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  luboScore: number;
  is100PercentSafe: boolean;
  image: string;
  replacedIngredients: string[];
  description: string;
}

export interface HistoryEntry {
  id: string;
  productId: string;
  timestamp: string;
  dateGroup: 'today' | 'yesterday' | 'earlier';
  timeLabel: string;
  product: Product;
}

export type PlanType = 'free' | 'monthly' | 'annual';
export type SubscriptionTier = 'free' | 'paid';

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  membership: string;
  levelPoints: number;
  maxPoints: number;
  scansCount: number;
  cleanProductsCount: number;
  toxicsAvoidedCount: number;
  tier?: SubscriptionTier;
  planType?: PlanType;
  weeklyScansUsed?: number;
  maxWeeklyScans?: number;
  currentWeekKey?: string;
  subscriptionActivatedAt?: string;
  subscriptionExpiresAt?: string;
  paymentLink?: string;
}

export interface UserSession {
  email: string;
  tier: SubscriptionTier;
  planType?: PlanType;
  scansUsedThisMonth: number;
  weeklyScansUsed: number;
  maxWeeklyScans: number;
  currentWeekKey?: string;
  subscriptionActivatedAt?: string;
  subscriptionExpiresAt?: string;
  /** Derecho de acceso firmado por el servidor tras verificar el pago (ver entitlementService). */
  entitlementToken?: string;
  entitlementPlan?: 'monthly' | 'annual' | 'support';
  maxFreeScans: number;
  isLoggedIn: boolean;
  token: string;
  lastLogin: string;
}
