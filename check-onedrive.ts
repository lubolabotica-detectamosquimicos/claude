/**
 * Prueba TU enlace de OneDrive desde tu computador (solo lectura):
 *   ONEDRIVE_FILE_URL="https://1drv.ms/x/c/..." npm run check:onedrive
 * Descarga el Excel, lo convierte y muestra cuántos ingredientes hay por color.
 * No escribe nada en OneDrive.
 */
import { loadIngredientSource } from '../api/_lib/onedrive.js';
import { OneDriveSyncService } from '../src/services/oneDriveSync.js';

const url = process.env.ONEDRIVE_FILE_URL;
if (!url) {
  console.error('Falta la variable ONEDRIVE_FILE_URL.\nEjemplo (Mac/Linux):  ONEDRIVE_FILE_URL="https://1drv.ms/..." npm run check:onedrive');
  process.exit(1);
}

try {
  const src = await loadIngredientSource(url);
  const parsed = OneDriveSyncService.parseOneDriveCsv(src.csv);
  const c = { green: 0, yellow: 0, red: 0 };
  parsed.ingredients.forEach((i) => c[i.trafficLight ?? 'red']++);
  console.log(`\n✅ OneDrive accesible (solo lectura)\n   Hoja: "${src.sheet}" · ${src.rowCount} filas · ${parsed.ingredients.length} ingredientes válidos`);
  console.log(`   🟢 ${c.green} verdes · 🟡 ${c.yellow} amarillos · 🔴 ${c.red} rojos · hash ${src.hash}`);
  if (parsed.warnings.length) console.log(`   ⚠️  ${parsed.warnings.length} aviso(s):\n   - ` + parsed.warnings.slice(0, 8).join('\n   - '));
  if (parsed.errors.length) console.log(`   ⚠️  ${parsed.errors.length} fila(s) omitida(s):\n   - ` + parsed.errors.slice(0, 8).join('\n   - '));
  console.log('');
} catch (e) {
  console.error('\n❌ ' + (e as Error).message + '\n');
  process.exit(1);
}
