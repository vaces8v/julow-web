import { z } from "zod";

/**
 * Zod-схемы форм авторизации.
 * Должны быть в синхроне с бэкендом:
 *   - LoginRequest: email (EmailStr), password (min 1)
 *   - RegisterRequest: email (EmailStr), password (8..128)
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Введите адрес почты")
  .email("Введите корректный email")
  .max(254, "Email слишком длинный");

/** Логин — пароль пропускаем как есть (валидация на бэкенде). */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Введите пароль"),
  isRememberMe: z.boolean().default(false),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/** Регистрация — пароль 8..128 (как бэкенд), c подтверждением. */
export const registerSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(8, "Минимум 8 символов")
      .max(128, "Максимум 128 символов")
      .regex(/[A-Za-z]/, "Должна быть хотя бы одна буква")
      .regex(/[0-9]/, "Должна быть хотя бы одна цифра"),
    confirmPassword: z.string().min(1, "Подтвердите пароль"),
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: "Необходимо принять условия",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают",
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
