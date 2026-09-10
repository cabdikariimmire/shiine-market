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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SystemUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileForUser = async (authUserId: string, authUserEmail: string, userMetadata?: any): Promise<SystemUser> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      if (profile && !error) {
        return {
          id: profile.id,
          name: profile.full_name || authUserEmail.split('@')[0] || 'User',
          email: authUserEmail,
          role: (profile.role === 'reporter' ? 'reporter' : 'admin') as UserRole,
          status: 'active',
          created_at: profile.created_at || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Profile fetch notice:', err);
    }

    const assignedRole: UserRole = 
      userMetadata?.role === 'reporter' || authUserEmail.toLowerCase().includes('reporter') 
        ? 'reporter' 
        : 'admin';

    return {
      id: authUserId,
      name: userMetadata?.full_name || authUserEmail.split('@')[0] || 'User',
      email: authUserEmail,
      role: assignedRole,
      status: 'active',
      created_at: new Date().toISOString(),
    };
  };

  // Initialize session directly from Supabase Auth
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          if (isMounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Supabase getSession error:', error.message);
        }

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const canAccess = useCallback((path: string): boolean => {
    if (!user) return path === '/login';
    if (user.role === 'admin') return true;

    // Reporter permissions (Read-Only)
    if (user.role === 'reporter') {
      return REPORTER_ALLOWED_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
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
      router.replace('/dashboard');
      return;
    }

    if (user && user.role === 'reporter' && !canAccess(pathname)) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, pathname, router, canAccess]);

  const login = async (email: string, password?: string) => {
    try {
      if (!password) {
        return { success: false, error: 'Fadlan geli furaha sirta ah (Password required)' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        return { 
          success: false, 
          error: error?.message || 'Email ama furaha sirta ah ma saxna (Invalid credentials)' 
        };
      }

      const sysUser = await fetchProfileForUser(
        data.user.id,
        data.user.email || email,
        data.user.user_metadata
      );

      setUser(sysUser);
      return { success: true, user: sysUser };
    } catch (err: any) {
      return { 
        success: false, 
        error: err.message || 'Khalad baa dhacay intii lagu jiray galitaanka' 
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
