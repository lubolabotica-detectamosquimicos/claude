/**
 * LECTURA (solo lectura) del Excel maestro de LuBo en OneDrive.
 *
 *  - Se ejecuta SOLO en el servidor (Vercel Function). El enlace vive en la variable privada
 *    ONEDRIVE_FILE_URL (sin prefijo VITE_), nunca llega al navegador.
 *  - Solo hace peticiones GET de descarga. No usa credenciales ni permisos de escritura de OneDrive:
 *    el archivo NUNCA se modifica.
 *  - El enlace debe estar compartido como "Cualquier persona con el enlace puede ver".
 */
import { createHash } from 'node:crypto';
import readXlsxFile from 'read-excel-file/node';

export class SourceError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = 'SourceError';
  }
}

export interface SourceDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const MAX_BYTES = 15 * 1024 * 1024;

/** API pública de "shares" de OneDrive: codifica el enlace compartido en base64url con prefijo "u!". */
export function shareApiUrl(shareUrl: string): string {
  const b64 = Buffer.from(shareUrl, 'utf8').toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content`;
}

const isXlsx = (b: Buffer) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b; // firma ZIP "PK"

/** Descarga el .xlsx probando las formas públicas de acceso a un enlace compartido. */
export async function downloadWorkbook(shareUrl: string, deps: SourceDeps = {}): Promise<Buffer> {
  const doFetch = deps.fetchImpl ?? fetch;
  const timeout = deps.timeoutMs ?? 15000;
  const attempts = [
    { name: 'api-shares', url: shareApiUrl(shareUrl) },
    { name: 'download=1', url: shareUrl + (shareUrl.includes('?') ? '&' : '?') + 'download=1' },
  ];
  const failures: string[] = [];

  for (const attempt of attempts) {
    try {
      const res = await doFetch(attempt.url, { redirect: 'follow', signal: AbortSignal.timeout(timeout) });
      if (!res.ok) {
        failures.push(`${attempt.name}: HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new SourceError('El archivo de OneDrive es demasiado grande.', 502);
      if (!isXlsx(buf)) {
        failures.push(`${attempt.name}: la respuesta no es un archivo .xlsx (¿el enlace pide iniciar sesión?)`);
        continue;
      }
      return buf;
    } catch (e) {
      if (e instanceof SourceError) throw e;
      failures.push(`${attempt.name}: ${(e as Error).name === 'TimeoutError' ? 'tiempo agotado' : (e as Error).message}`);
    }
  }
  throw new SourceError(
    'No se pudo descargar el archivo de OneDrive. Verifica que el enlace esté compartido como "Cualquier persona con el enlace puede ver". Detalle: ' +
      failures.join(' | ')
  );
}

const cellToString = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

const csvField = (v: string): string => (/[",;\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Convierte la hoja con la lista de ingredientes (la que tiene "Categoria_Color"/"Químico") a CSV. */
export async function workbookToCsv(buffer: Buffer): Promise<{ csv: string; rows: number; sheet: string }> {
  let sheets;
  try {
    sheets = await readXlsxFile(buffer);
  } catch (e) {
    throw new SourceError('No se pudo leer el Excel de OneDrive: ' + (e as Error).message);
  }
  if (!sheets.length) throw new SourceError('El Excel no tiene hojas.');

  const looksLikeData = (data: unknown[][]) => {
    const header = (data[0] || []).map((c) => cellToString(c).toLowerCase());
    return header.some((h) => h.includes('categoria') || h.includes('quimico') || h.includes('químico'));
  };
  const chosen = sheets.find((s) => looksLikeData(s.data as unknown[][])) ?? sheets[0];

  const lines: string[] = [];
  for (const row of chosen.data as unknown[][]) {
    const cells = row.map(cellToString);
    if (cells.every((c) => c.trim() === '')) continue; // fila vacía
    lines.push(cells.map(csvField).join(','));
  }
  if (lines.length < 2) throw new SourceError('La hoja del Excel está vacía o no tiene encabezados.');
  return { csv: lines.join('\n') + '\n', rows: lines.length - 1, sheet: chosen.sheet };
}

export interface IngredientSource {
  csv: string;
  hash: string;
  rowCount: number;
  sheet: string;
}

/** Descarga + convierte + calcula un hash del CONTENIDO (cambia solo si cambian los datos). */
export async function loadIngredientSource(shareUrl: string, deps: SourceDeps = {}): Promise<IngredientSource> {
  const buffer = await downloadWorkbook(shareUrl, deps);
  const { csv, rows, sheet } = await workbookToCsv(buffer);
  const hash = createHash('sha256').update(csv).digest('hex').slice(0, 32);
  return { csv, hash, rowCount: rows, sheet };
}
