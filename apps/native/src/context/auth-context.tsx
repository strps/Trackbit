import { createContext, useContext, useEffect, useState } from "react";
import * as Auth from "@/lib/auth";
import { clearToken, loadToken, saveToken } from "@/lib/token-store";

interface AuthContextValue {
  user: Auth.AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Auth.AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      try {
        const token = await loadToken();
        if (!token) return;
        const session = await Auth.getSession(token);
        if (session) {
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

  async function signIn(email: string, password: string): Promise<void> {
    const result = await Auth.signIn(email, password);
    await saveToken(result.token);
    setUser(result.user);
  }

  async function signOut(): Promise<void> {
    const token = await loadToken();
    if (token) {
      try {
        await Auth.signOut(token);
      } catch {
        // Best-effort: clear local state even if the server call fails.
      }
    }
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
