'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { syncEngine, SyncEngineState } from '@/lib/offline/sync-engine';

export function PwaSyncIndicator() {
  const [state, setState] = useState<SyncEngineState>(syncEngine.getState());

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = () => {
    if (state.isOnline && !state.isSyncing) {
      syncEngine.syncPendingTransactions();
    }
  };

  // Determine badge style and text
  if (!state.isOnline) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
        title="Waxaad ku jirtaa khadka ka baxsanaan (Offline). Iibka waxaa lagu kaydinayaa qalabka."
      >
        <WifiOff className="h-3.5 w-3.5 animate-pulse text-amber-500" />
        <span>Offline</span>
        {state.pendingCount > 0 && (
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
            {state.pendingCount}
          </span>
        )}
      </div>
    );
  }

  if (state.isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
        <span>Waxaa la dirayaa...</span>
      </div>
    );
  }

  if (state.conflictCount > 0) {
    return (
      <button
        onClick={handleManualSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
        title="Waxaa jira iib u baahan hubin maadaama stock-ku is beddelay intii aad offline ahayd. Guji si aad mar kale u eegto."
      >
        <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
        <span>Waxaa jira iib u baahan hubin ({state.conflictCount})</span>
      </button>
    );
  }

  if (state.pendingCount > 0) {
    return (
      <button
        onClick={handleManualSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
        title="Guji si aad hadda u dirto xogta sugaysa"
      >
        <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
        <span>{state.pendingCount} iib ayaa sugaya sync</span>
      </button>
    );
  }

  return (
    <div 
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
      title="Online & Xogtu waa la dhex-dhexaadiyey (Synced)"
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      <span>Online</span>
    </div>
  );
}
