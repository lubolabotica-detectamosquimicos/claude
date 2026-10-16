import { Ingredient, Product, ScanAnalysis } from '../types';
import { analyzeIngredientsText, getFunctionalRiskOrBenefit, getIngredientLight } from './ingredientMatcher';
import { LocalVaultService } from './localVault';

/**
 * Convierte un análisis (texto escrito u OCR de foto) en la ficha `Product` que usa toda la UI.
 * Única fuente de esta lógica (antes estaba duplicada en ScanScreen y en la cámara).
 */

const STATUS_COLOR = { danger: '#ba1a1a', caution: '#EBB414', clean: '#2A8743' } as const;

/** Imagen de respaldo 100% local (SVG en data-URI): sin peticiones a internet. */
function placeholderImage(status: keyof typeof STATUS_COLOR): string {
  const c = STATUS_COLOR[status];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="#341011"/><circle cx="160" cy="160" r="86" fill="${c}"/><circle cx="160" cy="160" r="60" fill="none" stroke="#341011" stroke-width="10" opacity=".35"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface BuildOptions {
  source: 'camera' | 'text';
  /** Nombre visible (por defecto: el texto analizado, recortado). */
  name?: string;
  /** Miniatura de la foto (solo cámara). */
  thumbnail?: string;
}

export function buildProductFromAnalysis(analysis: ScanAnalysis, opts: BuildOptions): Product {
  const status = analysis.overallStatus;
  const isRed = status === 'red';
  const isYellow = status === 'yellow';
  const isUnknown = status === 'unknown';
  const key: keyof typeof STATUS_COLOR = isRed ? 'danger' : isYellow || isUnknown ? 'caution' : 'clean';
  const total = LocalVaultService.getIngredients().length;
  const trimmed = analysis.rawText.replace(/\s+/g, ' ').trim();
  const defaultName = opts.source === 'camera' ? 'Etiqueta escaneada' : trimmed.length > 40 ? trimmed.slice(0, 40) + '...' : trimmed;

  return {
    id: `scanned-${opts.source}-${Date.now()}`,
    upc: `LBC-${opts.source === 'camera' ? 'CAM' : 'DIR'}-${Date.now().toString().slice(-6)}`,
    name: opts.name || defaultName || 'Consulta',
    brand: opts.source === 'camera' ? 'Escaneo de etiqueta LuBo' : 'Evaluación On-Device LuBo',
    category: analysis.matchedIngredients[0]?.ingredient.category || 'Consulta Directa',
    weight: `${analysis.summary.total} compuesto(s) analizado(s)`,
    priceMxn: 0,
    imageUrl: opts.thumbnail || placeholderImage(key),
    safetyScore: isRed ? 3.0 : isYellow ? 2.0 : isUnknown ? 2.0 : 1.0,
    overallStatus: key,
    statusLabel: isRed ? 'NO CONSUMIR / Tóxico' : isYellow ? 'PRECAUCIÓN / Aditivos' : isUnknown ? 'SIN COINCIDENCIAS EN BASE LUBO' : 'LIMPIO / Seguro',
    badgeLabel: isRed ? 'Semáforo Rojo' : isYellow ? 'Semáforo Amarillo' : isUnknown ? 'Semáforo Pendiente' : 'Semáforo Verde',
    substatusNote: isRed ? 'Semáforo Rojo' : isYellow ? 'Semáforo Amarillo' : isUnknown ? 'Semáforo Pendiente' : 'Semáforo Verde',
    warningSummary: analysis.verdict,
    lotNumber: `Evaluación local · Base LuBo (${total} ingredientes)`,
    verifiedOrganic: status === 'green',
    disruptorCount: analysis.summary.redCount,
    isSaved: false,
    isInList: false,
    isPurchased: false,
    source: opts.source,
    rawText: analysis.rawText,
    ingredients: isUnknown
      ? [
          {
            id: 'unrec-1',
            name: trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed || 'Consulta',
            details: 'Término no catalogado en la base oficial LuBo. Puedes agregarlo desde el Panel Administrativo.',
            tier: 'caution' as const,
          },
        ]
      : analysis.matchedIngredients.map((m, idx) => {
      const light = getIngredientLight(m.ingredient);
      return {
        id: `dyn-ing-${idx}`,
        name: m.ingredient.name,
        details: getFunctionalRiskOrBenefit(m.ingredient),
        functionalRiskOrBenefit: getFunctionalRiskOrBenefit(m.ingredient),
        tier: m.ingredient.tier || (light === 'red' ? 'danger' : light === 'yellow' ? 'caution' : 'optimal'),
        category: (m.ingredient.category as any) || 'botanical',
        trafficLight: light,
      };
    }),
  };
}

/**
 * Recalcula el semáforo de un producto ya guardado con la base LuBo ACTUAL (p. ej. tras cambios en el Excel).
 * Conserva identidad, favoritos, lista de compras y miniatura. Los productos de muestra (sin texto) no cambian.
 */
export function reclassifyProduct(product: Product, database: Ingredient[]): Product {
  if (!product.rawText || (product.source !== 'camera' && product.source !== 'text')) return product;
  const fresh = buildProductFromAnalysis(analyzeIngredientsText(product.rawText, database), {
    source: product.source,
    name: product.name,
    thumbnail: product.source === 'camera' ? product.imageUrl : undefined,
  });
  return {
    ...fresh,
    id: product.id,
    upc: product.upc,
    isSaved: product.isSaved,
    isInList: product.isInList,
    isPurchased: product.isPurchased,
  };
}
