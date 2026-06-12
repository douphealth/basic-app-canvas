import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function resolveEnv(keys: string[]): string {
  for (const key of keys) {
    const viteVal = (import.meta.env as Record<string, string>)?.[`VITE_${key}`];
    if (viteVal) return viteVal;
    const viteValDirect = (import.meta.env as Record<string, string>)?.[key];
    if (viteValDirect) return viteValDirect;
    if (typeof process !== 'undefined') {
      const procVal = (process.env as Record<string, string>)?.[key];
      if (procVal) return procVal;
    }
  }
  return '';
}

function createSupabaseClient() {
  const url = resolveEnv(['SUPABASE_URL', 'SUPABASE_PROJECT_URL']);
  const key = resolveEnv(['SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY']);

  if (!url || !key) {
    const missingUrl = !url ? 'VITE_SUPABASE_URL' : null;
    const missingKey = !key ? 'VITE_SUPABASE_ANON_KEY' : null;
    const missing = [missingUrl, missingKey].filter(Boolean).join(', ');
    console.warn(`[Supabase] Missing env var(s): ${missing}. Auth features will be unavailable.`);
  }

  return createClient<Database>(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder',
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

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
