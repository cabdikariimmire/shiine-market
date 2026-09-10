'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewPurchaseRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/suppliers');
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 text-slate-500">
      <p>Dib-u-hagaajinaya bogga Qeybiyeyaasha (Redirecting to Suppliers)...</p>
    </div>
  );
}
