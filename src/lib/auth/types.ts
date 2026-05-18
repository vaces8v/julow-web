/**
 * DTO авторизации, общие между BFF (Next route handlers) и клиентом.
 */

export interface AuthUser {
  id: string;
  email: string;
  status: "active" | "pending_verification" | "locked" | "deactivated" | string;
  roleIds: string[];
  isEmailConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** TTL access-токена в секундах. */
  accessExpiresIn: number;
  /** TTL refresh-токена в секундах. */
  refreshExpiresIn: number;
}

export interface AuthSession extends AuthTokens {
  user: AuthUser;
}

/** Сырая форма ответа бэкенда `LoginResponse` под ключом `data`. */
export interface BackendLoginPayload {
  user: BackendUserResponse;
  access_token: string;
  refresh_token: string;
  access_expires_in: number;
  refresh_expires_in: number;
}

export interface BackendUserResponse {
  id: string;
  email: string;
  status: string;
  role_ids: string[];
  is_email_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export function mapBackendUser(u: BackendUserResponse): AuthUser {
  return {
    id: u.id,
    email: u.email,
    status: u.status,
    roleIds: u.role_ids ?? [],
    isEmailConfirmed: u.is_email_confirmed,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

export function mapBackendSession(p: BackendLoginPayload): AuthSession {
  return {
    user: mapBackendUser(p.user),
    accessToken: p.access_token,
    refreshToken: p.refresh_token,
    accessExpiresIn: p.access_expires_in,
    refreshExpiresIn: p.refresh_expires_in,
  };
}
