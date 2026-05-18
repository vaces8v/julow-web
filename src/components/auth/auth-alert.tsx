"use client";

import { AnimatePresence, motion } from "motion/react";

/**
 * Анимированный top-level error для auth-форм (login / register).
 *
 * Появление / исчезновение:
 *   - `height: 0 → auto` — плавно сдвигает поля формы вниз/вверх.
 *   - `opacity: 0 → 1` + `filter: blur(6px) → 0` — мягкий фейд + glass-look.
 *   - При смене текста алерта (ошибка → другая ошибка) внутренний `<p>`
 *     перемонтируется через `key={message}`, чтобы новый текст тоже фейдился.
 *
 * Layout-хак:
 *   - Родительская форма использует `space-y-4` (margin-top: 16px на каждом
 *     не-первом child). Когда мотион-див только смонтирован с `height: 0`,
 *     следующее поле (email) уже получает свой `margin-top: 16px` — это и
 *     даёт «дёрг» в момент появления алерта.
 *   - Чтобы компенсировать, анимируем `marginBottom: -16 → 0`. При `height: 0`
 *     эффективный отступ между алертом и email = 0; по мере роста height
 *     к auto, marginBottom тоже растёт к 0, и расстояние плавно увеличивается
 *     до естественных 16px.
 *   - Если родитель использует другой gap, передайте `spacing` (в px).
 */
export function AuthAlert({
  message,
  spacing = 16,
}: {
  message: string | null;
  spacing?: number;
}) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key="auth-alert"
          role="alert"
          aria-live="polite"
          initial={{
            opacity: 0,
            height: 0,
            marginBottom: -spacing,
            filter: "blur(6px)",
          }}
          animate={{
            opacity: 1,
            height: "auto",
            marginBottom: 0,
            filter: "blur(0px)",
          }}
          exit={{
            opacity: 0,
            height: 0,
            marginBottom: -spacing,
            filter: "blur(4px)",
          }}
          transition={{
            duration: 0.28,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/8 px-3.5 py-2.5">
            <motion.p
              key={message}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="text-center text-xs font-medium text-[var(--danger)]"
            >
              {message}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
