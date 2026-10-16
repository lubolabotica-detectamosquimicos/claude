/**
 * CAPA DE PROCESAMIENTO — OCR 100% en el dispositivo.
 *
 * El worker, el núcleo WASM y los modelos de idioma (spa + eng) se sirven DESDE ESTA MISMA APP
 * (carpeta /public/ocr, generada por `scripts/copy-ocr-assets.mjs`). Por defecto tesseract.js los
 * descargaría de cdn.jsdelivr.net: aquí se fuerzan rutas locales para que NUNCA salga una petición
 * externa. La librería se carga bajo demanda (import dinámico) para no engordar la carga inicial.
 */

export interface OcrProgress {
  status: string;
  progress: number; // 0 a 1
}

export class OcrError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'OcrError';
  }
}

const OCR_BASE = `${import.meta.env.BASE_URL}ocr`;
const MAX_OCR_DIMENSION = 1600;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new OcrError('No se pudo leer la imagen. Intenta con otra foto.'));
    img.src = src;
  });
}

/**
 * Mejora la legibilidad para OCR: reduce tamaño, pasa a grises y estira el contraste.
 * Si algo falla devuelve la imagen original (el OCR sigue pudiendo intentarlo).
 */
export async function preprocessImageForOcr(imageSrc: string): Promise<string> {
  try {
    const img = await loadImage(imageSrc);
    const scale = Math.min(1, MAX_OCR_DIMENSION / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return imageSrc;
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const contrast = 1.3;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const v = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
      data[i] = data[i + 1] = data[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return imageSrc;
  }
}

/** Miniatura liviana (para guardar en el historial sin llenar el almacenamiento). */
export async function createThumbnail(imageSrc: string, size = 160): Promise<string | undefined> {
  try {
    const img = await loadImage(imageSrc);
    const scale = Math.min(1, size / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return undefined;
  }
}

/**
 * Lee el texto de una imagen con Tesseract.js, en el dispositivo. Cero datos a servidores externos.
 * Lanza OcrError con un mensaje claro si falla (NUNCA inventa un texto de reemplazo).
 */
export async function runLocalOcr(
  imageSource: string,
  onProgress?: (progress: OcrProgress) => void
): Promise<string> {
  let worker: { recognize: (img: string) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> } | null = null;
  try {
    onProgress?.({ status: 'Preparando imagen…', progress: 0.05 });
    const processed = await preprocessImageForOcr(imageSource);

    onProgress?.({ status: 'Cargando motor OCR local…', progress: 0.15 });
    const { createWorker } = await import('tesseract.js');

    worker = await createWorker('spa+eng', 1, {
      workerPath: `${OCR_BASE}/worker.min.js`,
      corePath: `${OCR_BASE}/core`,
      langPath: `${OCR_BASE}/lang`,
      gzip: true,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          onProgress?.({ status: 'Leyendo texto de la etiqueta…', progress: 0.35 + m.progress * 0.6 });
        } else if (m.status.includes('loading')) {
          onProgress?.({ status: 'Cargando modelos de idioma…', progress: 0.25 });
        }
      },
    });

    const result = await worker.recognize(processed);
    onProgress?.({ status: 'Listo', progress: 1 });
    return (result.data.text || '').trim();
  } catch (error) {
    if (error instanceof OcrError) throw error;
    console.error('OCR error:', error);
    throw new OcrError(
      'No se pudo leer el texto de la foto. Acércate más a la lista de ingredientes con buena luz, o escríbelos a mano.',
      error
    );
  } finally {
    if (worker) await worker.terminate().catch(() => undefined);
  }
}
