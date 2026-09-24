import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SystemUser, UserRole, Shop } from '../types';

interface AuthContextType {
  user: SystemUser | null;
  role: UserRole | null;
  shop: Shop | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string; user?: SystemUser }>;
  logout: () => Promise<void>;
  canAccess: (feature: 'dashboard' | 'pos' | 'products' | 'stock' | 'debts' | 'customers' | 'suppliers' | 'expenses' | 'reports' | 'settings') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SystemUser | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileForUser = async (authUserId: string, authUserEmail: string, userMetadata?: any): Promise<SystemUser> => {
    let shopId: string | null = null;
    let shopCustomRole: UserRole | null = null;
    let shopCustomName: string | null = null;
    let shopCustomStatus: any = 'active';

    try {
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (shopData) {
        setShop(shopData);
        shopId = shopData.id;
        if (shopData.settings?.users && Array.isArray(shopData.settings.users)) {
          const matching = shopData.settings.users.find(
            (u: any) => u.id === authUserId || (u.email && u.email.toLowerCase() === authUserEmail.toLowerCase())
          );
          if (matching) {
            shopCustomRole = matching.role;
            shopCustomName = matching.name;
            shopCustomStatus = matching.status || 'active';
          }
        }
      }
    } catch (shopErr) {
      console.warn('Shop lookup warning in mobile:', shopErr);
    }

    try {
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Profile timeout' } }), 4000)
      );

      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (profile && !error) {
        const roleStr = String(shopCustomRole || profile.role || '').toLowerCase();
        const role: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');
        const email = profile.phone && profile.phone.includes('@') ? profile.phone : authUserEmail;

        return {
          id: profile.id,
          name: shopCustomName || profile.full_name || authUserEmail.split('@')[0] || 'Isticmaale',
          email,
          role,
          status: shopCustomStatus || 'active',
          created_at: profile.created_at || new Date().toISOString(),
          shop_id: shopId,
        };
      }
    } catch (err) {
      console.warn('Profile fetch warning in mobile:', err);
    }

    // Fallback role resolution from metadata or email
    const metaRole = String(shopCustomRole || userMetadata?.role || '').toLowerCase();
    const assignedRole: UserRole = 
      metaRole === 'reporter' || authUserEmail.toLowerCase().includes('reporter') 
        ? 'reporter' 
        : (metaRole === 'seller' || authUserEmail.toLowerCase().includes('seller') ? 'seller' : 'admin');

    const userName = shopCustomName || userMetadata?.full_name || authUserEmail.split('@')[0] || 'Isticmaale';

    return {
      id: authUserId,
      name: userName,
      email: authUserEmail,
      role: assignedRole,
      status: shopCustomStatus || 'active',
      created_at: new Date().toISOString(),
      shop_id: shopId,
    };
  };

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
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
        console.error('Mobile auth init error:', err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
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
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, password?: string) => {
    try {
      if (!isSupabaseConfigured) {
        return {
          success: false,
          error: 'Habaynta Supabase URL ama Anon Key ayaa ka maqan mobaylka.',
        };
      }

      if (!email.trim() || !password) {
        return {
          success: false,
          error: 'Fadlan geli email-kaaga iyo furaha sirta ah (Password).',
        };
      }

      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data.user) {
        return {
          success: false,
          error: error?.message || 'Email ama furaha sirta ah ma saxna (Invalid credentials).',
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
        error: err?.message || 'Khalad baa dhacay intii lagu jiray galitaanka.',
      };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setUser(null);
    }
  };

  const canAccess = useCallback((feature: 'dashboard' | 'pos' | 'products' | 'stock' | 'debts' | 'customers' | 'suppliers' | 'expenses' | 'reports' | 'settings'): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    if (user.role === 'reporter') {
      return feature === 'dashboard' || feature === 'reports';
    }

    if (user.role === 'seller') {
      return feature === 'pos' || feature === 'products' || feature === 'debts' || feature === 'customers' || feature === 'dashboard';
    }

    return false;
  }, [user]);

  const role = user?.role || null;
  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        shop,
        isAuthenticated,
        isLoading,
        login,
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
