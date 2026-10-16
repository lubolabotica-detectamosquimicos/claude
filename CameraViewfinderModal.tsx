import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Product, ScanAnalysis } from '../types';
import { analyzeIngredientsText, getIngredientLight, getFunctionalRiskOrBenefit } from '../services/ingredientMatcher';
import { LocalVaultService } from '../services/localVault';
import { buildProductFromAnalysis } from '../services/productFactory';
import { createThumbnail, runLocalOcr } from '../services/ocrService';
import { FREE_WEEKLY_CAMERA_SCANS, PLAN_PRICE_LABEL } from '../config/plans';
import { TrafficLightBadge } from './TrafficLightBadge';

interface CameraViewfinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductScanned: (product: Product) => void;
  allProducts: Product[];
  onOpenInicioModal?: () => void;
  dbVersion?: number;
}

type Phase = 'live' | 'processing' | 'review';

/**
 * Escáner de etiquetas: captura/foto → vista previa → OCR LOCAL → semáforo según la base interna LuBo.
 * Ninguna imagen ni texto sale del dispositivo.
 * Cuota Free: solo consumen los escaneos con foto (cámara o galería). Escribir texto y las muestras son ilimitados.
 */
export const CameraViewfinderModal: React.FC<CameraViewfinderModalProps> = ({
  isOpen,
  onClose,
  onProductScanned,
  allProducts,
  onOpenInicioModal,
  dbVersion,
}) => {
  const [phase, setPhase] = useState<Phase>('live');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualText, setManualText] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ScanAnalysis | null>(null);
  const [, forceQuotaRefresh] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const scanCheck = LocalVaultService.canPerformCameraScan();
  const isBlocked = !scanCheck.allowed;

  // Reinicia el estado cada vez que se abre.
  useEffect(() => {
    if (isOpen) {
      setPhase('live');
      setCapturedImage(null);
      setAnalysis(null);
      setOcrText('');
      setOcrError(null);
      setManualText('');
      setTorchOn(false);
    }
  }, [isOpen]);

  // Cámara: se enciende solo en la fase "live" y se apaga siempre al salir (ahorra batería y privacidad).
  useEffect(() => {
    if (!isOpen || phase !== 'live' || isBlocked) return;
    let cancelled = false;
    let active: MediaStream | null = null;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Tu navegador no permite usar la cámara aquí (requiere HTTPS). Puedes subir una foto.');
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        active = s;
        const caps = (s.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorchSupported(Boolean(caps.torch));
        setCameraError(null);
        setStream(s);
      } catch (err: any) {
        if (cancelled) return;
        setStream(null);
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Actívalo en el navegador o sube una foto de la etiqueta.'
            : 'No se pudo abrir la cámara. Puedes subir una foto de la etiqueta.'
        );
      }
    })();

    return () => {
      cancelled = true;
      active?.getTracks().forEach((t) => t.stop());
      setStream(null);
      setTorchOn(false);
    };
  }, [isOpen, phase, isBlocked]);

  // El <video> existe siempre en la fase "live": aquí se le conecta el stream (antes nunca se conectaba).
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.play().catch(() => undefined);
    }
  }, [stream, phase]);

  const toggleTorch = async () => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setTorchSupported(false);
    }
  };

  const reviewText = useCallback((text: string) => {
    setOcrText(text);
    setAnalysis(analyzeIngredientsText(text, LocalVaultService.getIngredients()));
  }, []);

  const processImage = useCallback(
    async (imageDataUrl: string) => {
      setCapturedImage(imageDataUrl);
      setOcrError(null);
      setOcrProgress(0.02);
      setOcrStatus('Preparando…');
      setPhase('processing');
      try {
        const text = await runLocalOcr(imageDataUrl, (p) => {
          setOcrStatus(p.status);
          setOcrProgress(p.progress);
        });
        reviewText(text);
        if (text.trim().length > 0) {
          LocalVaultService.incrementScanUsage(); // una sola vez por escaneo con foto exitoso
          forceQuotaRefresh((n) => n + 1);
        } else {
          setOcrError('No se detectó texto. Acércate a la lista de ingredientes con buena luz y vuelve a intentar.');
        }
      } catch (e: any) {
        reviewText('');
        setOcrError(e?.message || 'No se pudo leer la etiqueta.');
      }
      setPhase('review');
    },
    [reviewText]
  );

  // Si la base LuBo se actualiza mientras se revisa una etiqueta, se recalcula con la lista nueva.
  useEffect(() => {
    setAnalysis((prev) => (prev ? analyzeIngredientsText(prev.rawText, LocalVaultService.getIngredients()) : prev));
  }, [dbVersion]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !LocalVaultService.canPerformCameraScan().allowed) return;
    const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    processImage(canvas.toDataURL('image/jpeg', 0.92));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !LocalVaultService.canPerformCameraScan().allowed) return;
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && processImage(reader.result);
    reader.readAsDataURL(file);
  };

  const finishWithProduct = (product: Product) => {
    onProductScanned(product);
    onClose();
  };

  const handleOpenFicha = async () => {
    if (!analysis || analysis.matchedIngredients.length === 0) return;
    const thumbnail = capturedImage ? await createThumbnail(capturedImage) : undefined;
    finishWithProduct(buildProductFromAnalysis(analysis, { source: 'camera', thumbnail }));
  };

  // Texto escrito: siempre ilimitado y 100% local.
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = manualText.trim();
    if (!query) return;
    const q = query.toLowerCase();
    const found = allProducts.find((p) => p.upc.toLowerCase() === q || p.name.toLowerCase() === q);
    if (found) return finishWithProduct(found);
    const result = analyzeIngredientsText(query, LocalVaultService.getIngredients());
    finishWithProduct(buildProductFromAnalysis(result, { source: 'text' }));
  };

  if (!isOpen) return null;

  const samples = allProducts.slice(0, 4);

  const manualForm = (
    <form onSubmit={handleManualSubmit} className="flex items-center gap-2 w-full">
      <input
        type="text"
        value={manualText}
        onChange={(e) => setManualText(e.target.value)}
        placeholder="Escribe un ingrediente o pega la lista…"
        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-[12.5px] text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-[#cce510]"
      />
      <button
        type="submit"
        className="px-4 py-2.5 rounded-xl bg-[#cce510] text-[#341011] text-[12px] font-black active:scale-95 cursor-pointer"
      >
        Evaluar
      </button>
    </form>
  );

  const hud = (
    <div className="pt-safe px-4 py-3 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`w-2.5 h-2.5 rounded-full bg-[#cce510] ${phase === 'live' ? 'animate-ping' : ''}`} />
        <span className="font-bold text-[13px] tracking-wide text-[#cce510] uppercase">Lente Bio-Espectral</span>
        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-[#cce510]">
          {scanCheck.maxWeeklyScans <= FREE_WEEKLY_CAMERA_SCANS
            ? `${scanCheck.weeklyScansUsed}/${FREE_WEEKLY_CAMERA_SCANS} escaneos semanales`
            : 'Escaneos Ilimitados ⭐'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {phase === 'live' && !isBlocked && torchSupported && (
          <button
            onClick={toggleTorch}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              torchOn ? 'bg-[#cce510] text-[#341011]' : 'bg-white/20 text-white'
            }`}
            title="Luz / Flash"
          >
            <span className="material-symbols-outlined text-[18px]">{torchOn ? 'flashlight_on' : 'flashlight_off'}</span>
          </button>
        )}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
          title="Cerrar escáner"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1c1c]/95 flex flex-col justify-between text-white backdrop-blur-md">
      {hud}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

      {/* ── Límite semanal alcanzado ── */}
      {isBlocked && phase === 'live' && (
        <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-4 overflow-y-auto max-w-md mx-auto w-full text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 mb-4">
            <span className="material-symbols-outlined text-[40px]">lock</span>
          </div>
          <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 mb-2">
            Límite semanal de {FREE_WEEKLY_CAMERA_SCANS} escaneos alcanzado
          </span>
          <h3 className="text-[20px] font-black leading-tight mb-2">Has completado tus {FREE_WEEKLY_CAMERA_SCANS} escaneos semanales</h3>
          <p className="text-[12.5px] text-white/80 leading-relaxed mb-4">
            El Plan Free incluye {FREE_WEEKLY_CAMERA_SCANS} escaneos con cámara por semana. Pásate al <strong>Plan Mensual ({PLAN_PRICE_LABEL.monthly})</strong> o{' '}
            <strong>Plan Anual ({PLAN_PRICE_LABEL.annual})</strong> para escaneos ilimitados.
          </p>
          <div className="w-full bg-[#cce510]/15 border border-[#cce510]/40 rounded-2xl p-3.5 mb-4 text-left">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[18px] text-[#cce510]">verified</span>
              <span className="text-[11px] font-black uppercase text-[#cce510]">¡Opciones 100% ilimitadas en tu plan!</span>
            </div>
            <p className="text-[11.5px] text-white/90 leading-snug">
              Escribir ingredientes, el semáforo y las <strong>Alternativas LuBo</strong> son <strong>ilimitados</strong>. Pruébalo aquí:
            </p>
          </div>
          <div className="w-full flex flex-col gap-3">
            {manualForm}
            {onOpenInicioModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInicioModal();
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#cce510] hover:bg-[#dcf52a] text-[#341011] text-[13px] font-black shadow-lg shadow-[#cce510]/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">credit_card</span>
                <span>Ver Planes en COP ({PLAN_PRICE_LABEL.monthly} / {PLAN_PRICE_LABEL.annual})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Visor en vivo ── */}
      {!isBlocked && phase === 'live' && (
        <>
          <div className="relative flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
            {stream ? (
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80" playsInline muted autoPlay />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1b2612] via-[#10190a] to-[#251012] flex items-center justify-center">
                <video ref={videoRef} className="hidden" playsInline muted />
                <div className="w-96 h-96 rounded-full bg-[#cce510]/5 blur-3xl pointer-events-none" />
              </div>
            )}

            <div className="relative w-72 h-72 rounded-3xl border-2 border-[#cce510]/60 shadow-[0_0_30px_rgba(204,229,16,0.25)] flex flex-col items-center justify-between p-4 z-10">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#cce510] rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#cce510] rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#cce510] rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#cce510] rounded-br-xl" />
              {stream && <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-[#cce510] to-transparent shadow-[0_0_12px_#cce510] animate-scan-laser" />}
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#cce510] bg-black/50 px-2.5 py-0.5 rounded-full mt-2">
                Enfoca la lista de ingredientes
              </span>
              <span className="text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full">Se lee en tu dispositivo · sin internet</span>
            </div>

            {cameraError && (
              <div className="absolute bottom-3 left-4 right-4 z-20 bg-black/70 border border-amber-400/40 text-amber-200 text-[11.5px] rounded-xl px-3 py-2 text-center">
                {cameraError}
              </div>
            )}
          </div>

          <div className="px-4 pt-3 pb-safe pb-5 flex flex-col gap-3 z-20 bg-gradient-to-t from-black/90 to-transparent max-w-md mx-auto w-full">
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
                title="Subir o tomar foto"
              >
                <span className="material-symbols-outlined text-[22px]">photo_library</span>
              </button>
              <button
                onClick={handleCapture}
                disabled={!stream}
                className="w-[68px] h-[68px] rounded-full border-4 border-[#cce510] bg-[#cce510]/20 flex items-center justify-center active:scale-95 disabled:opacity-40 cursor-pointer"
                title="Capturar foto de ingredientes"
              >
                <span className="w-[50px] h-[50px] rounded-full bg-[#cce510]" />
              </button>
              <span className="w-12 h-12" />
            </div>
            {manualForm}
            {samples.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] text-white/60 shrink-0 font-medium">Muestras:</span>
                {samples.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => finishWithProduct(p)}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#cce510] hover:text-[#341011] text-white text-[10px] font-bold shrink-0 transition-colors cursor-pointer max-w-[140px] truncate"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Procesando (vista previa + OCR) ── */}
      {phase === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 max-w-md mx-auto w-full">
          {capturedImage && (
            <img src={capturedImage} alt="Vista previa de la etiqueta" className="max-h-[42vh] rounded-2xl border-2 border-[#cce510]/60 shadow-[0_0_30px_rgba(204,229,16,0.25)] object-contain" />
          )}
          <div className="w-full">
            <div className="flex justify-between text-[11px] font-bold text-[#cce510] mb-1.5">
              <span>{ocrStatus}</span>
              <span>{Math.round(ocrProgress * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-[#cce510] transition-all duration-300" style={{ width: `${Math.round(ocrProgress * 100)}%` }} />
            </div>
            <p className="text-[11px] text-white/60 text-center mt-3">Leyendo en tu dispositivo. Tu foto no se envía a ningún servidor.</p>
          </div>
        </div>
      )}

      {/* ── Revisión: texto editable + semáforo ── */}
      {phase === 'review' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 max-w-md mx-auto w-full flex flex-col gap-3">
          {capturedImage && (
            <img src={capturedImage} alt="Etiqueta capturada" className="max-h-32 w-full rounded-xl border border-white/20 object-cover" />
          )}
          {ocrError && (
            <div className="bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[12px] rounded-xl px-3 py-2">{ocrError}</div>
          )}

          <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#cce510]">
            Texto leído (puedes corregirlo)
          </label>
          <textarea
            value={ocrText}
            onChange={(e) => reviewText(e.target.value)}
            rows={4}
            placeholder="Escribe o pega aquí los ingredientes…"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-[12.5px] text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-[#cce510] resize-none"
          />

          {analysis && (
            <div className="bg-white/10 border border-white/15 rounded-2xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-black uppercase">
                  {analysis.overallStatus === 'red'
                    ? '🔴 Semáforo rojo'
                    : analysis.overallStatus === 'yellow'
                    ? '🟡 Semáforo amarillo'
                    : analysis.overallStatus === 'green'
                    ? '🟢 Semáforo verde'
                    : '⚪ Sin coincidencias'}
                </span>
                <TrafficLightBadge status={analysis.overallStatus} size="sm" onDark />
              </div>
              <p className="text-[12px] leading-relaxed text-white/90">{analysis.verdict}</p>

              {analysis.matchedIngredients.length > 0 && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/10 max-h-40 overflow-y-auto">
                  {analysis.matchedIngredients.map((m) => (
                    <div key={m.ingredient.id} className="flex items-center justify-between gap-2 text-[11px] bg-black/20 rounded-lg px-2 py-1">
                      <span className="font-bold truncate">{m.ingredient.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="text-white/60 truncate max-w-[110px]">{getFunctionalRiskOrBenefit(m.ingredient)}</span>
                        <TrafficLightBadge status={getIngredientLight(m.ingredient)} size="sm" showLabel={false} onDark />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {analysis.summary.unrecognizedCount > 0 && analysis.overallStatus !== 'unknown' && (
                <p className="text-[10.5px] text-white/60 pt-1 border-t border-white/10">
                  {analysis.summary.unrecognizedCount} término(s) no están en la base LuBo y no se clasificaron: {analysis.unrecognizedTokens.slice(0, 4).join(', ')}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pb-4">
            <button
              onClick={() => setPhase('live')}
              className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-[12.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              Otra foto
            </button>
            <button
              onClick={handleOpenFicha}
              disabled={!analysis || analysis.matchedIngredients.length === 0}
              className="flex-[1.4] py-3 rounded-xl bg-[#cce510] text-[#341011] text-[12.5px] font-black disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Ver ficha completa
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
