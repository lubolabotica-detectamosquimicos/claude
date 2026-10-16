/**
 * Copia los recursos del OCR (Tesseract) a /public/ocr para que la app NUNCA
 * los descargue de internet (por defecto tesseract.js los baja de cdn.jsdelivr.net).
 *
 * Se ejecuta automáticamente en `npm install` (postinstall) y antes del build en Vercel.
 * Los archivos generados NO se suben a GitHub (ver .gitignore): se regeneran solos.
 *
 * Resultado:
 *   public/ocr/worker.min.js
 *   public/ocr/core/tesseract-core*-lstm.wasm.js   (3 variantes; el navegador baja solo la compatible)
 *   public/ocr/lang/{spa,eng}.traineddata.gz
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const nm = (...p) => join(root, 'node_modules', ...p);
const out = (...p) => join(root, 'public', 'ocr', ...p);

const files = [
  [nm('tesseract.js', 'dist', 'worker.min.js'), out('worker.min.js')],
  [nm('tesseract.js-core', 'tesseract-core-lstm.wasm.js'), out('core', 'tesseract-core-lstm.wasm.js')],
  [nm('tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), out('core', 'tesseract-core-simd-lstm.wasm.js')],
  [nm('tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm.js'), out('core', 'tesseract-core-relaxedsimd-lstm.wasm.js')],
  [nm('@tesseract.js-data', 'spa', '4.0.0_best_int', 'spa.traineddata.gz'), out('lang', 'spa.traineddata.gz')],
  [nm('@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'), out('lang', 'eng.traineddata.gz')],
];

const missing = files.filter(([src]) => !existsSync(src));
if (missing.length > 0) {
  console.error('\n[ocr:assets] ERROR: faltan archivos fuente. ¿Corriste "npm install" completo?');
  missing.forEach(([src]) => console.error('  - ' + src));
  process.exit(1);
}

let total = 0;
for (const [src, dst] of files) {
  mkdirSync(join(dst, '..'), { recursive: true });
  copyFileSync(src, dst);
  total += statSync(dst).size;
}
console.log(`[ocr:assets] OK — ${files.length} archivos copiados a public/ocr (${(total / 1048576).toFixed(1)} MB)`);
