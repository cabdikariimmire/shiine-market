'use client';

import React from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/lib/auth/auth-context';
import { PwaUpdater } from '@/components/pwa/pwa-updater';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        {children}
        <PwaUpdater />
      </AuthProvider>
    </ToastProvider>
  );
}

