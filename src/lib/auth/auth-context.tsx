'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SystemUser, UserRole } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface AuthContextType {
  user: SystemUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string; user?: SystemUser }>;
  signUp: (email: string, password: string, fullName?: string, role?: UserRole) => Promise<{ success: boolean; error?: string; user?: SystemUser }>;
  logout: () => Promise<void>;
  canAccess: (pathname: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes allowed for Reporter (Read-Only)
const REPORTER_ALLOWED_PREFIXES = [
  '/dashboard',
  '/reports',
  '/login'
];

// Routes allowed for Seller (POS Only)
const SELLER_ALLOWED_PREFIXES = [
  '/sales/new',
  '/sales',
  '/login'
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SystemUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileForUser = async (authUserId: string, authUserEmail: string, userMetadata?: any): Promise<SystemUser> => {
    let shopId: string | null = null;
    let shopCustomRole: UserRole | null = null;
    let shopCustomName: string | null = null;
    let shopCustomStatus: any = 'active';

    try {
      const { data: shop } = await supabase
        .from('shops')
        .select('id, settings')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (shop) {
        shopId = shop.id;
        if (shop.settings?.users && Array.isArray(shop.settings.users)) {
          const matching = shop.settings.users.find(
            (u: SystemUser) => u.id === authUserId || u.email.toLowerCase() === authUserEmail.toLowerCase()
          );
          if (matching) {
            shopCustomRole = matching.role;
            shopCustomName = matching.name;
            shopCustomStatus = matching.status || 'active';
          }
        }
      }
    } catch (shopErr) {
      console.warn('Shop lookup notice in fetchProfileForUser:', shopErr);
    }

    try {
      // 3.5s timeout race so profile lookup never hangs the UI
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Profile query timed out' } }), 3500)
      );

      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (profile && !error) {
        const roleStr = String(shopCustomRole || profile.role || '').toLowerCase();
        const role: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');
        const email = profile.phone && profile.phone.includes('@') ? profile.phone : authUserEmail;

        return {
          id: profile.id,
          name: shopCustomName || profile.full_name || authUserEmail.split('@')[0] || 'User',
          email,
          role,
          status: shopCustomStatus || 'active',
          created_at: profile.created_at || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Profile fetch notice:', err);
    }

    const metaRole = String(shopCustomRole || userMetadata?.role || '').toLowerCase();
    const assignedRole: UserRole = 
      metaRole === 'reporter' || authUserEmail.toLowerCase().includes('reporter') 
        ? 'reporter' 
        : (metaRole === 'seller' || authUserEmail.toLowerCase().includes('seller') ? 'seller' : 'admin');

    const userName = shopCustomName || userMetadata?.full_name || authUserEmail.split('@')[0] || 'User';

    // Auto-sync profile row to profiles table in background
    if (authUserId) {
      try {
        await supabase.from('profiles').upsert([{
          id: authUserId,
          full_name: userName,
          phone: authUserEmail,
          role: assignedRole,
          shop_id: shopId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
      } catch (upsertErr) {
        console.warn('Profile auto-sync notice:', upsertErr);
      }
    }

    return {
      id: authUserId,
      name: userName,
      email: authUserEmail,
      role: assignedRole,
      status: shopCustomStatus || 'active',
      created_at: new Date().toISOString(),
    };
  };

  // Initialize session directly from Supabase Auth
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: null }), 4000)
        );

        const { data, error } = await Promise.race([getSessionPromise, timeoutPromise]);
        if (error) {
          console.warn('Supabase getSession notice:', error.message);
        }

        const session = data?.session;
        if (session?.user && isMounted) {
          const sysUser = await fetchProfileForUser(
            session.user.id,
            session.user.email || '',
            session.user.user_metadata
          );
          if (isMounted) setUser(sysUser);
        } else if (isMounted) {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    // Listen to real-time auth state changes
    let authListener: { data?: { subscription?: { unsubscribe: () => void } } } | null = null;
    try {
      authListener = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (session?.user) {
          const sysUser = await fetchProfileForUser(
            session.user.id,
            session.user.email || '',
            session.user.user_metadata
          );
          if (isMounted) {
            setUser(sysUser);
            setIsLoading(false);
          }
        } else {
          if (isMounted) {
            setUser(null);
            setIsLoading(false);
          }
        }
      });
    } catch (subErr) {
      console.warn('onAuthStateChange registration notice:', subErr);
    }

    return () => {
      isMounted = false;
      try {
        authListener?.data?.subscription?.unsubscribe();
      } catch (unsubErr) {
        console.warn('Auth unsubscribe notice:', unsubErr);
      }
    };
  }, []);

  const canAccess = useCallback((path: string): boolean => {
    if (!user) return path === '/login';
    if (user.role === 'admin') return true;

    // Reporter permissions (Read-Only)
    if (user.role === 'reporter') {
      return REPORTER_ALLOWED_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
    }

    // Seller permissions (POS Only)
    if (user.role === 'seller') {
      return SELLER_ALLOWED_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
    }

    return false;
  }, [user]);

  // Route Protection & Authorization Guard
  useEffect(() => {
    if (isLoading) return;

    const isLoginPage = pathname === '/login';

    if (!user && !isLoginPage) {
      router.replace('/login');
      return;
    }

    if (user && isLoginPage) {
      const targetUrl = user.role === 'seller' ? '/sales/new' : '/dashboard';
      router.replace(targetUrl);
      return;
    }

    if (user && user.role === 'reporter' && !canAccess(pathname)) {
      router.replace('/dashboard');
      return;
    }

    if (user && user.role === 'seller' && !canAccess(pathname)) {
      router.replace('/sales/new');
      return;
    }
  }, [user, isLoading, pathname, router, canAccess]);

  const login = async (email: string, password?: string) => {
    try {
      if (!isSupabaseConfigured) {
        return { 
          success: false, 
          error: 'Habaynta Supabase (Environment variables) ayaa ka maqan Vercel. Fadlan hubi NEXT_PUBLIC_SUPABASE_URL iyo NEXT_PUBLIC_SUPABASE_ANON_KEY.' 
        };
      }

      if (!password) {
        return { success: false, error: 'Fadlan geli furaha sirta ah (Password required)' };
      }

      const cleanEmail = email.trim().toLowerCase();

      // Guard signInWithPassword with an 8-second timeout race
      const signInPromise = supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      const timeoutPromise = new Promise<{ data: { user: null; session: null }; error: { message: string } }>((resolve) => {
        setTimeout(() => {
          resolve({
            data: { user: null, session: null },
            error: { message: 'Xiriirka Supabase wuu daahay (Request timed out). Fadlan hubi xiriirka internet-kaaga ama dib u tijaabi.' }
          });
        }, 8000);
      });

      const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

      if (error || !data.user) {
        return { 
          success: false, 
          error: error?.message || 'Email ama furaha sirta ah ma saxna (Invalid credentials)' 
        };
      }

      const sysUser = await fetchProfileForUser(
        data.user.id,
        data.user.email || cleanEmail,
        data.user.user_metadata
      );

      setUser(sysUser);
      return { success: true, user: sysUser };
    } catch (err: any) {
      return { 
        success: false, 
        error: err?.message || 'Khalad baa dhacay intii lagu jiray galitaanka' 
      };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string, role: UserRole = 'admin') => {
    try {
      if (!email.trim() || !password.trim()) {
        return { success: false, error: 'Email iyo furaha sirta ah waa qasab' };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
            role,
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Create profile row in profiles table
        try {
          await supabase.from('profiles').upsert([{
            id: data.user.id,
            full_name: fullName || email.split('@')[0],
            role,
            phone: '',
          }]);
        } catch (pErr) {
          console.warn('Profile creation notice:', pErr);
        }

        const sysUser = await fetchProfileForUser(
          data.user.id,
          data.user.email || email,
          data.user.user_metadata
        );

        if (data.session) {
          setUser(sysUser);
        }
        return { success: true, user: sysUser };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lama sameyn karin koontada' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error:', e);
    }
    setUser(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: !!user,
        isLoading,
        login,
        signUp,
        logout,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
