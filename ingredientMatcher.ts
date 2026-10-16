import {
  Ingredient,
  MatchedIngredientResult,
  ScanAnalysis,
  ScanStatus,
  TrafficLight,
} from '../types';

/**
 * CAPA DE PROCESAMIENTO — Motor de clasificación LuBo.
 *
 * Reglas de oro:
 *  1. NUNCA llama a la red ni a bases de datos externas: solo lee la lista `database` que recibe
 *     (la base maestra LuBo, que vive en el dispositivo).
 *  2. El semáforo sale ÚNICAMENTE de la clasificación de esa lista.
 *  3. Si nada coincide, el resultado es 'unknown' (NUNCA verde por omisión).
 *  4. Coincidencia por PALABRA COMPLETA: "Sal" no coincide con "Salicylic", "tea" no coincide
 *     con "Steareth", etc. (la versión anterior usaba subcadenas y generaba falsos verdes/rojos).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Normalización
// ─────────────────────────────────────────────────────────────────────────────

/** minúsculas, sin tildes, sin espacios sobrantes */
export function normalizeText(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Quita una "s" final (plural simple) para que "colorantes" ≈ "colorante". Se aplica a ambos lados. */
const stemWord = (w: string): string =>
  w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;

/**
 * Forma canónica para comparar: sin tildes/puntuación, "E 330"/"E-330" → "e330", plural simple.
 * Ej.: "Sodium Laureth Sulfate (SLES)" → "sodium laureth sulfate sles"
 */
function toWords(text?: string): string {
  const n = normalizeText(text)
    .replace(/\be[\s-]?(\d{3,4}[a-z]?)\b/g, 'e$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return n ? n.split(' ').map(stemWord).join(' ') : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Semáforo helpers
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY: Record<TrafficLight, number> = { green: 1, yellow: 2, red: 3 };

/** Semáforo de un ingrediente según la base (trafficLight, o su tier si falta). */
export function getIngredientLight(ing: Partial<Ingredient>): TrafficLight {
  if (ing.trafficLight) return ing.trafficLight;
  if (ing.tier === 'optimal' || ing.tier === 'healthy') return 'green';
  if (ing.tier === 'caution') return 'yellow';
  return 'red';
}

// ─────────────────────────────────────────────────────────────────────────────
// Índice de búsqueda (se construye 1 vez por lista y se cachea)
// ─────────────────────────────────────────────────────────────────────────────

type TermKind = 'name' | 'inci' | 'syn' | 'variant';

interface IndexedTerm {
  ing: Ingredient;
  words: string; // forma canónica
  padded: string; // ' ' + words + ' ' para buscar palabra completa
  kind: TermKind;
  confidence: number;
  /** true = solo cuenta si el token es EXACTAMENTE este término (no por contención) */
  exactOnly: boolean;
}

interface SearchIndex {
  terms: IndexedTerm[];
  exact: Map<string, IndexedTerm[]>;
}

const CONFIDENCE: Record<TermKind, number> = { name: 1.0, inci: 1.0, syn: 0.95, variant: 0.93 };
const CONTAIN_CONFIDENCE: Record<TermKind, number> = { name: 0.85, inci: 0.88, syn: 0.82, variant: 0.8 };

/**
 * Términos "comodín" de UNA sola palabra: son prefijos genéricos (catión) que aparecen en cientos
 * de ingredientes distintos ("Sodium Hyaluronate", "Sodium PCA"...). Solo cuentan si el token es
 * exactamente esa palabra. Editable si el dueño ajusta su lista.
 */
export const EXACT_ONLY_WORDS: ReadonlySet<string> = new Set(['sodium', 'ammonium']);

/** Siglas cortas (≤3) que SÍ pueden aparecer dentro de un nombre largo, p. ej. "PEG-40 Hydrogenated…". */
const SHORT_CONTAINMENT_ALLOWLIST: ReadonlySet<string> = new Set(['peg', 'ppg']);

const indexCache = new WeakMap<Ingredient[], SearchIndex>();

function isExactOnly(words: string): boolean {
  if (words.includes(' ')) return false; // frases de 2+ palabras: sí pueden contenerse
  if (EXACT_ONLY_WORDS.has(words)) return true;
  if (words.length <= 3) return !SHORT_CONTAINMENT_ALLOWLIST.has(words);
  return false;
}

/** Variantes útiles de un nombre con paréntesis: "Limón (zumo/cáscara)" → "Limón"; siglas internas. */
function extractVariants(raw: string): string[] {
  if (!raw.includes('(')) return [];
  const out: string[] = [];
  const outer = raw.replace(/\([^)]*\)/g, ' ').trim();
  if (outer) out.push(outer);
  for (const m of raw.matchAll(/\(([^)]*)\)/g)) {
    for (const part of m[1].split(/[,;/]/)) {
      const p = part.trim();
      // solo alias reales: siglas en MAYÚSCULAS (BPA, PFOA) o con dígitos (Rojo N°3, 1,4-dioxane)
      if (p.length >= 3 && (/^[A-Z0-9][A-Z0-9\s-]*$/.test(p) || /\d/.test(p))) out.push(p);
    }
  }
  return out;
}

const balanced = (t: string) => (t.match(/\(/g) || []).length === (t.match(/\)/g) || []).length;

/**
 * Calificadores genéricos que aparecen entre paréntesis en los nombres de la base ("Coco (pulpa/agua)",
 * "Aloe vera (gel)") y que al convertir el Excel quedaron como sinónimos. Por sí solos NO identifican un
 * ingrediente ("Agua" no es Coco, "Gel" no es Aloe), así que no se indexan. Los alias reales entre
 * paréntesis (shea, cochinilla, polietileno…) sí se conservan. Editable si el dueño ajusta su lista.
 */
const GENERIC_QUALIFIERS: ReadonlySet<string> = new Set(
  [
    'agua', 'pulpa', 'semilla', 'semillas', 'extracto', 'gel', 'polvo', 'fruta', 'hoja', 'hojas', 'vegetal',
    'zumo', 'jugo', 'cascara', 'colorante', 'especia', 'resina', 'brotes', 'sales', 'clorhidrato', 'natural',
    'raiz', 'flor', 'flores', 'corteza', 'tallo', 'grano', 'granos', 'fibra', 'harina', 'aceite',
  ].map((w) => toWords(w))
);

/** Fragmentos genéricos de un nombre compuesto que no deben indexarse como sinónimos. */
function qualifierFragments(ing: Ingredient): Set<string> {
  const frags = new Set<string>();
  for (const raw of [ing.name, ing.inciName]) {
    if (!raw || !/[(/]/.test(raw)) continue;
    const pieces: string[] = [];
    for (const m of raw.matchAll(/\(([^)]*)\)/g)) pieces.push(...m[1].split(/[,;/]/));
    pieces.push(...raw.replace(/\([^)]*\)/g, ' ').split('/'));
    for (const piece of pieces) {
      const w = toWords(piece);
      if (w && GENERIC_QUALIFIERS.has(w)) frags.add(w);
    }
  }
  return frags;
}

function buildIndex(database: Ingredient[]): SearchIndex {
  const terms: IndexedTerm[] = [];
  const exact = new Map<string, IndexedTerm[]>();

  const add = (ing: Ingredient, raw: string | undefined, kind: TermKind) => {
    if (!raw) return;
    const words = toWords(raw);
    if (words.length < 2) return;
    const term: IndexedTerm = {
      ing,
      words,
      padded: ` ${words} `,
      kind,
      confidence: CONFIDENCE[kind],
      exactOnly: isExactOnly(words),
    };
    terms.push(term);
    const bucket = exact.get(words);
    if (bucket) bucket.push(term);
    else exact.set(words, [term]);
  };

  for (const ing of database) {
    add(ing, ing.inciName, 'inci');
    add(ing, ing.name, 'name');
    const junk = qualifierFragments(ing);
    for (const syn of ing.synonyms || []) {
      if (!balanced(syn) || junk.has(toWords(syn))) continue; // fragmento basura, no es un sinónimo real
      add(ing, syn, 'syn');
    }
    for (const raw of [ing.name, ing.inciName]) {
      for (const v of extractVariants(raw || '')) add(ing, v, 'variant');
    }
  }
  return { terms, exact };
}

function getIndex(database: Ingredient[]): SearchIndex {
  let idx = indexCache.get(database);
  if (!idx) {
    idx = buildIndex(database);
    indexCache.set(database, idx);
  }
  return idx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokenización
// ─────────────────────────────────────────────────────────────────────────────

const HEADING_RE =
  /(?:ingredientes|ingredients?|composici[oó]n|composition|inci|contenido|contiene|contains|may contain|puede contener|trazas de)\s*[:：]/gi;

/** Divide por separadores respetando paréntesis (no corta "Emulsificante (E471, lecitina)"). */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;•·|\n\r]/.test(ch)) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

/**
 * Divide texto pegado u OCR en ingredientes candidatos.
 * - OCR parte líneas al azar: si hay comas/; el salto de línea es un espacio, no un separador.
 * - Quita encabezados ("INGREDIENTES:", "COMPOSICIÓN:") y porcentajes ("2%", "0,5 %").
 */
export function tokenizeIngredientText(rawText: string): string[] {
  let text = rawText
    .replace(HEADING_RE, ' ')
    .replace(/-\s*[\r\n]+\s*/g, '-') // guion de corte de línea del OCR
    .replace(/(\d),(\d)/g, '$1.$2'); // coma decimal ("0,5 %") no es separador de ingredientes

  if (/[,;•·|]/.test(text)) {
    text = text.replace(/[\r\n]+/g, ' '); // lista con comas: los saltos son cortes de línea del OCR
  } else {
    text = text.replace(/[\r\n]+/g, ','); // un ingrediente por línea
  }

  const tokens: string[] = [];
  for (const part of splitTopLevel(text)) {
    let token = part
      .replace(/\d+(?:[.,]\d+)?\s*%/g, '')
      .replace(/\(\s*\)/g, '') // paréntesis que quedaron vacíos al quitar el %
      .replace(/\s+/g, ' ')
      .trim();
    token = token.replace(/^[.*\-–_—:]+|[.*\-–_—:]+$/g, '').trim();
    if (token.length >= 2 && !/^[\d\s.,()%]+$/.test(token)) tokens.push(token);
  }
  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coincidencia
// ─────────────────────────────────────────────────────────────────────────────

function pickBest(candidates: IndexedTerm[], byContainment: boolean): IndexedTerm {
  return candidates.reduce((best, cur) => {
    const bc = byContainment ? CONTAIN_CONFIDENCE[best.kind] : best.confidence;
    const cc = byContainment ? CONTAIN_CONFIDENCE[cur.kind] : cur.confidence;
    if (byContainment && cur.words.length !== best.words.length) {
      return cur.words.length > best.words.length ? cur : best; // más específico gana
    }
    if (cc !== bc) return cc > bc ? cur : best;
    // empate: gana el más severo (criterio conservador de seguridad)
    return SEVERITY[getIngredientLight(cur.ing)] > SEVERITY[getIngredientLight(best.ing)] ? cur : best;
  });
}

/**
 * Busca UN token en la base interna. Nunca usa red.
 * Orden: 1) exacto  2) la base contiene el término como palabra(s) completa(s) dentro del token.
 */
export function matchSingleToken(token: string, database: Ingredient[]): MatchedIngredientResult | null {
  const words = toWords(token);
  if (words.length < 2) return null;
  const idx = getIndex(database);

  const exactHits = idx.exact.get(words);
  if (exactHits && exactHits.length > 0) {
    const best = pickBest(exactHits, false);
    return { ingredient: best.ing, rawMatchedSnippet: token, confidence: best.confidence };
  }

  const padded = ` ${words} `;
  const hits: IndexedTerm[] = [];
  for (const t of idx.terms) {
    if (t.exactOnly) continue;
    if (padded.includes(t.padded)) hits.push(t);
  }
  if (hits.length === 0) return null;
  const best = pickBest(hits, true);
  return { ingredient: best.ing, rawMatchedSnippet: token, confidence: CONTAIN_CONFIDENCE[best.kind] };
}

/** Partes internas de un token con paréntesis: "Emulsificante (E471, lecitina)" → ["Emulsificante","E471","lecitina"] */
function splitParenthetical(token: string): string[] {
  if (!token.includes('(')) return [];
  const parts: string[] = [];
  const outer = token.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (outer.length >= 2) parts.push(outer);
  for (const m of token.matchAll(/\(([^)]*)\)/g)) {
    for (const p of m[1].split(/[,;/]/)) {
      const t = p.trim();
      if (t.length >= 2) parts.push(t);
    }
  }
  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Textos de riesgo / beneficio
// ─────────────────────────────────────────────────────────────────────────────

const OFFICIAL_CHEMICAL_RISKS: Record<string, string> = {
  'bromato de potasio': 'Carcinógeno renal y tiroideo, destructor de nutrientes',
  'tartrazina': 'Alergias, hiperactividad y asma',
  'glutamato monosodico': 'Excitotoxicidad, migrañas y sobreestimulación neuronal',
  'eritrosina (rojo n°3)': 'Mutagenicidad y alteración de función tiroidea',
  'eritrosina': 'Mutagenicidad y alteración de función tiroidea',
  'azucar': 'Inflamación sistémica, sobrecarga metabólica y adicción',
  'propionato': 'Irritación gastrointestinal y alteración metabólica',
  'carragenina': 'Inflamación intestinal y ulceración de la mucosa',
  'benzoato de sodio': 'Formación de benceno (carcinógeno) en presencia de vitamina C',
  'propylene glycol': 'Irritante dérmico y facilitador de penetración de tóxicos',
  'peroxido de benzoilo': 'Estrés oxidativo dérmico, citotoxicidad y envejecimiento prematuro',
  'plomo': 'Neurotóxico bioacumulable y daño al sistema nervioso central',
  'mercurio': 'Neurotóxico grave y daño renal severo',
  'formaldehido': 'Carcinógeno comprobado y sensibilizante respiratorio',
  'ftalatos': 'Disruptores endocrinos y toxicidad reproductiva',
  'triclosan': 'Disruptor tiroideo y resistencia bacteriana',
  'resorcinol': 'Disruptor tiroideo e irritante dérmico severo',
  'parfum': 'Alergénico oculto y disruptores sintéticos no declarados',
  'metilparabeno': 'Disruptor estrogénico y bioacumulación celular',
  'propilparabeno': 'Disruptor endocrino y alteración hormonal reproductiva',
  'bencilparabeno': 'Disruptor estrogénico de alta afinidad',
  'etilparabeno': 'Disruptor hormonal estrogénico',
  'butilparabeno': 'Disruptor endocrino y daño a la fertilidad',
  'laurate sulphate': 'Irritación severa de barrera lipídica y daño dérmico',
  'siliconas peg/ppg': 'Oclusión dérmica y riesgo de contaminación con 1,4-dioxano',
  'paraffinum': 'Oclusivo comedogénico derivado de hidrocarburos de petróleo',
  'sodium': 'Irritante de barrera dérmica y desecante cutáneo',
  'ammonium': 'Irritante severo de mucosas y cuero cabelludo',
  'siliconas': 'Oclusión no biodegradable y asfixia dérmica',
  'diacetileno': 'Daño pulmonar severo irreversible (bronquiolitis obliterante)',
};

/**
 * Devuelve el texto de la columna "Riesgo funcional o Beneficio" del archivo base oficial.
 * Los fallbacks solo se usan si la fila no trae ese texto.
 */
export function getFunctionalRiskOrBenefit(ing: Partial<Ingredient>): string {
  if (ing.functionalRiskOrBenefit && ing.functionalRiskOrBenefit.trim().length > 0) {
    return ing.functionalRiskOrBenefit.trim();
  }
  const norm = normalizeText(ing.name || ing.inciName || '');
  if (norm && OFFICIAL_CHEMICAL_RISKS[norm]) {
    return OFFICIAL_CHEMICAL_RISKS[norm];
  }
  if (norm.length >= 4) {
    for (const key of Object.keys(OFFICIAL_CHEMICAL_RISKS)) {
      if (` ${norm} `.includes(` ${key} `)) return OFFICIAL_CHEMICAL_RISKS[key];
    }
  }

  if (ing.description) {
    if (ing.description.includes(' Origen/Tipo:')) {
      const benefit = ing.description.split(' Origen/Tipo:')[0].trim();
      if (benefit) return benefit;
    }
    if (ing.description.includes(' Presente comúnmente en:')) {
      const risk = ing.description.split(' Presente comúnmente en:')[0].trim();
      if (risk && !risk.includes('Químico o aditivo con toxicidad')) return risk;
    }
  }

  if (ing.risks && !ing.risks.includes('Riesgo toxicológico alto') && !ing.risks.includes('Sin riesgo toxicológico')) {
    return ing.risks.trim();
  }

  if (ing.details && ing.details.trim().length > 0 && !ing.details.includes('Verificado')) {
    return ing.details.trim();
  }

  const light = getIngredientLight(ing);
  return light === 'red'
    ? 'Riesgo químico según archivo base oficial'
    : light === 'yellow'
    ? 'Aditivo moderado o sensibilizante'
    : 'Nutriente botánico inocuo';
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis completo
// ─────────────────────────────────────────────────────────────────────────────

export const UNKNOWN_VERDICT =
  'Ningún ingrediente coincide con la base oficial LuBo. Revisa el texto o agrégalo desde el Panel Administrativo.';

/**
 * Analiza un texto completo contra la base interna.
 * 100% offline. El semáforo global = el peor semáforo entre los ingredientes reconocidos;
 * si no se reconoce ninguno, el estado es 'unknown' (nunca verde).
 */
export function analyzeIngredientsText(rawText: string, database: Ingredient[]): ScanAnalysis {
  const tokens = tokenizeIngredientText(rawText);
  const matchedMap = new Map<string, MatchedIngredientResult>();
  const unrecognizedTokens: string[] = [];
  let recognizedTokens = 0;

  const register = (m: MatchedIngredientResult) => {
    if (!matchedMap.has(m.ingredient.id)) matchedMap.set(m.ingredient.id, m);
  };

  for (const token of tokens) {
    let recognized = false;

    const whole = matchSingleToken(token, database);
    if (whole) {
      register(whole);
      recognized = true;
    }

    // Sub-ingredientes entre paréntesis: se suman, pero nunca generan "no reconocidos" si el token ya coincidió.
    for (const part of splitParenthetical(token)) {
      const m = matchSingleToken(part, database);
      if (m) {
        register(m);
        recognized = true;
      }
    }

    if (recognized) recognizedTokens++;
    else if (token.length > 2 && !unrecognizedTokens.includes(token)) unrecognizedTokens.push(token);
  }

  const matchedList = Array.from(matchedMap.values());

  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;
  for (const item of matchedList) {
    const light = getIngredientLight(item.ingredient);
    if (light === 'green') greenCount++;
    else if (light === 'yellow') yellowCount++;
    else redCount++;
  }

  let overallStatus: ScanStatus;
  if (matchedList.length === 0) overallStatus = 'unknown';
  else if (redCount > 0) overallStatus = 'red';
  else if (yellowCount > 0) overallStatus = 'yellow';
  else overallStatus = 'green';

  const withLight = (light: TrafficLight) => matchedList.filter((m) => getIngredientLight(m.ingredient) === light);
  const describe = (list: MatchedIngredientResult[], max = list.length) =>
    list.length === 1
      ? getFunctionalRiskOrBenefit(list[0].ingredient)
      : list
          .slice(0, max)
          .map((m) => `${m.ingredient.name}: ${getFunctionalRiskOrBenefit(m.ingredient)}`)
          .join('. ');

  // El veredicto muestra ÚNICAMENTE texto de la columna "Riesgo funcional o Beneficio" de la base.
  let verdict: string;
  if (overallStatus === 'red') verdict = describe(withLight('red'));
  else if (overallStatus === 'yellow') verdict = describe(withLight('yellow'));
  else if (overallStatus === 'green') verdict = describe(matchedList, 3);
  else verdict = UNKNOWN_VERDICT;

  const safetyScore = overallStatus === 'red' ? 20 : overallStatus === 'yellow' ? 60 : overallStatus === 'green' ? 100 : 0;

  return {
    rawText,
    timestamp: new Date().toISOString(),
    matchedIngredients: matchedList,
    unrecognizedTokens,
    overallStatus,
    summary: {
      total: matchedList.length,
      greenCount,
      yellowCount,
      redCount,
      unrecognizedCount: unrecognizedTokens.length,
      safetyScore,
      coverage: tokens.length === 0 ? 0 : recognizedTokens / tokens.length,
    },
    verdict,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Búsqueda para autocompletado / panel administrativo
// ─────────────────────────────────────────────────────────────────────────────

/** Filtro directo (contiene) sobre nombre, INCI, categoría y sinónimos. Empieza-por primero. */
export function searchIngredientsLocally(query: string, database: Ingredient[]): Ingredient[] {
  const q = normalizeText(query);
  if (!q) return database;

  const scored: Array<{ ing: Ingredient; score: number }> = [];
  for (const ing of database) {
    const name = normalizeText(ing.name);
    const inci = normalizeText(ing.inciName || '');
    let score = 0;
    if (name === q || inci === q) score = 4;
    else if (name.startsWith(q) || inci.startsWith(q)) score = 3;
    else if (name.includes(q) || inci.includes(q)) score = 2;
    else if ((ing.synonyms || []).some((s) => normalizeText(s).includes(q)) || normalizeText(ing.category || '').includes(q)) score = 1;
    if (score > 0) scored.push({ ing, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.ing);
}

// ─────────────────────────────────────────────────────────────────────────────
// Calidad de la base (para el Panel Administrativo)
// ─────────────────────────────────────────────────────────────────────────────

export interface DatabaseConflict {
  term: string;
  entries: Array<{ name: string; light: TrafficLight }>;
}

/** Términos que apuntan a ingredientes con semáforo DISTINTO (p. ej. "Azúcar" rojo vs "Azúcar (sacarosa)" verde). */
export function findDatabaseConflicts(database: Ingredient[]): DatabaseConflict[] {
  const idx = getIndex(database);
  const conflicts: DatabaseConflict[] = [];
  for (const [term, hits] of idx.exact) {
    const unique = new Map<string, Ingredient>();
    hits.forEach((h) => unique.set(h.ing.id, h.ing));
    if (unique.size < 2) continue;
    const lights = new Set(Array.from(unique.values()).map(getIngredientLight));
    if (lights.size > 1) {
      conflicts.push({
        term,
        entries: Array.from(unique.values()).map((i) => ({ name: i.name, light: getIngredientLight(i) })),
      });
    }
  }
  return conflicts;
}
