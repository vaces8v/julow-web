/**
 * Блокирующий inline-скрипт — устраняет FOUC (flash of unstyled content)
 * при гидратации. Запускается синхронно в `<head>` ДО первого paint и
 * выставляет на `<html>`:
 *   - `data-theme="dark" | "light"`
 *   - `class="dark"` (для tailwind / legacy селекторов)
 *   - `style.colorScheme` (нативные скроллбары, form controls)
 *
 * Приоритет источника темы:
 *   1. `localStorage.getItem("julow_theme")` — явный выбор пользователя
 *   2. `prefers-color-scheme: dark` — системная настройка
 *   3. fallback — `light`
 *
 * Скрипт обёрнут в `try/catch`, чтобы упавший доступ к localStorage
 * (приватный режим, политика хранилища) не сломал страницу. После
 * вывода атрибуты совпадают с тем, что выставит React-toggle позже —
 * хватает одного пэйнта, никакой вспышки.
 *
 * Используем `next/script` с `strategy="beforeInteractive"`, чтобы
 * Next.js 16 не ругался на `<script>` внутри React-компонента.
 */
import Script from "next/script";

const THEME_INIT_SCRIPT = `(function(){try{var s=null;try{s=localStorage.getItem('julow_theme');}catch(e){}var t=(s==='dark'||s==='light')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var d=document.documentElement;d.setAttribute('data-theme',t);if(t==='dark'){d.classList.add('dark');}else{d.classList.remove('dark');}d.style.colorScheme=t;}catch(e){}})();`;

export function ThemeScript() {
  return (
    <Script
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  );
}
