import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// ⚡ DEVELOPMENT MODE FLAG — set to false to restore full auth
const isDevelopmentMode = false;

const MOCK_USER = {
  id: "dev-user-00000-00000-00000",
  email: "dev@test.com",
  app_metadata: {},
  user_metadata: { display_name: "Test User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
  role: "authenticated",
} as unknown as User;

const MOCK_SESSION = {
  access_token: "dev-token",
  refresh_token: "dev-refresh",
  expires_in: 999999,
  token_type: "bearer",
  user: MOCK_USER,
} as unknown as Session;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(isDevelopmentMode ? MOCK_USER : null);
  const [session, setSession] = useState<Session | null>(isDevelopmentMode ? MOCK_SESSION : null);
  const [loading, setLoading] = useState(isDevelopmentMode ? false : true);
  const initialized = useRef(isDevelopmentMode);
  const initialSessionLoaded = useRef(isDevelopmentMode);

  useEffect(() => {
    if (isDevelopmentMode) return;
    if (initialized.current) return;
    initialized.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (initialSessionLoaded.current) setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: restoredSession } }) => {
      setSession(restoredSession);
      setUser(restoredSession?.user ?? null);
      initialSessionLoaded.current = true;
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (isDevelopmentMode) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};