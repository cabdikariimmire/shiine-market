import { createClient } from '@supabase/supabase-js';

// Sanitize the Supabase project root URL (strip any accidental trailing /rest/v1 or slashes, quotes, or whitespace)
const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
export const supabaseUrl = rawUrl
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/auth\/v1\/?$/i, '')
  .replace(/\/storage\/v1\/?$/i, '')
  .replace(/\/+$/, '');

const rawKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_KEY ||
  ''
).trim().replace(/^['"]|['"]$/g, '');

export const supabaseAnonKey = rawKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-supabase') &&
  !supabaseUrl.includes('placeholder') &&
  supabaseAnonKey !== 'placeholder'
);

// Production Supabase client — Persistent PostgreSQL source of truth
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);
