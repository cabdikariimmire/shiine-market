'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseCameraOptions {
  preferredFacingMode?: 'environment' | 'user';
  idealWidth?: number;
  idealHeight?: number;
}

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isCameraActive: boolean;
  isStarting: boolean;
  cameraError: string | null;
  hasMultipleCameras: boolean;
  facingMode: 'environment' | 'user';
  isSecureContext: boolean;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  captureFrame: () => Promise<{ blob: Blob; dataUrl: string } | null>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    preferredFacingMode = 'environment',
    idealWidth = 1280,
    idealHeight = 720,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(preferredFacingMode);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(true);

  // Check secure context and available video input devices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const secure = window.isSecureContext || isLocalhost;
      setIsSecureContext(secure);
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          setHasMultipleCameras(videoDevices.length > 1);
        })
        .catch(() => {});
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping track:', e);
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setIsStarting(false);
  }, []);

  const startCamera = useCallback(async (): Promise<boolean> => {
    setCameraError(null);
    setIsStarting(true);

    // 1. Secure Context Check (Required for camera on mobile browsers)
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!window.isSecureContext && !isLocalhost) {
        const errMsg = 'Camera-da waxay u baahan tahay HTTPS. Fadlan isticmaal HTTPS URL-ka app-ka.';
        setCameraError(errMsg);
        setIsStarting(false);
        return false;
      }
    }

    // 2. Browser MediaDevices Support Check
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = 'Browser-ka aad isticmaalayso ma taageero camera API (getUserMedia).';
      setCameraError(errMsg);
      setIsStarting(false);
      return false;
    }

    // Stop any existing stream first to avoid resource locks
    stopCamera();

    // 3. Request Stream with mobile-first rear camera constraints and desktop fallback
    let stream: MediaStream | null = null;

    try {
      // Primary: Mobile rear camera preference with HD resolution
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: idealWidth },
          height: { ideal: idealHeight },
        },
        audio: false,
      });
    } catch (primaryErr: any) {
      console.warn('Primary camera constraints failed, attempting fallback:', primaryErr);
      
      try {
        // Fallback: Basic video constraint for laptops/webcams without facingMode
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (fallbackErr: any) {
        console.error('All camera initialization failed:', fallbackErr);

        let somaliMessage = 'Camera-da lama furi karin. Fadlan mar kale isku day.';
        const errName = fallbackErr?.name || primaryErr?.name || '';

        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          somaliMessage = 'Camera-da waa la diiday. Fadlan browser-ka ka oggolow Camera permission.';
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          somaliMessage = 'Camera lagama helin qalabkan.';
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          somaliMessage = 'Camera-da waxaa isticmaalaya app kale.';
        } else if (errName === 'SecurityError') {
          somaliMessage = 'Camera-da waxay u baahan tahay HTTPS. Fadlan isticmaal HTTPS URL-ka app-ka.';
        } else if (errName === 'OverconstrainedError') {
          somaliMessage = 'Tayada camera-da la codsaday qalabku ma taageero.';
        }

        setCameraError(somaliMessage);
        setIsStarting(false);
        return false;
      }
    }

    if (!stream) {
      setCameraError('Camera stream lama helin.');
      setIsStarting(false);
      return false;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch (playErr) {
        console.warn('video.play() auto-play prevented or delayed:', playErr);
      }
    }

    setIsCameraActive(true);
    setIsStarting(false);
    return true;
  }, [facingMode, idealHeight, idealWidth, stopCamera]);

  const switchCamera = useCallback(async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isCameraActive) {
      stopCamera();
      // Small tick before starting next stream
      setTimeout(() => {
        startCamera();
      }, 150);
    }
  }, [facingMode, isCameraActive, startCamera, stopCamera]);

  const captureFrame = useCallback(async (): Promise<{ blob: Blob; dataUrl: string } | null> => {
    if (!videoRef.current || !isCameraActive || videoRef.current.readyState < 2) {
      return null;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.92);
    });

    if (!blob) return null;

    return { blob, dataUrl };
  }, [isCameraActive]);

  // Clean up tracks on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
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
    captureFrame,
  };
}
