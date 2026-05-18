"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import {
  ApiError,
  authLogin,
  authLogout,
  authMe,
  authRegister,
  subscribeAuthFailure,
} from "@/lib/api-client";
import { closeWsClient } from "@/lib/ws-client";
import {
  authErrorMessage,
  type AuthErrorCode,
} from "@/lib/auth/error-codes";
import type { AuthUser } from "@/lib/auth/types";

/**
 * Module-level флаг "идёт logout". При логауте все in-flight запросы
 * (у react-query они могут быть в процессе в момент logout-клика)
 * возвращают 401, и каждый триггерит emitAuthFailure — без этого флага
 * юзер видел бы по тосту «Сессия завершена» на каждый pending запрос
 * в момент добровольного выхода.
 */
const loggingOutRef = { current: false };

interface LoginInput {
  email: string;
  password: string;
  isRememberMe?: boolean;
}

interface RegisterInput {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingIn: boolean;
  isRegistering: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ME_KEY = ["auth", "me"] as const;

/** Преобразует ошибку запроса в человеческий текст для toast/UI. */
function describeAuthError(err: unknown): { code: string; message: string } {
  if (err instanceof ApiError) {
    return {
      code: err.code,
      message: authErrorMessage(err.code, err.detail),
    };
  }
  if (err instanceof Error) {
    return { code: "UNKNOWN", message: err.message };
  }
  return { code: "UNKNOWN", message: authErrorMessage("UNKNOWN") };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();

  // ── Текущий пользователь ────────────────────────────────────
  const meQuery = useQuery({
    queryKey: ME_KEY,
    queryFn: authMe,
    staleTime: 60_000,
    retry: false,
  });

  const setUser = useCallback(
    (user: AuthUser | null) => {
      qc.setQueryData(ME_KEY, user);
    },
    [qc],
  );

  // ── Login ──────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      authLogin({
        email: input.email.trim(),
        password: input.password,
        isRememberMe: input.isRememberMe ?? false,
      }),
    onSuccess: ({ user }) => {
      setUser(user);
      toast.success("Вход выполнен", {
        description: user.email,
      });
    },
    onError: (err) => {
      const { code, message } = describeAuthError(err);
      // Тосты только для не-fields ошибок; field-level UI сам покажет инлайн
      if (code !== "VALIDATION_ERROR") {
        toast.error("Не удалось войти", { description: message });
      }
    },
  });

  // ── Register ───────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) =>
      authRegister({
        email: input.email.trim(),
        password: input.password,
      }),
    onSuccess: ({ user }) => {
      toast.success("Аккаунт создан", {
        description: "Подтверждение отправлено на email",
      });
      // Note: бэкенд НЕ выдаёт токены при регистрации, поэтому пользователь
      // должен дальше залогиниться. Мы не проставляем `me`-кэш.
      void user;
    },
    onError: (err) => {
      const { code, message } = describeAuthError(err);
      if (code !== "VALIDATION_ERROR") {
        toast.error("Не удалось зарегистрироваться", { description: message });
      }
    },
  });

  // ── Logout ─────────────────────────────────────────────────
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Сразу выставляем флаг — до того как authLogout() вызовёт 401 в
      // pending-запросах; подписчик subscribeAuthFailure увидит флаг и
      // пропустит toast.error("Сессия завершена") — это же добровольный
      // logout, юзер и сам видит что вышел.
      loggingOutRef.current = true;
      await authLogout();
    },
    onSettled: () => {
      setUser(null);
      qc.clear();
      // Закрываем WS-соединение, чтобы не держать сокет с протухшим токеном.
      closeWsClient();
      toast.success("Вы вышли из аккаунта");
      router.replace("/login");
      // Сбрасываем флаг чуть позже, чтобы все pending 401-ы от старых
      // запросов (группа в ~1s) успели «проглотиться» молча.
      setTimeout(() => { loggingOutRef.current = false; }, 1500);
    },
  });

  const login = useCallback(
    async (input: LoginInput) => {
      const { user } = await loginMutation.mutateAsync(input);
      return user;
    },
    [loginMutation],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { user } = await registerMutation.mutateAsync(input);
      return user;
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const refetchUser = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ME_KEY });
  }, [qc]);

  // ── Глобальный обработчик 401 после неудачного refresh ─────
  useEffect(() => {
    return subscribeAuthFailure((err) => {
      // Добровольный logout в процессе: pending-запросы получат 401, но
      // мы хотим показать только «Вы вышли из аккаунта» (success),
      // а не спам из «Сессия завершена» (error).
      if (loggingOutRef.current) return;
      // Уже разлогинены (cache в null) или никогда не были входа (undefined).
      const cached = qc.getQueryData(ME_KEY);
      if (cached === null || cached === undefined) return;
      setUser(null);
      qc.clear();
      const code = err.code as AuthErrorCode;
      toast.error("Сессия завершена", {
        description: authErrorMessage(code, "Войдите снова"),
      });
      router.replace("/login");
    });
  }, [qc, router, setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isAuthenticated: !!meQuery.data,
      isLoading: meQuery.isLoading,
      isLoggingIn: loginMutation.isPending,
      isRegistering: registerMutation.isPending,
      login,
      register,
      logout,
      refetchUser,
    }),
    [
      meQuery.data,
      meQuery.isLoading,
      loginMutation.isPending,
      registerMutation.isPending,
      login,
      register,
      logout,
      refetchUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
