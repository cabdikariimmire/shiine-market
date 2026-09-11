'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { success, error, info } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage('Fadlan geli email-ka iyo furaha sirta ah.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await login(cleanEmail, cleanPassword);
      if (res.success && res.user) {
        const roleLabel = res.user.role === 'admin' ? 'Admin' : (res.user.role === 'seller' ? 'Seller / Iibiye' : 'Reporter');
        success('Ku soo dhawoow Tukaan POS!', `Waxaad ku gashay: ${res.user.name} (${roleLabel})`);
        
        const targetUrl = res.user.role === 'seller' ? '/sales/new' : '/dashboard';
        router.replace(targetUrl);
      } else {
        const errorMsg = res.error || 'Email ama furaha sirta ah ma saxna';
        setErrorMessage(errorMsg);
        error('Galitaanka waa la diiday', errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Khalad baa dhacay intii lagu jiray galitaanka';
      setErrorMessage(errorMsg);
      error('Khalad', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Background Subtle Atmosphere Glows */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Card Header & Brand */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
          <div className="text-center space-y-3">
            {/* Official Tukaan POS Logo */}
            <div className="flex justify-center">
              <Image 
                src="/logo.png" 
                alt="Tukaan POS Logo" 
                width={180}
                height={56}
                priority
                className="h-14 w-auto object-contain"
              />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center justify-center gap-2">
                TUKAAN <span className="text-white text-xs sm:text-sm font-extrabold px-2.5 py-0.5 bg-emerald-600 rounded-lg shadow-xs">POS</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Nidaamka Maamulka Dukaan
              </p>
            </div>
          </div>

          {/* Error Message if present */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm text-red-700">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="tusaale@tukaan.so"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 bg-white border border-slate-300 rounded-xl pl-10 pr-4 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-all font-medium"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  Furaha Sirta
                </label>
                <button
                  type="button"
                  onClick={() => info('Dib-u-dejinta Furaha', 'Fadlan la xiriir Maamulka dukaanka (Admin) si laguu siiyo furahaaga sirta ah.')}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  Illowday furaha sirta?
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 bg-white border border-slate-300 rounded-xl pl-10 pr-11 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-all font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-emerald-600 p-1 rounded-lg transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Qari furaha' : 'Muuji furaha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/30 gap-2 mt-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Hubinayaa...</span>
                </>
              ) : (
                <>
                  <span>Gal System-ka</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 font-medium">
          © {new Date().getFullYear()} Tukaan POS. Dhammaan xuquuqda waa dhowran tahay.
        </p>
      </div>
    </div>
  );
}
