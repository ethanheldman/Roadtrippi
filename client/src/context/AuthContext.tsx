import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { auth } from "../api";

type User = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  checkInCount?: number;
  createdAt?: string;
} | null;

const AuthContext = createContext<{
  user: User;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  const refresh = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) {
      setUser(null);
      setToken(null);
      return;
    }
    try {
      const me = await auth.me();
      setUser(me);
      setToken(t);
    } catch {
      localStorage.removeItem("token");
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const { user: u, token: t } = await auth.login(username, password);
    localStorage.setItem("token", t);
    setToken(t);
    setUser(u as User);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const { user: u, token: t } = await auth.register(username, email, password);
    localStorage.setItem("token", t);
    setToken(t);
    setUser(u as User);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
