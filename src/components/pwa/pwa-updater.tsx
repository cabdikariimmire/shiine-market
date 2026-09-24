'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PwaUpdater() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // If there's an update already waiting to activate
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setShowUpdatePrompt(true);
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available, do NOT force reload during active workflow
                setWaitingWorker(newWorker);
                setShowUpdatePrompt(true);
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setShowUpdatePrompt(false);
    }
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl bg-slate-900/95 text-white p-4 shadow-2xl border border-emerald-500/30 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-400">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 text-sm">
          <h4 className="font-bold text-slate-100">Nooc Cusub (Update)</h4>
          <p className="text-xs text-slate-300 mt-0.5">
            Waxaa jira nooc cusub oo system-ka ah.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleUpdate}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 text-xs px-3 shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Cusboonaysii</span>
            </Button>
            <button
              onClick={() => setShowUpdatePrompt(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Dib u dhig
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
