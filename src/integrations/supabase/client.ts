import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const getEnv = (key: string): string => {
  // VITE_ prefixed vars are baked in at build time via import.meta.env
  const viteEnv = import.meta.env as Record<string, string | undefined>;
  return (
    viteEnv[`VITE_${key}`] ||
    viteEnv[key] ||
    (typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>)[key] ?? '' : '') ||
    ''
  );
};

function createSupabaseClient() {
  const url =
    getEnv('SUPABASE_URL') ||
    getEnv('SUPABASE_PROJECT_URL');

  const key =
    getEnv('SUPABASE_ANON_KEY') ||
    getEnv('SUPABASE_PUBLISHABLE_KEY');

  if (!url || !key) {
    console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Auth unavailable.');
  }

  return createClient<Database>(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder-key',
    {
      auth: {
        storage: typeof window !== 'undefined' ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
