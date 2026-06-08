import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

async function loadSupabase() {
  const { supabase } = await import('../integrations/supabase/client');
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncSession = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  };

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const supabase = await loadSupabase();
        if (!active) return;

        const { data: sub } = supabase.auth.onAuthStateChange(
          (_event: AuthChangeEvent, s: Session | null) => {
            if (!active) return;
            syncSession(s);
            setLoading(false);
          }
        );

        unsubscribe = () => sub.subscription.unsubscribe();

        const { data }: { data: { session: Session | null } } = await supabase.auth.getSession();
        if (!active) return;
        syncSession(data.session);
      } catch (error) {
        console.error(error);
        if (!active) return;
        syncSession(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const supabase = await loadSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (data.session) syncSession(data.session);
      return { error, session: data.session ?? null };
    } catch (error) {
      return { error: toError(error), session: null };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const supabase = await loadSupabase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
        },
      });
      if (data.session) syncSession(data.session);
      return { error, session: data.session ?? null };
    } catch (error) {
      return { error: toError(error), session: null };
    }
  };

  const signOut = async () => {
    try {
      const supabase = await loadSupabase();
      await supabase.auth.signOut();
    } catch (error) {
      console.error(error);
    } finally {
      syncSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
