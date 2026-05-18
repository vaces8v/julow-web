/**
 * Канонические коды ошибок Identity BC бэкенда + маппинг в человекочитаемые сообщения.
 * Источник: app/context/identity/application/exceptions/* и core/exception_handlers.py
 */

export type AuthErrorCode =
  | "AUTHENTICATION_FAILED"
  | "ACCOUNT_LOCKED"
  | "TWO_FA_REQUIRED"
  | "SSO_ENFORCED"
  | "USER_ALREADY_EXISTS"
  /**
   * Email уже зарегистрирован через OAuth-провайдера (Google/GitHub).
   * Возвращается при попытке login/register с email+password, если в БД
   * для этого email задан внешний `auth_provider`. Provider передаётся в
   * `details: [{field: "provider", message: "google"}]`.
   */
  | "EMAIL_REGISTERED_VIA_OAUTH"
  /**
   * Email уже зарегистрирован обычным email+password. Возвращается при
   * попытке OAuth login (Google/GitHub callback), если в БД для этого
   * email задан password_hash и нет привязки к внешнему провайдеру.
   */
  | "EMAIL_REGISTERED_VIA_PASSWORD"
  | "INVALID_REFRESH_TOKEN"
  | "INSUFFICIENT_PERMISSIONS"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "BUSINESS_RULE_VIOLATION"
  | "DOMAIN_ERROR"
  | "HTTP_ERROR"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface BackendErrorBody {
  success: false;
  error: { code: string; message: string; field?: string | null };
  details?: Array<{ code: string; message: string; field?: string | null }>;
}

/** Достаёт коды/сообщения из тела ошибки бэкенда. */
export function parseBackendError(
  body: unknown,
): { code: string; message: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  if (!body || typeof body !== "object") {
    return { code: "UNKNOWN", message: "Unknown error", fieldErrors };
  }
  const b = body as Partial<BackendErrorBody>;
  const top = b.error;
  const code = typeof top?.code === "string" ? top.code : "UNKNOWN";
  const message = typeof top?.message === "string" ? top.message : code;

  if (Array.isArray(b.details)) {
    for (const d of b.details) {
      if (d?.field && typeof d.message === "string") {
        // FastAPI кладёт имя поля как "body.email" — оставляем последнюю часть
        const key = d.field.split(".").pop() ?? d.field;
        fieldErrors[key] = d.message;
      }
    }
  }
  return { code, message, fieldErrors };
}

/** Локализованные сообщения для пользователя. RU как основной язык интерфейса. */
export const AUTH_ERROR_MESSAGES_RU: Record<AuthErrorCode, string> = {
  AUTHENTICATION_FAILED: "Неверный email или пароль",
  ACCOUNT_LOCKED:
    "Аккаунт временно заблокирован. Попробуйте позже или сбросьте пароль.",
  TWO_FA_REQUIRED: "Требуется двухфакторная аутентификация",
  SSO_ENFORCED:
    "Для вашего домена включён обязательный вход через SSO. Войдите через корпоративный SSO.",
  USER_ALREADY_EXISTS: "Пользователь с таким email уже существует",
  EMAIL_REGISTERED_VIA_OAUTH:
    "Этот email привязан к OAuth-провайдеру. Войдите через него.",
  EMAIL_REGISTERED_VIA_PASSWORD:
    "Этот email уже зарегистрирован через email и пароль. Войдите обычным способом.",
  INVALID_REFRESH_TOKEN: "Сессия истекла, войдите заново",
  INSUFFICIENT_PERMISSIONS: "Недостаточно прав для этого действия",
  VALIDATION_ERROR: "Проверьте корректность введённых данных",
  NOT_FOUND: "Не найдено",
  BUSINESS_RULE_VIOLATION: "Действие невозможно: нарушено бизнес-правило",
  DOMAIN_ERROR: "Запрос отклонён доменом",
  HTTP_ERROR: "Запрос завершился с ошибкой",
  INTERNAL_ERROR: "Внутренняя ошибка сервера. Повторите позже.",
  NETWORK_ERROR: "Нет связи с сервером. Проверьте интернет-соединение.",
  UNKNOWN: "Неизвестная ошибка",
};

export function authErrorMessage(code: string, fallback?: string): string {
  if (code in AUTH_ERROR_MESSAGES_RU) {
    return AUTH_ERROR_MESSAGES_RU[code as AuthErrorCode];
  }
  return fallback ?? AUTH_ERROR_MESSAGES_RU.UNKNOWN;
}
