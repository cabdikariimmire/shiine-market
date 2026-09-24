import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Sanitize Supabase URL
const rawUrl = (
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  'https://ffzrwkhuazpaqiuvgbkd.supabase.co'
).trim().replace(/^['"]|['"]$/g, '');

export const supabaseUrl = rawUrl
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/auth\/v1\/?$/i, '')
  .replace(/\/storage\/v1\/?$/i, '')
  .replace(/\/+$/, '');

const rawKey = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  'sb_publishable_PrIoWHT_gsdDS-AErUhtAw_oy4_F0Gt'
).trim().replace(/^['"]|['"]$/g, '');

export const supabaseAnonKey = rawKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
);

// Mobile Supabase Client with persistent AsyncStorage session
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
