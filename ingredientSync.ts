/**
 * Sincronización de la lista maestra LuBo = el Excel de OneDrive (ÚNICA fuente).
 *
 *  - La app NO descarga OneDrive directamente: pide la lista a /api/ingredients (servidor, solo lectura).
 *  - Cuando el contenido del Excel cambia, se actualiza la copia local y el semáforo se recalcula.
 *  - La clasificación sigue siendo 100 % local: si no hay conexión se usa la última copia sincronizada.
 *  - El archivo de OneDrive nunca se modifica desde la app.
 */
import { ENV } from '../config/env';
import { LocalVaultService } from './localVault';
import { OneDriveSyncService } from './oneDriveSync';

export interface SyncResult {
  status: 'updated' | 'unchanged' | 'error';
  count?: number;
  message?: string;
  at: string;
}

/** Protección: un archivo con menos filas que esto se considera dañado y se ignora. */
export const MIN_ROWS = 20;

type Listener = (result: SyncResult) => void;
const listeners = new Set<Listener>();
let last: SyncResult | null = null;
let inflight: Promise<SyncResult> | null = null;

export const onIngredientsUpdated = (cb: Listener): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const getLastSync = (): SyncResult | null => last;

async function doSync(): Promise<SyncResult> {
  const at = new Date().toISOString();
  try {
    const since = encodeURIComponent(LocalVaultService.getSyncHash());
    const res = await fetch(`/api/ingredients?since=${since}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) throw new Error('El servicio de sincronización no está disponible en este entorno.');
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || `Error ${res.status}`);

    if (!body.changed) return { status: 'unchanged', at };

    const parsed = OneDriveSyncService.parseOneDriveCsv(body.csv as string);
    if (!parsed.success || parsed.ingredients.length < MIN_ROWS) {
      throw new Error(`El Excel de OneDrive no parece válido (${parsed.ingredients.length} filas). Se conserva la lista anterior.`);
    }
    if (!LocalVaultService.saveIngredients(parsed.ingredients, 'OneDrive · Excel maestro LuBo (sincronizado)')) {
      throw new Error('No se pudo guardar la lista actualizada en este dispositivo.');
    }
    LocalVaultService.setSyncHash(body.hash as string);
    return { status: 'updated', count: parsed.ingredients.length, at };
  } catch (e) {
    return { status: 'error', message: (e as Error).message, at };
  }
}

/** Revisa OneDrive (vía servidor). Si cambió, actualiza la base local y avisa a la interfaz. */
export function syncIngredients(): Promise<SyncResult> {
  if (!inflight) {
    inflight = doSync().then((r) => {
      inflight = null;
      last = r;
      if (r.status === 'updated') listeners.forEach((l) => l(r));
      return r;
    });
  }
  return inflight;
}

/** Sincroniza al abrir, cada N minutos, al volver a la pestaña y al recuperar la conexión. */
export function startAutoSync(): () => void {
  let lastRun = 0;
  const run = () => {
    lastRun = Date.now();
    void syncIngredients();
  };
  run();
  const timer = window.setInterval(run, ENV.syncMinutes * 60_000);
  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRun > 60_000) run();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', run);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', run);
  };
}
