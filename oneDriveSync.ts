import { Ingredient, TrafficLight } from '../types';

/**
 * Parser CSV completo (RFC 4180): soporta comillas, comillas escapadas ("") y SALTOS DE LÍNEA dentro
 * de celdas (comunes al exportar desde Excel/OneDrive). Devuelve filas de celdas.
 */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/**
 * Translates localized traffic light string to typed TrafficLight
 */
const KNOWN_COLORS = new Set(['verde','green','seguro','safe','amarillo','yellow','precaucion','precaución','caution','moderado','rojo','red','peligro','toxico','tóxico']);

function mapTrafficLight(value: string): TrafficLight {
  const clean = value.toLowerCase().trim();
  if (clean === 'verde' || clean === 'green' || clean === 'seguro' || clean === 'safe') return 'green';
  if (clean === 'amarillo' || clean === 'yellow' || clean === 'precaucion' || clean === 'precaución' || clean === 'caution' || clean === 'moderado') return 'yellow';
  return 'red';
}

export const OneDriveSyncService = {

  /**
   * Parses a CSV file exported from OneDrive / Excel and transforms into Ingredient objects.
   * Supports BOTH the official 6-column sheet schema ('Categoria_Color', 'Químico', ...)
   * and the detailed 11-column LuBo format.
   */
  parseOneDriveCsv(csvText: string): { success: boolean; ingredients: Ingredient[]; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const ingredients: Ingredient[] = [];

    const clean = csvText.replace(/^\uFEFF/, '');
    const firstLine = clean.split(/\r?\n/, 1)[0] || '';
    const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
    const lines = parseCsv(clean, delimiter);
    if (lines.length < 2) {
      return { success: false, ingredients: [], errors: ['El archivo CSV está vacío o no tiene encabezados.'], warnings: [] };
    }
    const warnings: string[] = [];
    const headerCols = lines[0].map((c) => c.trim().toLowerCase());
    const isOfficialSchema = headerCols.some((c) => c.includes('categoria') || c.includes('quimico') || c.includes('químico'));

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = lines[i];
        if (cols.length < 2) continue;

        if (isOfficialSchema) {
          // Columns: Categoria_Color; Químico; Uso principal; Riesgo funcional o Beneficio; Nivel de toxisidad (%); Producto donde se usa más
          const [catColorRaw, name, usoRaw, riesgoRaw, toxRaw, productoRaw] = cols;
          if (!name) continue;

          if (!KNOWN_COLORS.has(String(catColorRaw || '').toLowerCase().trim())) {
            warnings.push(`Fila ${i + 1} (${name}): color "${catColorRaw || '(vacío)'}" no reconocido; se trató como ROJO por seguridad.`);
          }
          const trafficLight = mapTrafficLight(catColorRaw || 'green');
          const isRed = trafficLight === 'red';
          const toxVal = toxRaw && !isNaN(parseFloat(toxRaw)) ? parseFloat(toxRaw) : (isRed ? 80 : 0);
          const score = roundScore(isRed ? Math.max(1, 10 - toxVal / 10) : Math.max(8.5, 10 - toxVal / 20));

          const syns = [name.toLowerCase()];
          const cleanParen = name.match(/\((.*?)\)/);
          if (cleanParen) {
            cleanParen[1].split(/[,/]/).forEach((s) => {
              if (s.trim().length > 1) syns.push(s.trim().toLowerCase());
            });
          }

          ingredients.push({
            id: `lubo-od-${String(i).padStart(4, '0')}`,
            name,
            inciName: name,
            synonyms: Array.from(new Set(syns)),
            trafficLight,
            tier: isRed ? 'danger' : trafficLight === 'yellow' ? 'caution' : 'optimal',
            category: usoRaw || 'General',
            mainUse: usoRaw || 'General',
            functionalRiskOrBenefit: riesgoRaw || (isRed ? 'Riesgo químico según base oficial' : 'Nutriente botánico seguro'),
            description: riesgoRaw || (isRed ? `Químico tóxico (${toxVal}%)` : 'Ingrediente natural seguro.'),
            risks: isRed ? (riesgoRaw || `Toxicidad alta (${toxVal}%)`) : (riesgoRaw || 'Inocuo y seguro.'),
            details: riesgoRaw || (productoRaw ? `Usado en: ${productoRaw}` : 'Verificado en archivo OneDrive.'),
            recommendedAlternative: isRed ? 'Buscar alternativa botánica limpia LuBo.' : 'Aprobado según estándar LuBo.',
            origin: isRed ? 'sintético' : 'natural',
            score,
            toxicityPercentage: toxVal,
            foundIn: productoRaw || '',
            updatedAt: new Date().toISOString().split('T')[0],
          });
        } else {
          // 11-column format
          const [
            id,
            name,
            inciName,
            semaforoRaw,
            category,
            description,
            risks,
            recommendedAlternative,
            synonymsRaw,
            originRaw,
            scoreRaw,
          ] = cols;

          if (!name && !inciName) continue;

          const trafficLight = mapTrafficLight(semaforoRaw || 'yellow');
          const synonyms = synonymsRaw ? synonymsRaw.split('|').map((s) => s.trim()).filter(Boolean) : [];
          const score = scoreRaw ? Math.min(10, Math.max(1, parseFloat(scoreRaw) || 5)) : trafficLight === 'green' ? 9.5 : trafficLight === 'yellow' ? 6 : 2;

          ingredients.push({
            id: id || `lubo-od-${Date.now()}-${i}`,
            name: name || inciName,
            inciName: inciName || name,
            synonyms,
            trafficLight,
            category: category || 'General',
            description: description || 'Sin descripción.',
            risks: risks || 'Sin riesgos descritos.',
            details: description || 'Componente verificado desde OneDrive.',
            tier: trafficLight === 'green' ? 'optimal' : trafficLight === 'yellow' ? 'caution' : 'danger',
            recommendedAlternative: recommendedAlternative || '',
            origin: (originRaw === 'natural' || originRaw === 'sintético' || originRaw === 'mixto') ? originRaw : 'mixto',
            score,
            updatedAt: new Date().toISOString().split('T')[0],
          });
        }
      } catch (err: any) {
        errors.push(`Fila ${i + 1}: Error (${err.message}).`);
      }
    }

    return {
      success: ingredients.length > 0,
      ingredients,
      errors,
      warnings,
    };
  },
};

function roundScore(val: number): number {
  return Math.round(val * 10) / 10;
}
