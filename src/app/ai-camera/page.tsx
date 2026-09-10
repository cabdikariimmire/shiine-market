'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Camera, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  FileText, 
  RefreshCw, 
  Video, 
  VideoOff, 
  Upload, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCw,
  X,
  Image as ImageIcon,
  Building2,
  Lock,
  ExternalLink,
  Play
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useCamera } from '@/hooks/use-camera';
import { detectionService } from '@/lib/services/ai-detection';
import { invoiceOCRService } from '@/lib/services/ai-ocr';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { DetectionResult, InvoiceScanResult, InvoiceScannedItem, ProductVariant, Supplier } from '@/types';

export default function AICameraPage() {
  const router = useRouter();
  const { success, error, info } = useToast();

  const [activeMode, setActiveMode] = useState<'live_count' | 'invoice_scan'>('live_count');
  const [allVariants, setAllVariants] = useState<ProductVariant[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Camera Hook Integration
  const {
    videoRef,
    isCameraActive,
    isStarting,
    cameraError,
    hasMultipleCameras,
    facingMode,
    isSecureContext,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame
  } = useCamera({ preferredFacingMode: 'environment', idealWidth: 1280, idealHeight: 720 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isLiveCountingStarted, setIsLiveCountingStarted] = useState(false);
  const [liveDetections, setLiveDetections] = useState<DetectionResult[]>([]);

  // Invoice OCR State
  const [invoiceInputMethod, setInvoiceInputMethod] = useState<'camera' | 'upload'>('camera');
  const [capturedInvoiceImage, setCapturedInvoiceImage] = useState<string | null>(null);
  const [uploadedInvoiceFile, setUploadedInvoiceFile] = useState<File | null>(null);
  const [uploadedInvoicePreview, setUploadedInvoicePreview] = useState<string | null>(null);
  const [isScanningInvoice, setIsScanningInvoice] = useState(false);
  const [ocrProgressText, setOcrProgressText] = useState<string>('');
  const [ocrProgressPercent, setOcrProgressPercent] = useState<number>(0);
  const [invoiceResult, setInvoiceResult] = useState<InvoiceScanResult | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // File input ref for upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    repository.getVariantsPaginated('', 'all', 'all', 1, 10000).then(res => setAllVariants(res.data)).catch(console.error);
    repository.getSuppliers().then(setSuppliers).catch(console.error);

    // Initialize TensorFlow Object Detection
    detectionService.initialize().then((ready) => {
      setIsModelReady(ready);
    });

    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Clean up when switching modes
  const handleModeSwitch = (mode: 'live_count' | 'invoice_scan') => {
    setActiveMode(mode);
    setIsLiveCountingStarted(false);
    if (mode === 'invoice_scan') {
      stopCamera();
    } else {
      setCapturedInvoiceImage(null);
      setInvoiceResult(null);
    }
  };

  // Continuous Detection Loop for Live Video
  useEffect(() => {
    let animationFrameId: number;
    let isSubscribed = true;

    const runDetection = async () => {
      if (
        isSubscribed &&
        activeMode === 'live_count' &&
        isCameraActive &&
        isLiveCountingStarted &&
        videoRef.current &&
        videoRef.current.readyState >= 2
      ) {
        try {
          const results = await detectionService.detectFrame(videoRef.current, allVariants);
          if (isSubscribed) {
            setLiveDetections(results);

            // Draw real bounding boxes on canvas overlay
            if (canvasRef.current && videoRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                canvasRef.current.width = videoRef.current.videoWidth || 640;
                canvasRef.current.height = videoRef.current.videoHeight || 480;
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                results.forEach((res) => {
                  res.boundingBoxes?.forEach((box) => {
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(box.x, box.y, box.width, box.height);

                    ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
                    ctx.fillRect(box.x, box.y - 24, box.width, 24);

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillText(`${res.productName} (${res.confidence}%)`, box.x + 6, box.y - 6);
                  });
                });
              }
            }
          }
        } catch (e) {
          console.error('Detection frame execution error:', e);
        }
      }

      if (isSubscribed && activeMode === 'live_count' && isCameraActive && isLiveCountingStarted) {
        animationFrameId = requestAnimationFrame(runDetection);
      }
    };

    if (activeMode === 'live_count' && isCameraActive && isLiveCountingStarted) {
      runDetection();
    }

    return () => {
      isSubscribed = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeMode, isCameraActive, isLiveCountingStarted, allVariants, videoRef]);

  // Capture Frame from Real Live Camera for Invoice
  const handleCaptureInvoiceFrame = async () => {
    try {
      const frame = await captureFrame();
      if (!frame) {
        error('Sawir lama qaadin', 'Fadlan hubi in kaamiradu shaqaynayso.');
        return;
      }
      setCapturedInvoiceImage(frame.dataUrl);
      stopCamera();
      info('Sawirkii waa la qaaday!', 'Hadda guji "Baadh & Akhri Invoice-ka" si AI-du u akhriso.');
    } catch (err: any) {
      error('Khalad baa dhacay marka sawirka la qaadayey', err.message);
    }
  };

  // Handle File Upload for Invoice
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error('Fayl qaldan', 'Fadlan soo geli fayl sawir ah (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      error('Sawirku wuu aad u weyn yahay', 'Fadlan soo geli sawir ka yar 20MB.');
      return;
    }

    setUploadedInvoiceFile(file);
    const previewUrl = URL.createObjectURL(file);
    setUploadedInvoicePreview(previewUrl);
    setCapturedInvoiceImage(null);
    setInvoiceResult(null);
  };

  const handleClearInvoiceInput = () => {
    setCapturedInvoiceImage(null);
    setUploadedInvoiceFile(null);
    if (uploadedInvoicePreview) {
      URL.revokeObjectURL(uploadedInvoicePreview);
      setUploadedInvoicePreview(null);
    }
    setInvoiceResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Run AI Invoice OCR Scan
  const handleScanInvoice = async () => {
    const targetSource = invoiceInputMethod === 'camera' 
      ? capturedInvoiceImage 
      : (uploadedInvoiceFile || uploadedInvoicePreview);

    // CRITICAL VALIDATION: No image = No OCR = No fabricated data
    if (!targetSource) {
      error('Invoice Lama Helin', 'Fadlan marka hore sawir ama soo geli invoice-ka.');
      return;
    }

    setIsScanningInvoice(true);
    setOcrProgressPercent(10);
    setOcrProgressText('Faylka invoice-ka ayaa la furayaa...');

    try {
      const result = await invoiceOCRService.scanInvoice(
        targetSource,
        allVariants,
        (pct, text) => {
          setOcrProgressPercent(pct);
          setOcrProgressText(text);
        }
      );

      setInvoiceResult(result);
      success('Invoice-ka waa la akhriyey!', `${result.items.length} xariiq oo alaab ah ayaa la helay.`);
    } catch (err: any) {
      error('Akhrinta Invoice-ka', err.message || 'Invoice-ka si sax ah looma akhrin karin. Fadlan sawir cad ka qaad oo mar kale isku day.');
    } finally {
      setIsScanningInvoice(false);
      setOcrProgressText('');
      setOcrProgressPercent(0);
    }
  };

  // Confirm Live AI Count to Stock
  const handleConfirmLiveCount = async (item: DetectionResult, targetVariantId: string, quantityToAdd: number) => {
    if (!targetVariantId) {
      error('Dooro alaabta/nooca aad kaydka ugu darayso');
      return;
    }

    try {
      const variant = allVariants.find(v => v.id === targetVariantId);
      if (!variant) throw new Error('Variant not found');

      await repository.recordStockAdjustment(
        targetVariantId,
        quantityToAdd,
        `AI Live Camera Count: +${quantityToAdd} ${variant.selling_unit} (${item.confidence}% confidence)`
      );

      success('Kaydka waa la cusbooneysiiyey!', `${variant.product?.name} (${variant.variant_name}) +${quantityToAdd} ${variant.selling_unit}`);
      
      // Update local state to reflect new stock
      const fresh = await repository.getVariantsPaginated('', 'all', 'all', 1, 10000);
      setAllVariants(fresh.data);
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Send Scanned Invoice Items to Products Table as PENDING Rows
  const handleConfirmInvoiceToProducts = async () => {
    if (!invoiceResult) return;

    try {
      const count = await repository.confirmScannedInvoiceToPending(invoiceResult, selectedSupplierId || undefined);
      success(
        'Alaabta waxaa loo diray qaybta Products!',
        `${count} nooc ayaa hadda ku jira Products table iyagoo ah PENDING si aad u saxdo oo u keydiso.`
      );
      router.push('/products?status=pending');
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Update item field in OCR result
  const handleUpdateItemField = (idx: number, field: keyof InvoiceScannedItem, value: any) => {
    if (!invoiceResult) return;
    const updatedItems = [...invoiceResult.items];
    updatedItems[idx] = {
      ...updatedItems[idx],
      [field]: value,
      totalCost: field === 'quantity' || field === 'buyPrice'
        ? Math.round((field === 'quantity' ? value : updatedItems[idx].quantity) * (field === 'buyPrice' ? value : updatedItems[idx].buyPrice) * 100) / 100
        : updatedItems[idx].totalCost
    };

    const newTotal = updatedItems.reduce((sum, item) => sum + item.totalCost, 0);

    setInvoiceResult({
      ...invoiceResult,
      items: updatedItems,
      totalAmount: Math.round(newTotal * 100) / 100
    });
  };

  const handleSwitchToHttps = () => {
    if (typeof window !== 'undefined') {
      window.location.href = window.location.href.replace('http:', 'https:');
    }
  };

  return (
    <AppShell title="AI Camera">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Camera className="h-6 w-6 text-emerald-600" />
              Kaamirada Caqliga Badan (Real AI Vision & OCR)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Tirinta tooska ah ee baakidhka, akhriska saxda ah ee invoice-ka warqadda ah iyo hubinta shaqaalaha
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              100% Real Camera & Verified Input
            </span>
          </div>
        </div>

        {/* Dynamic Insecure Context Notice ONLY if accessed via HTTP on mobile LAN */}
        {!isSecureContext && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs">
            <div className="flex items-start gap-2.5">
              <Lock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-bold text-sm block">Camera-da waxay u baahan tahay HTTPS:</strong>
                Browser-ka mobilku wuxuu ogolaadaa kaamirada marka aad app-ka kaga xiranto HTTPS. Fadlan ku fur cinwaanka HTTPS.
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={handleSwitchToHttps}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 text-xs gap-1.5 shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" /> U wareeg HTTPS
            </Button>
          </div>
        )}

        {/* Camera Error Alert if present */}
        {cameraError && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-2xl flex items-start gap-3 text-red-900 dark:text-red-200 text-xs">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <strong className="font-bold text-sm block">Khalad Kaamero:</strong>
              {cameraError}
            </div>
            <Button size="sm" variant="outline" onClick={startCamera} className="border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 h-8 text-xs shrink-0">
              Dib u tijaabi
            </Button>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleModeSwitch('live_count')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 ${
              activeMode === 'live_count'
                ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs'
                : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shrink-0">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                1. Live Product & Packaging Counting
              </p>
              <p className="text-xs text-slate-500">
                Kaamiradu toos ayey u aqoonsanaysaa jawannada/kartoomada iyadoo qofku xaqiijinayo
              </p>
            </div>
          </button>

          <button
            onClick={() => handleModeSwitch('invoice_scan')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 ${
              activeMode === 'invoice_scan'
                ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                2. Supplier Invoice AI Scan (Real OCR)
              </p>
              <p className="text-xs text-slate-500">
                Sawir dhab ah ama fayl invoice → U dir Products Table sida Pending Rows
              </p>
            </div>
          </button>
        </div>

        {/* ======================================================== */}
        {/* MODE 1: LIVE PACKAGING & OBJECT COUNTING                 */}
        {/* ======================================================== */}
        {activeMode === 'live_count' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Live Camera Viewport with Canvas Overlay */}
            <div className="lg:col-span-7 space-y-3">
              <Card className="relative overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-950 shadow-md aspect-4/3 flex items-center justify-center rounded-2xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-6 text-center space-y-3">
                    <VideoOff className="h-10 w-10 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold">Kaamiradu hadda waa xiran tahay</p>
                      <p className="text-xs text-slate-400 mt-1">Guji badhanka hoose si aad u furto kaamirada tooska ah.</p>
                    </div>
                    <Button 
                      onClick={startCamera} 
                      disabled={isStarting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md"
                    >
                      {isStarting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Kaamirada ayaa la furayaa...
                        </>
                      ) : (
                        <>
                          <Video className="h-4 w-4" /> Fur Kaamirada
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {isCameraActive && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/80 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-xs">
                    <div className={`h-2.5 w-2.5 rounded-full ${isLiveCountingStarted ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                    {isLiveCountingStarted ? 'LIVE AI DETECTING' : 'CAMERA ACTIVE'}
                  </div>
                )}

                {isCameraActive && hasMultipleCameras && (
                  <button
                    onClick={switchCamera}
                    className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/80 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-xs hover:bg-slate-800 transition-colors"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    {facingMode === 'environment' ? 'Camera Dambe' : 'Camera Hore'}
                  </button>
                )}
              </Card>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>✓ Sharciga Amniga: AI si dhuumaaleysi ah kaydka uma beddeli karto.</span>
                <div className="flex items-center gap-2">
                  {isCameraActive && !isLiveCountingStarted && (
                    <Button 
                      size="sm" 
                      onClick={() => setIsLiveCountingStarted(true)} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1.5 shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5" /> Bilaaw Tirinta Live
                    </Button>
                  )}
                  {isCameraActive && (
                    <Button size="sm" variant="outline" onClick={stopCamera} className="text-xs h-8">
                      <VideoOff className="h-3.5 w-3.5 mr-1" /> Jooji Camera
                    </Button>
                  )}
                  {!isCameraActive && (
                    <Button size="sm" variant="outline" onClick={startCamera} className="text-xs h-8">
                      <Video className="h-3.5 w-3.5 mr-1" /> Fur Kaamirada
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Human Verification & Confirmation Panel */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Xaqiijinta Tirinta (Human Confirmation)
                </h3>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {liveDetections.length} la aqoonsaday
                </span>
              </div>

              {!isLiveCountingStarted && isCameraActive ? (
                <div className="py-12 text-center text-slate-500 text-xs space-y-3">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Kaamiradu waa furan tahay.</p>
                  <p className="text-[11px] text-slate-400">Guji badhanka <strong>"Bilaaw Tirinta Live"</strong> si AI-du u bilowdo aqoonsiga jawannada/kartoomada.</p>
                  <Button 
                    size="sm" 
                    onClick={() => setIsLiveCountingStarted(true)} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 mx-auto"
                  >
                    <Play className="h-3.5 w-3.5" /> Bilaaw Tirinta Live
                  </Button>
                </div>
              ) : liveDetections.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <p className="font-medium">Kaamirada u qabo jawannada ama kartoomada la tirinayo.</p>
                  <p className="text-[11px] text-slate-500">AI waxay si toos ah u aqoonsanaysaa walxaha muuqda. Wax data ah lama alifinayo haddii waxba la arki waayo.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {liveDetections.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-xs">
                            {item.productName}
                          </p>
                          <span className="text-[10px] text-emerald-600 font-mono font-bold">
                            Tirada la arkay: {item.quantity} | {item.confidence}% Hubnaan
                          </span>
                        </div>

                        <span className="text-base font-black font-mono text-emerald-600">
                          +{item.quantity}
                        </span>
                      </div>

                      {/* Select Existing Variant to attach */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          U qoondee Nooca Alaabta (Assign Variant):
                        </label>
                        <select
                          id={`select-variant-${idx}`}
                          defaultValue={item.matchedVariant?.id || ''}
                          className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-slate-900 px-3 py-1 text-xs"
                        >
                          <option value="">Dooro Nooc (Variant)...</option>
                          {allVariants.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.product?.name} — {v.variant_name} (Hadda: {v.stock_quantity} {v.selling_unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          const selectEl = document.getElementById(`select-variant-${idx}`) as HTMLSelectElement;
                          handleConfirmLiveCount(item, selectEl?.value, item.quantity);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" /> Xaqiiji & Ku dar Kaydka
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODE 2: SUPPLIER INVOICE OCR SCAN                       */}
        {/* ======================================================== */}
        {activeMode === 'invoice_scan' && (
          <div className="space-y-6">
            {/* Input Selection Card */}
            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Akhrinta Invoice-ka Dhabta ah ee Qeybiyaha
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sawir toos ah kaga qaad kaamirada ama soo geli faylka sawirka invoice-ka
                  </p>
                </div>

                {/* Sub-tab: Camera vs Upload */}
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                  <button
                    onClick={() => {
                      setInvoiceInputMethod('camera');
                      handleClearInvoiceInput();
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      invoiceInputMethod === 'camera'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" /> Kaamero Toos ah
                  </button>
                  <button
                    onClick={() => {
                      setInvoiceInputMethod('upload');
                      stopCamera();
                      handleClearInvoiceInput();
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      invoiceInputMethod === 'upload'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" /> Soo geli Sawir
                  </button>
                </div>
              </div>

              {/* Option A: Camera Mode */}
              {invoiceInputMethod === 'camera' && (
                <div className="space-y-4">
                  {!capturedInvoiceImage && (
                    <div className="max-w-xl mx-auto space-y-3">
                      <div className="relative overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-950 aspect-4/3 rounded-2xl flex items-center justify-center">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />

                        {!isCameraActive && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-6 text-center space-y-3">
                            <Camera className="h-10 w-10 text-slate-400" />
                            <div>
                              <p className="text-sm font-bold">Kaamiradu hadda waa xiran tahay</p>
                              <p className="text-xs text-slate-400 mt-1">U qabo kaamirada warqadda invoice-ka si cad.</p>
                            </div>
                            <Button 
                              onClick={startCamera} 
                              disabled={isStarting}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-md"
                            >
                              {isStarting ? 'Kaamirada ayaa la furayaa...' : 'Fur Kaamirada'}
                            </Button>
                          </div>
                        )}

                        {isCameraActive && (
                          <>
                            {/* Document framing visual guide */}
                            <div className="absolute inset-8 border-2 border-dashed border-blue-400/70 rounded-xl pointer-events-none flex items-center justify-center">
                              <span className="text-[11px] font-bold text-white bg-blue-600/80 px-3 py-1 rounded-full backdrop-blur-xs">
                                Ku beeg invoice-ka halkan
                              </span>
                            </div>

                            {hasMultipleCameras && (
                              <button
                                onClick={switchCamera}
                                className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/80 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-xs hover:bg-slate-800"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                                {facingMode === 'environment' ? 'Camera Dambe' : 'Camera Hore'}
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {isCameraActive && (
                        <div className="flex items-center justify-center gap-3">
                          <Button 
                            onClick={handleCaptureInvoiceFrame} 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 h-11 text-sm gap-2 shadow-md"
                          >
                            <Camera className="h-5 w-5" /> Sawir Invoice-ka
                          </Button>
                          <Button size="sm" variant="ghost" onClick={stopCamera} className="text-xs">
                            Jooji Camera
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Captured Image Preview */}
                  {capturedInvoiceImage && (
                    <div className="max-w-xl mx-auto space-y-4">
                      <div className="relative border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={capturedInvoiceImage} 
                          alt="Captured Invoice" 
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-3 left-3 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                          ✓ Sawirkii waa la qabtay
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCapturedInvoiceImage(null);
                            startCamera();
                          }}
                          className="font-bold gap-2 text-xs"
                        >
                          <RotateCw className="h-4 w-4" /> Mar kale sawir (Retake)
                        </Button>

                        <Button
                          onClick={handleScanInvoice}
                          disabled={isScanningInvoice}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs px-6 h-10 shadow-md"
                        >
                          {isScanningInvoice ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              {ocrProgressText || 'AI OCR Baadhaysaa...'}
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Baadh & Akhri Invoice-ka (Scan)
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Option B: File Upload Mode */}
              {invoiceInputMethod === 'upload' && (
                <div className="max-w-xl mx-auto space-y-4">
                  {!uploadedInvoicePreview ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-3 bg-slate-50/50 dark:bg-slate-900/50"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <ImageIcon className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          Guji halkan si aad u soo geliso sawirka invoice-ka
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          JPG, PNG, ama WEBP (Ilaa 20MB)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={uploadedInvoicePreview} 
                          alt="Uploaded Invoice" 
                          className="w-full h-full object-contain"
                        />
                        <button
                          onClick={handleClearInvoiceInput}
                          className="absolute top-3 right-3 bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 shadow-md"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          onClick={handleClearInvoiceInput}
                          className="font-bold gap-2 text-xs"
                        >
                          Ka saar sawirka
                        </Button>

                        <Button
                          onClick={handleScanInvoice}
                          disabled={isScanningInvoice}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs px-6 h-10 shadow-md"
                        >
                          {isScanningInvoice ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              {ocrProgressText || 'AI OCR Baadhaysaa...'}
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Baadh & Akhri Invoice-ka (Scan)
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Progress indicator during OCR */}
              {isScanningInvoice && (
                <div className="max-w-md mx-auto space-y-2 pt-2">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-bold">
                    <span>{ocrProgressText}</span>
                    <span>{ocrProgressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${ocrProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Extracted Invoice Review & Confirmation */}
            {invoiceResult && (
              <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Xogta Invoice-ka ee La Soo Saaray ({invoiceResult.items.length} Alaabood)
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Invoice #: <strong className="font-mono text-slate-900 dark:text-white">{invoiceResult.invoiceNumber}</strong></span>
                      <span>Taariikh: <strong className="text-slate-900 dark:text-white">{invoiceResult.invoiceDate}</strong></span>
                      <span>Hubnaan: <strong className="text-emerald-600">{invoiceResult.confidence}%</strong></span>
                    </div>
                  </div>

                  {/* Supplier Attachment */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="h-9 rounded-md border border-input bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium"
                      >
                        <option value="">Dooro Alaab-qeybiye (Supplier)...</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.company || 'Shirkad'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      onClick={handleConfirmInvoiceToProducts}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm shadow-emerald-600/20"
                    >
                      U Dir Products Table (Sida Pending Rows) <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Alaabta</th>
                        <th className="px-4 py-3">Nooca (Variant)</th>
                        <th className="px-4 py-3 text-right">Tirada (Qty)</th>
                        <th className="px-4 py-3">Cutubka (Unit)</th>
                        <th className="px-4 py-3 text-right">Qiimaha Soo Iibka</th>
                        <th className="px-4 py-3 text-right">Wadarta</th>
                        <th className="px-4 py-3 text-center">Catalog Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {invoiceResult.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                            <Input
                              value={item.productName}
                              onChange={(e) => handleUpdateItemField(idx, 'productName', e.target.value)}
                              className="h-8 text-xs font-bold bg-transparent"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <Input
                              value={item.variantName}
                              onChange={(e) => handleUpdateItemField(idx, 'variantName', e.target.value)}
                              className="h-8 text-xs bg-transparent text-emerald-700 font-bold"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemField(idx, 'quantity', parseFloat(e.target.value) || 1)}
                              className="h-8 w-20 text-right text-xs font-mono font-bold bg-transparent ml-auto"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <select
                              value={item.purchaseUnit}
                              onChange={(e) => handleUpdateItemField(idx, 'purchaseUnit', e.target.value)}
                              className="h-8 rounded border border-input bg-transparent px-2 text-xs"
                            >
                              <option value="jawan">jawan</option>
                              <option value="kartoon">kartoon</option>
                              <option value="box">box</option>
                              <option value="kiish">kiish</option>
                              <option value="bac">bac</option>
                              <option value="xabo">xabo</option>
                              <option value="kg">kg</option>
                              <option value="litir">litir</option>
                              <option value="packet">packet</option>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.buyPrice}
                              onChange={(e) => handleUpdateItemField(idx, 'buyPrice', parseFloat(e.target.value) || 0)}
                              className="h-8 w-24 text-right text-xs font-mono bg-transparent ml-auto"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                            {formatMoney(item.totalCost)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {item.isExistingProduct ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                                ✓ Catalog-ka ku jira
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-[10px]">
                                + Alaab Cusub
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border-t border-amber-200/60 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>
                    ℹ️ Dhammaan safafkani waxay u wareegi doonaan Products Table sida <strong>PENDING</strong> si loogu qeexo qiimaha iibka (Sell Price) ka hor inta aan kaydka la xaqiijin.
                  </span>
                  <span className="font-bold font-mono text-sm shrink-0">
                    Wadarta Invoice-ka: {formatMoney(invoiceResult.totalAmount)}
                  </span>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
