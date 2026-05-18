/**
 * Хелперы темы. Используются всеми toggle'ами (auth/landing nav,
 * authenticated app-shell) и должны быть в синхроне с blocking-скриптом
 * `src/app/theme-script.tsx`, который выставляет начальное состояние
 * `data-theme` на `<html>` ДО гидратации.
 *
 * # Почему здесь, а не внутри компонентов
 * До этого модуля у нас было ДВА почти одинаковых toggle'а
 * (`auth-theme-toggle.tsx` + inline в `app-shell.tsx`). Каждый по-своему
 * читал/писал состояние. Различия открывали маленькие баги:
 *  - `useState`-ленивый инициализатор не всегда синхронизировался с DOM
 *    после гидратации в React 19 → первый клик «не срабатывал».
 *  - Один toggle сохранял в `localStorage`, другой — нет.
 *  - Никто не слушал `prefers-color-scheme` → пользовательская
 *    «системная» тема не реагировала на смену темы ОС в открытой вкладке.
 *
 * Здесь все три аспекта собраны в один модуль с предсказуемым контрактом:
 * `readTheme` / `applyTheme` / `subscribeSystemTheme` / `STORAGE_KEY`.
 */

export const STORAGE_KEY = "julow_theme";

export type Theme = "light" | "dark";

/**
 * Прочитать ТЕКУЩУЮ применённую тему из DOM.
 *
 * На сервере (`document` отсутствует) возвращаем `"light"` как
 * нейтральный дефолт. SSR-рендер в любом случае не должен зависеть
 * от темы для корректной гидратации — все toggle'ы инициализируют
 * state детерминированным значением и обновляются в `useEffect`.
 */
export function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/**
 * Применить тему к `<html>` (атрибут, класс, color-scheme) и сохранить
 * в `localStorage`. Это симметрично blocking-скрипту в `theme-script.tsx`,
 * чтобы reload отображал ТОТ ЖЕ результат.
 *
 * Запись в localStorage обёрнута в try/catch — приватный режим Safari
 * и quota-exceeded не должны ронять переключатель.
 */
export function applyTheme(next: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", next);
  root.classList.toggle("dark", next === "dark");
  root.style.colorScheme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode / quota — molча игнорируем */
  }
}

/**
 * Есть ли у пользователя ЯВНЫЙ выбор темы (запись в localStorage).
 * Используется чтобы решить, реагировать ли на смену системной темы:
 * если пользователь явно нажал «light» / «dark» — system-changes больше
 * не должны его «передёргивать».
 */
function hasExplicitTheme(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "dark" || v === "light";
  } catch {
    return false;
  }
}

/**
 * Подписаться на смену системной темы (`prefers-color-scheme`).
 * Колбэк вызывается ТОЛЬКО если у пользователя нет явного выбора —
 * иначе мы игнорируем системные изменения.
 *
 * Возвращает функцию-отписку (cleanup для useEffect).
 */
export function subscribeSystemTheme(onChange: (next: Theme) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    if (hasExplicitTheme()) return;
    onChange(e.matches ? "dark" : "light");
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
