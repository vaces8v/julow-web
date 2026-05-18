/**
 * Цветные иконки для типов файлов (Word/Excel/PDF/архивы/код/медиа и т.д.).
 *
 * Используется в `documents-page`, чате и комментариях, чтобы вместо
 * блёклого текстового бейджа с расширением показывать узнаваемую иконку
 * фирменного цвета (Word — синий, Excel — зелёный, PDF — красный …).
 *
 * Один источник правды по mapping ext → (icon, tint) — добавляйте сюда,
 * а не в каждый компонент.
 */

import type { ComponentType } from "react";
import {
  CssFile01Icon,
  Doc02Icon,
  DocumentCodeIcon,
  File02Icon,
  FileMusicIcon,
  FileScriptIcon,
  GoogleSheetIcon,
  HtmlFile01Icon,
  Image02Icon,
  Pdf02Icon,
  Video02Icon,
  Zip02Icon,
} from "hugeicons-react";

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

interface FileTypeMeta {
  Icon: IconComponent;
  /** Tailwind-классы фона для квадратной плитки. */
  bg: string;
  /** Tailwind-классы цвета штриха иконки. */
  color: string;
}

const FALLBACK: FileTypeMeta = {
  Icon: File02Icon,
  bg: "bg-slate-500/10",
  color: "text-slate-500",
};

const MAP: Array<{ exts: readonly string[]; meta: FileTypeMeta }> = [
  { exts: ["pdf"], meta: { Icon: Pdf02Icon, bg: "bg-red-500/10", color: "text-red-500" } },
  {
    exts: ["doc", "docx", "odt", "rtf", "pages"],
    meta: { Icon: Doc02Icon, bg: "bg-blue-500/10", color: "text-blue-500" },
  },
  {
    exts: ["xls", "xlsx", "csv", "tsv", "ods", "numbers"],
    meta: { Icon: GoogleSheetIcon, bg: "bg-emerald-500/10", color: "text-emerald-600" },
  },
  {
    exts: ["ppt", "pptx", "key", "odp"],
    meta: { Icon: File02Icon, bg: "bg-orange-500/10", color: "text-orange-500" },
  },
  {
    exts: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"],
    meta: { Icon: Zip02Icon, bg: "bg-amber-500/10", color: "text-amber-600" },
  },
  {
    exts: ["mp3", "wav", "m4a", "ogg", "flac", "aac", "opus"],
    meta: { Icon: FileMusicIcon, bg: "bg-purple-500/10", color: "text-purple-500" },
  },
  {
    exts: ["mp4", "mov", "webm", "mkv", "avi", "m4v", "3gp"],
    meta: { Icon: Video02Icon, bg: "bg-indigo-500/10", color: "text-indigo-500" },
  },
  {
    exts: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "heic", "heif", "avif", "ico"],
    meta: { Icon: Image02Icon, bg: "bg-cyan-500/10", color: "text-cyan-600" },
  },
  {
    exts: ["md", "markdown", "mdx"],
    meta: { Icon: DocumentCodeIcon, bg: "bg-violet-500/10", color: "text-violet-600" },
  },
  {
    exts: ["html", "htm", "xml", "xhtml"],
    meta: { Icon: HtmlFile01Icon, bg: "bg-orange-500/10", color: "text-orange-500" },
  },
  {
    exts: ["css", "scss", "sass", "less"],
    meta: { Icon: CssFile01Icon, bg: "bg-sky-500/10", color: "text-sky-500" },
  },
  {
    exts: [
      "js", "jsx", "ts", "tsx", "mjs", "cjs",
      "json", "yml", "yaml", "toml",
      "py", "rb", "go", "rs", "java", "c", "cpp", "cs", "php", "sh", "bash",
      "sql", "lua", "kt", "swift", "dart",
    ],
    meta: { Icon: FileScriptIcon, bg: "bg-yellow-500/10", color: "text-yellow-600" },
  },
  {
    exts: ["txt", "log"],
    meta: { Icon: File02Icon, bg: "bg-slate-500/10", color: "text-slate-500" },
  },
];

/** Достаёт расширение в lower-case без точки. */
export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function fileTypeMeta(ext: string): FileTypeMeta {
  const e = ext.toLowerCase();
  for (const row of MAP) {
    if (row.exts.includes(e)) return row.meta;
  }
  return FALLBACK;
}

interface FileTypeIconProps {
  /** Расширение (`docx`, `xlsx`, …) или имя файла. */
  ext?: string;
  filename?: string;
  /** Высота/ширина плитки в Tailwind единицах (h-{n} w-{n}); пo умолчанию h-9 w-9. */
  className?: string;
  /** Размер самой иконки в пикселях. */
  iconSize?: number;
  /**
   * Цветовой тон плитки.
   * - `default` — фирменный цвет типа на бледной подложке (документы, файлы).
   * - `on-accent` — белая иконка на полупрозрачном белом, чтобы хорошо
   *   читалась поверх accent-пузыря в чате (свои сообщения справа).
   * - `on-surface` — нейтральная иконка для чужих сообщений на surface-фоне.
   */
  tone?: "default" | "on-accent" | "on-surface";
}

/**
 * Квадратная плитка с цветной иконкой типа файла.
 *
 * ```tsx
 * <FileTypeIcon filename="report.xlsx" />
 * <FileTypeIcon ext="pdf" iconSize={20} className="h-10 w-10" />
 * <FileTypeIcon filename="a.docx" tone="on-accent" />
 * ```
 */
export function FileTypeIcon({
  ext,
  filename,
  className,
  iconSize = 18,
  tone = "default",
}: FileTypeIconProps) {
  const resolvedExt = ext ?? (filename ? extOf(filename) : "");
  const { Icon, bg, color } = fileTypeMeta(resolvedExt);
  const tile =
    tone === "on-accent"
      ? "bg-white/15"
      : tone === "on-surface"
        ? "bg-[var(--surface-secondary)]"
        : bg;
  const stroke =
    tone === "on-accent"
      ? "text-white"
      : tone === "on-surface"
        ? "text-[var(--muted)]"
        : color;
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-lg",
        className ?? "h-9 w-9",
        tile,
      ].join(" ")}
      aria-hidden
    >
      <Icon size={iconSize} strokeWidth={1.7} className={stroke} />
    </div>
  );
}
