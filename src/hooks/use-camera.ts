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
  startCamera: (overrideFacingMode?: 'environment' | 'user') => Promise<boolean>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  captureFrame: () => Promise<{ blob: Blob; dataUrl: string; width: number; height: number } | null>;
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

  // Helper to enumerate and discover cameras
  const refreshDevices = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const isMobileDevice = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // On mobile devices, back and front cameras are standard; enable switch even if enumeration is restricted
        setHasMultipleCameras(videoDevices.length > 1 || isMobileDevice);
      } catch (e) {
        console.warn('[Camera] enumerateDevices notice:', e);
      }
    }
  }, []);

  // Initial secure context and device check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const secure = window.isSecureContext || isLocalhost;
      setIsSecureContext(secure);
    }
    refreshDevices();
  }, [refreshDevices]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.error('[Camera] Error stopping track:', e);
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

  const startCamera = useCallback(async (overrideFacingMode?: 'environment' | 'user'): Promise<boolean> => {
    const targetMode = overrideFacingMode || facingMode;
    setFacingMode(targetMode);
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

    // 3. Multi-tier camera constraints:
    // Try HD with target facingMode -> Flexible resolution with target facingMode -> Pure facingMode -> Generic video
    const constraintCandidates: MediaStreamConstraints[] = [
      // Primary: Mobile rear camera preference with ideal HD dimensions
      {
        video: {
          facingMode: { ideal: targetMode },
          width: { ideal: idealWidth, max: 1920 },
          height: { ideal: idealHeight, max: 1080 },
        },
        audio: false,
      },
      // Tier 2: Flexible dimensions (responsive for vertical portrait phones)
      {
        video: {
          facingMode: { ideal: targetMode },
          width: { ideal: 1280, min: 480 },
          height: { ideal: 720, min: 360 },
        },
        audio: false,
      },
      // Tier 3: Pure facingMode constraint (ensures rear camera is kept on mobile even if resolution fails)
      {
        video: {
          facingMode: { ideal: targetMode },
        },
        audio: false,
      },
      // Tier 4: Exact facingMode constraint
      {
        video: {
          facingMode: targetMode === 'environment' ? 'environment' : 'user',
        },
        audio: false,
      },
      // Tier 5: Generic video fallback (mainly for PC webcams without facingMode)
      {
        video: true,
        audio: false,
      },
    ];

    let stream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintCandidates) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream && stream.getVideoTracks().length > 0) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        // Continue trying next constraint tier
      }
    }

    if (!stream || stream.getVideoTracks().length === 0) {
      console.error('[Camera] All camera constraints failed. Last error:', lastError);

      let somaliMessage = 'Camera-da lama furi karin. Fadlan mar kale isku day.';
      const errName = lastError?.name || '';

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        somaliMessage = 'Camera-da waa la diiday. Fadlan browser-ka ka oggolow Camera permission (Settings -> Site permissions).';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        somaliMessage = 'Camera lagama helin qalabkan.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        somaliMessage = 'Camera-da waxaa isticmaalaya app kale ama tab kale.';
      } else if (errName === 'SecurityError') {
        somaliMessage = 'Camera-da waxay u baahan tahay HTTPS. Fadlan isticmaal HTTPS URL-ka app-ka.';
      } else if (errName === 'OverconstrainedError') {
        somaliMessage = 'Tayada camera-da la codsaday qalabku ma taageero.';
      }

      setCameraError(somaliMessage);
      setIsStarting(false);
      return false;
    }

    streamRef.current = stream;

    // Inspect and verify active video track
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings ? track.getSettings() : ({} as MediaTrackSettings);
    console.log('[Camera] Active stream track acquired:', {
      label: track.label,
      facingMode: settings.facingMode || targetMode,
      deviceId: settings.deviceId,
      width: settings.width,
      height: settings.height,
      readyState: track.readyState,
    });

    if (videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;

      // Wait for video metadata/readiness before declaring active
      await new Promise<void>((resolve) => {
        if (video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
          return;
        }

        const handleReady = () => {
          video.removeEventListener('loadedmetadata', handleReady);
          video.removeEventListener('canplay', handleReady);
          video.removeEventListener('playing', handleReady);
          resolve();
        };

        video.addEventListener('loadedmetadata', handleReady);
        video.addEventListener('canplay', handleReady);
        video.addEventListener('playing', handleReady);

        // Safety fallback timer
        setTimeout(resolve, 800);
      });

      try {
        await video.play();
      } catch (playErr) {
        console.warn('[Camera] video.play() auto-play notice:', playErr);
      }
    }

    // Refresh devices now that permission is unlocked
    refreshDevices();

    setIsCameraActive(true);
    setIsStarting(false);
    return true;
  }, [facingMode, idealHeight, idealWidth, refreshDevices, stopCamera]);

  const switchCamera = useCallback(async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isCameraActive) {
      stopCamera();
      // Pass nextMode directly to startCamera so there's no stale closure
      await startCamera(nextMode);
    }
  }, [facingMode, isCameraActive, startCamera, stopCamera]);

  const captureFrame = useCallback(async (): Promise<{ blob: Blob; dataUrl: string; width: number; height: number } | null> => {
    if (!videoRef.current || !isCameraActive) {
      return null;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('[Camera] Video frame not ready for capture:', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
      return null;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.92);
    });

    if (!blob) return null;

    return { blob, dataUrl, width, height };
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
