/**
 * `cn(...)` — shadcn-style className helper, идентичный тому, что
 * использует исходный `landing/lib/utils.ts`. Лежит здесь, чтобы
 * мигрированные landing-компоненты могли импортировать `@/lib/utils`
 * без изменений и без конфликта с `cn` из `@heroui/react`, который
 * используется остальной частью app.
 *
 * clsx — конкатенация с фильтрацией falsy/conditionals.
 * twMerge — резолвит конфликты Tailwind-классов (последний выигрывает).
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
