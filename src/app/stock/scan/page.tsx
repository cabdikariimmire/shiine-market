'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StockScanRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ai-camera');
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 text-slate-500">
      <p>Dib-u-hagaajinaya bogga AI Camera (Redirecting to AI Camera)...</p>
    </div>
  );
}
