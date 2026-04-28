"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  ApiError,
  type LoginPayload,
  type UserPayload,
} from "@/lib/api";
import {
  getAccessToken,
  clearTokens,
} from "@/lib/api-client";

interface AuthContextValue {
  user: UserPayload | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginPayload>;
  register: (email: string, password: string) => Promise<UserPayload>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Try to restore session on mount
  useEffect(() => {
    const restore = async () => {
      const token = getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await api.getMe();
        setUser(me);
      } catch {
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };
    void restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await api.login(email, password);
      // After login, fetch full user profile
      const me = await api.getMe();
      setUser(me);
      return result;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 401
            ? "Неверный email или пароль"
            : err.status === 403
              ? "Аккаунт заблокирован"
              : err.message
          : "Ошибка сети";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await api.register(email, password);
      return result;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 409
            ? "Email already exists"
            : err.message
          : "Ошибка сети";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      error,
    }),
    [user, isLoading, login, register, logout, error],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
