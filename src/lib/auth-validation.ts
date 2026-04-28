import type { Translations } from "@/i18n/translations";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthErrorMessages = Translations["auth"]["errors"];

export function validateEmail(value: string, m: AuthErrorMessages): string | null {
  const v = value.trim();
  if (!v) return m.emailRequired;
  if (!EMAIL_RE.test(v)) return m.emailInvalid;
  return null;
}

/** Min 6 chars, at least one English letter and one digit. */
export function validatePassword(value: string, m: AuthErrorMessages): string | null {
  if (value.length < 6) return m.passwordMin;
  if (!/[a-zA-Z]/.test(value)) return m.passwordLetter;
  if (!/\d/.test(value)) return m.passwordDigit;
  return null;
}
