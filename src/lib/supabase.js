import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured = Boolean(url && key && /^https:\/\//.test(url) && key.startsWith('sb_publishable_'));
let client;

// Lazy initialization: a demo-only visit does not create a Supabase client.
export function getSupabase() {
  if (!cloudConfigured) return null;
  client ??= createClient(url, key, { auth: {
    persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
    storageKey: 'budget-tracker-auth',
  } });
  return client;
}
