import { createContext, useContext, useEffect, useState } from "react";
import * as Auth from "@/lib/auth";
import { clearToken, loadToken, saveToken } from "@/lib/token-store";

interface AuthContextValue {
  user: Auth.AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<Auth.AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Auth.AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      try {
        const stored = await loadToken();
        if (!stored) return;
        const session = await Auth.getSession(stored);
        if (session) {
          setToken(stored);
          setUser(session.user);
        } else {
          // Token is stale — drop it so the user lands on sign-in.
          await clearToken();
        }
      } finally {
        setIsLoading(false);
      }
    }
    hydrate();
  }, []);

  async function signIn(email: string, password: string, remember = true): Promise<void> {
    const result = await Auth.signIn(email, password);
    if (remember) await saveToken(result.token);
    setToken(result.token);
    setUser(result.user);
  }

  async function signOut(): Promise<void> {
    if (token) {
      try {
        await Auth.signOut(token);
      } catch {
        // Best-effort: clear local state even if the server call fails.
      }
    }
    await clearToken();
    setToken(null);
    setUser(null);
  }

  function updateUser(patch: Partial<Auth.AuthUser>): void {
    setUser(prev => prev ? { ...prev, ...patch } : null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
