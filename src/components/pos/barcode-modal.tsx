'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Barcode, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScannerModal({ isOpen, onClose, onScan }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false);
        setErrorMsg('Kamaraddu kuma shaqeyso browser-kan ama qalabkan.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setHasCamera(true);

      // Start BarcodeDetector if supported natively by browser
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']
        });

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const detected = barcodes[0].rawValue;
                stopCamera();
                onScan(detected);
                onClose();
              }
            } catch (err) {
              // Ignore frame decode exceptions
            }
          }
        }, 300);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasCamera(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Fadlan oggolow fasaxa kamarada browser-ka (Allow Camera).');
      } else {
        setErrorMsg('Kamaradda lama helin ama qalab kale ayaa isticmaalaya.');
      }
    }
  }, [onClose, onScan, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      stopCamera();
      onScan(manualInput.trim());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogClose onClick={onClose} />
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Barcode className="h-5 w-5 text-emerald-600" />
          Scan Barcode (Kamaradda Dukaanka)
        </DialogTitle>
        <DialogDescription>
          U qabo barcode-ka alaabta kamaradda horteeda si toos ah loogu daro dambiisha
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-4 py-3">
        {/* Video Scanner Box */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-slate-800 flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />

          {/* Animated Target Scanning Box */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative h-44 w-64 rounded-xl border-2 border-emerald-500/80 shadow-2xl bg-emerald-500/5">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400 animate-scan-line shadow-[0_0_10px_#10b981]" />
              <div className="absolute top-2 left-2 text-[10px] font-mono text-emerald-400 bg-black/60 px-1.5 py-0.5 rounded">
                BARCODE SCANNER
              </div>
            </div>
          </div>

          {/* Camera Permission or Error State */}
          {errorMsg && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
              <AlertCircle className="h-10 w-10 text-amber-400" />
              <p className="text-sm font-semibold">{errorMsg}</p>
              <Button size="sm" onClick={startCamera} className="font-bold gap-1.5">
                <RefreshCw className="h-4 w-4" /> Mar kale isku day
              </Button>
            </div>
          )}
        </div>

        {/* Manual Barcode Fallback Input */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
            Gacanta ku geli Barcode (Manual Barcode Entry):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Geli lambarka barcode-ka..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 h-10 px-3 rounded-xl border border-slate-300 bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700"
            />
            <Button type="submit" className="font-bold">Ku dar</Button>
          </div>
        </form>
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Xidh</Button>
      </DialogFooter>
    </Dialog>
  );
}
