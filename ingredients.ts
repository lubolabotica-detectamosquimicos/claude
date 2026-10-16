/**
 * GET /api/ingredients?since=<hash>
 * Devuelve la lista maestra de LuBo leída del Excel de OneDrive (solo lectura).
 *  - Si `since` coincide con el contenido actual → { changed: false } (sin reenviar datos).
 *  - Si cambió → { changed: true, hash, csv, rowCount }.
 * La app clasifica SIEMPRE localmente; esto solo mantiene la lista al día.
 */
import { loadIngredientSource, SourceError, type IngredientSource, type SourceDeps } from './_lib/onedrive.js';

interface Deps extends SourceDeps {
  sourceUrl?: string;
  load?: (url: string, deps: SourceDeps) => Promise<IngredientSource>;
  now?: () => number;
}

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });

// Caché en memoria de la instancia (evita golpear OneDrive en cada visita).
let memo: { at: number; data: IngredientSource } | null = null;
const MEMO_MS = 60_000;

export async function handleIngredients(request: Request, deps: Deps = {}): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);

  const sourceUrl = deps.sourceUrl ?? process.env.ONEDRIVE_FILE_URL;
  if (!sourceUrl) return json({ error: 'ONEDRIVE_FILE_URL no está configurada en el servidor.' }, 503);

  const now = (deps.now ?? Date.now)();
  const since = new URL(request.url).searchParams.get('since');

  try {
    let data: IngredientSource;
    if (memo && now - memo.at < MEMO_MS && !deps.load) {
      data = memo.data;
    } else {
      data = await (deps.load ?? loadIngredientSource)(sourceUrl, deps);
      if (!deps.load) memo = { at: now, data };
    }
    const checkedAt = new Date(now).toISOString();
    if (since && since === data.hash) return json({ changed: false, hash: data.hash, checkedAt });
    return json({ changed: true, hash: data.hash, csv: data.csv, rowCount: data.rowCount, checkedAt });
  } catch (e) {
    const status = e instanceof SourceError ? e.status : 502;
    return json({ error: (e as Error).message }, status);
  }
}

export function GET(request: Request): Promise<Response> {
  return handleIngredients(request);
}
