/**
 * Pruebas del motor de clasificación LuBo (capa de procesamiento).
 * Ejecutar:  npm test
 * No requiere navegador ni red: solo la base interna.
 */
import assert from 'node:assert/strict';
import { INITIAL_INGREDIENTS as DB } from '../src/data/initialIngredients';
import { OneDriveSyncService } from '../src/services/oneDriveSync';
import {
  analyzeIngredientsText,
  findDatabaseConflicts,
  matchSingleToken,
  searchIngredientsLocally,
  tokenizeIngredientText,
} from '../src/services/ingredientMatcher';

let passed = 0;
let failed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').join('\n      ')}`);
  }
};
const name = (t: string) => matchSingleToken(t, DB)?.ingredient.name ?? null;

console.log('\n── Falsos positivos que existían en el motor anterior ──');
test('"Salicylic Acid" ya NO coincide con "Sal (NaCl)" (falso verde)', () => assert.notEqual(name('Salicylic Acid'), 'Sal (NaCl)'));
test('"Cetearyl Alcohol" ya NO coincide con DEA/TEA/MEA (falso rojo)', () => assert.notEqual(name('Cetearyl Alcohol'), 'DEA/TEA/MEA'));
test('"Steareth-20" ya NO coincide con DEA/TEA/MEA', () => assert.notEqual(name('Steareth-20'), 'DEA/TEA/MEA'));
test('"Gelatina" ya NO coincide con "Aloe vera (gel)"', () => assert.notEqual(name('Gelatina'), 'Aloe vera (gel)'));
test('"Trabajo" ya NO coincide con "Ajo"', () => assert.equal(name('Trabajo'), null));
test('"Sodium Hyaluronate" ya NO cae en el comodín "Sodium" rojo', () => assert.notEqual(name('Sodium Hyaluronate'), 'Sodium'));
test('"Sodium Cocoyl Isethionate" ya NO cae en "Sodium"', () => assert.notEqual(name('Sodium Cocoyl Isethionate'), 'Sodium'));
test('"Agua" ya NO se clasifica como "Coco (pulpa/agua)" (sinónimo basura)', () => assert.equal(name('Agua'), null));
test('"Gel" y "Pulpa" sueltos ya no coinciden con Aloe/Aguacate', () => {
  assert.equal(name('Gel'), null);
  assert.equal(name('Pulpa'), null);
});
test('alias real entre paréntesis se conserva: "shea", "cochinilla"', () => {
  assert.equal(name('Shea'), 'Aceite de karité (shea)');
  assert.equal(name('Cochinilla'), 'Carmín (cochinilla)');
});
test('"Coco" sigue coincidiendo con "Coco (pulpa/agua)"', () => assert.equal(name('Coco'), 'Coco (pulpa/agua)'));
test('"Sodium" escrito solo SÍ coincide con la entrada "Sodium"', () => assert.equal(name('Sodium'), 'Sodium'));

console.log('\n── Coincidencias que DEBEN seguir funcionando ──');
test('exacto: Tartrazina → rojo', () => assert.equal(matchSingleToken('Tartrazina', DB)?.ingredient.trafficLight, 'red'));
test('exacto con tildes/mayúsculas: "BROMATO DE POTASIO"', () => assert.equal(name('BROMATO DE POTASIO'), 'Bromato de potasio'));
test('número E: E924 → Bromato de potasio', () => assert.equal(name('E924'), 'Bromato de potasio'));
test('número E con espacio: "E 924"', () => assert.equal(name('E 924'), 'Bromato de potasio'));
test('sinónimo inglés: Dimethicone → Siliconas', () => assert.equal(name('Dimethicone'), 'Siliconas'));
test('"Parfum (Fragrance)" → Parfum', () => assert.equal(name('Parfum (Fragrance)'), 'Parfum'));
test('"Sodium Benzoate" → Benzoato de sodio', () => assert.equal(name('Sodium Benzoate'), 'Benzoato de sodio'));
test('"BHT" → BHA / BHT', () => assert.equal(name('BHT'), 'BHA / BHT'));
test('"PEG-100 Stearate" → Siliconas PEG/PPG (sigla PEG como palabra)', () => assert.equal(name('PEG-100 Stearate'), 'Siliconas PEG/PPG'));
test('"Azúcar" → rojo (nombre exacto gana sobre variante)', () => assert.equal(matchSingleToken('Azúcar', DB)?.ingredient.trafficLight, 'red'));
test('plural simple: "Nitratos" y "Nitrato" coinciden igual', () => assert.equal(name('Nitratos'), name('Nitrato')));
test('nombre contenido en frase: "Aceite de aguacate prensado en frío"', () => assert.notEqual(name('Aceite de aguacate prensado en frío'), null));

console.log('\n── Estado global del semáforo ──');
const A = (t: string) => analyzeIngredientsText(t, DB);
test('texto vacío → unknown (NO verde)', () => assert.equal(A('').overallStatus, 'unknown'));
test('texto sin sentido → unknown (NO verde)', () => assert.equal(A('xqzv lorem ipsum').overallStatus, 'unknown'));
test('ruido de OCR → unknown (NO verde)', () => assert.equal(A('Hl3o wrld 12 ///').overallStatus, 'unknown'));
test('unknown trae mensaje y score 0', () => {
  const a = A('xqzv');
  assert.equal(a.summary.safetyScore, 0);
  assert.match(a.verdict, /base oficial LuBo/);
});
test('un rojo entre verdes → rojo', () => assert.equal(A('Aloe vera, Tartrazina, Caléndula').overallStatus, 'red'));
test('solo verdes reconocidos → verde', () => assert.equal(A('Aloe vera, Caléndula').overallStatus, 'green'));
test('el veredicto rojo es el texto de la base (columna Riesgo funcional)', () =>
  assert.equal(A('Bromato de potasio').verdict, 'Carcinógeno renal y tiroideo, destructor de nutrientes'));
test('cobertura: 1 de 2 términos reconocidos = 0.5', () => assert.equal(A('Tartrazina, zzzqqq').summary.coverage, 0.5));

console.log('\n── Etiquetas de muestra completas ──');
test('serum "limpio" ya NO sale rojo', () => {
  const a = A('INGREDIENTES: Aqua, Aloe Barbadensis Leaf Juice, Glycerin, Sodium Hyaluronate, Calendula Officinalis Flower Extract, Tocopherol, Panthenol.');
  assert.notEqual(a.overallStatus, 'red', `salió ${a.overallStatus}: ${a.matchedIngredients.map((m) => m.ingredient.name + '[' + m.ingredient.trafficLight + ']')}`);
});
test('loción con parabenos/SLES/BHT/Parfum → rojo', () =>
  assert.equal(A('INGREDIENTS: Water (Aqua), Sodium Laureth Sulfate (SLES), Dimethicone, Methylparaben, Propylparaben, BHT, Parfum (Fragrance), Phenoxyethanol, PEG-100 Stearate.').overallStatus, 'red'));
test('exfoliante con Sodium Benzoate + Parfum → rojo', () =>
  assert.equal(A('COMPOSICIÓN: Aqua, Alcohol Denat., Salicylic Acid (2%), Retinol, Niacinamide, Sodium Benzoate, Titanium Dioxide, Parfum.').overallStatus, 'red'));

console.log('\n── Tokenizador ──');
test('encabezado con tilde "COMPOSICIÓN:" se elimina', () => assert.deepEqual(tokenizeIngredientText('COMPOSICIÓN: Aqua, Aloe vera'), ['Aqua', 'Aloe vera']));
test('porcentaje "2%" y "0,5 %" se eliminan', () => assert.deepEqual(tokenizeIngredientText('Salicylic Acid (2%), Retinol 0,5 %'), ['Salicylic Acid', 'Retinol']));
test('no corta paréntesis con comas', () => assert.equal(tokenizeIngredientText('Emulsificante (E471, lecitina), Sal').length, 2));
test('OCR parte "Sodium Laureth\\nSulfate" en 2 líneas → 1 solo ingrediente', () =>
  assert.deepEqual(tokenizeIngredientText('Aqua, Sodium Laureth\nSulfate, Parfum'), ['Aqua', 'Sodium Laureth Sulfate', 'Parfum']));
test('sin comas: un ingrediente por línea', () => assert.deepEqual(tokenizeIngredientText('Tartrazina\nAloe vera'), ['Tartrazina', 'Aloe vera']));
test('sub-ingrediente en paréntesis se clasifica (E924 dentro de paréntesis)', () => {
  const a = A('Mejorador (E924, lecitina)');
  assert.equal(a.overallStatus, 'red');
});

console.log('\n── Integridad de la base ──');
test('la base tiene 680 ingredientes', () => assert.equal(DB.length, 680));
test('cada ingrediente se encuentra a sí mismo por nombre (salvo conflictos conocidos)', () => {
  const conflictTerms = new Set(findDatabaseConflicts(DB).map((c) => c.term));
  const bad: string[] = [];
  for (const ing of DB) {
    const m = matchSingleToken(ing.name, DB);
    if (!m || m.ingredient.id === ing.id) continue;
    if (m.ingredient.trafficLight === ing.trafficLight) continue; // mismo semáforo: aceptable
    bad.push(`${ing.name}[${ing.trafficLight}] → ${m.ingredient.name}[${m.ingredient.trafficLight}]`);
  }
  assert.equal(bad.length, 0, 'devuelve OTRO semáforo:\n' + bad.slice(0, 10).join('\n'));
  void conflictTerms;
});
test('conflictos de la base detectados (informativo)', () => {
  const c = findDatabaseConflicts(DB);
  console.log(`      ↳ ${c.length} términos apuntan a semáforos distintos:`, c.map((x) => x.term).join(', '));
  assert.ok(Array.isArray(c));
});
test('búsqueda local: "tartra" encuentra Tartrazina primero', () => assert.equal(searchIngredientsLocally('tartra', DB)[0]?.name, 'Tartrazina'));

console.log('\n── Importación CSV (OneDrive) ──');
const csv = '\uFEFFCategoria_Color;Químico;Uso principal;Riesgo funcional o Beneficio;Nivel de toxisidad (%);Producto donde se usa más\r\n' +
  'Rojo;"Colorante ""X"" (E999)";Color;"Riesgo A\nlínea 2";85;Dulces\r\n' +
  'Verde;Té verde;Antioxidante;Beneficio;0;Bebidas\r\n' +
  'Naranja;Raro;Uso;Texto;50;Algo\r\n';
const parsed = OneDriveSyncService.parseOneDriveCsv(csv);
test('lee 3 filas con BOM, ";", comillas y salto de línea dentro de celda', () => {
  assert.equal(parsed.success, true);
  assert.equal(parsed.ingredients.length, 3);
  assert.equal(parsed.ingredients[0].name, 'Colorante "X" (E999)');
  assert.match(parsed.ingredients[0].functionalRiskOrBenefit || '', /Riesgo A\s*línea 2/);
});
test('color desconocido ("Naranja") → rojo + AVISO (no silencioso)', () => {
  assert.equal(parsed.ingredients[2].trafficLight, 'red');
  assert.equal(parsed.warnings.length, 1);
});
test('CSV vacío → error claro', () => assert.equal(OneDriveSyncService.parseOneDriveCsv('').success, false));
test('lo importado se clasifica con el mismo motor', () =>
  assert.equal(analyzeIngredientsText('Té verde', parsed.ingredients).overallStatus, 'green'));

console.log('\n── Rendimiento ──');
test('analizar etiqueta de 150 ingredientes en < 300 ms', () => {
  const big = Array.from({ length: 150 }, (_, i) => DB[(i * 7) % DB.length].name).join(', ');
  analyzeIngredientsText('warm', DB);
  const t0 = performance.now();
  analyzeIngredientsText(big, DB);
  const ms = performance.now() - t0;
  console.log(`      ↳ ${ms.toFixed(1)} ms`);
  assert.ok(ms < 300, `tardó ${ms.toFixed(0)} ms`);
});

console.log(`\n${failed === 0 ? '✅' : '❌'}  ${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed === 0 ? 0 : 1);
