"use client";

import { LegalShell } from "@/components/legal/legal-shell";
import { useI18n } from "@/i18n/context";
import { ArrowLeft02Icon, BookOpen02Icon, Calendar03Icon, Shield01Icon } from "hugeicons-react";
import Link from "next/link";

type DocumentKind = "terms" | "privacy";

/**
 * Описание одной секции документа.
 * Структура объявлена статически, потому что:
 *   - набор полей у разных секций различается (p* vs lead+l* vs lead+l*+tail);
 *   - тип `StringTree<typeof en>` не поддерживает массивы переменной длины;
 *   - так компилятор гарантирует совпадение ключей между en/ru/de.
 */
type SectionShape =
  | { id: string; kind: "paragraphs"; paragraphs: 2 | 3 }
  | { id: string; kind: "list"; items: number }
  | { id: string; kind: "list-tail"; items: number };

const TERMS_SECTIONS: readonly SectionShape[] = [
  { id: "s1", kind: "paragraphs", paragraphs: 2 },
  { id: "s2", kind: "paragraphs", paragraphs: 3 },
  { id: "s3", kind: "paragraphs", paragraphs: 2 },
  { id: "s4", kind: "paragraphs", paragraphs: 3 },
  { id: "s5", kind: "paragraphs", paragraphs: 2 },
  { id: "s6", kind: "list", items: 4 },
  { id: "s7", kind: "paragraphs", paragraphs: 2 },
  { id: "s8", kind: "paragraphs", paragraphs: 2 },
  { id: "s9", kind: "paragraphs", paragraphs: 2 },
  { id: "s10", kind: "paragraphs", paragraphs: 2 },
  { id: "s11", kind: "paragraphs", paragraphs: 2 },
  { id: "s12", kind: "paragraphs", paragraphs: 2 },
] as const;

const PRIVACY_SECTIONS: readonly SectionShape[] = [
  { id: "s1", kind: "paragraphs", paragraphs: 3 },
  { id: "s2", kind: "list", items: 5 },
  { id: "s3", kind: "paragraphs", paragraphs: 3 },
  { id: "s4", kind: "list", items: 4 },
  { id: "s5", kind: "paragraphs", paragraphs: 2 },
  { id: "s6", kind: "paragraphs", paragraphs: 2 },
  { id: "s7", kind: "paragraphs", paragraphs: 2 },
  { id: "s8", kind: "paragraphs", paragraphs: 2 },
  { id: "s9", kind: "list", items: 3 },
  { id: "s10", kind: "list-tail", items: 2 },
  { id: "s11", kind: "list-tail", items: 3 },
  { id: "s12", kind: "paragraphs", paragraphs: 2 },
  { id: "s13", kind: "paragraphs", paragraphs: 2 },
  { id: "s14", kind: "paragraphs", paragraphs: 2 },
] as const;

/**
 * Достаём узел секции из словаря переводов без жёсткой типизации каждого
 * ключа: схема секций известна заранее (см. `*_SECTIONS`), но получить
 * `t.legal.terms.s6.l3` через индекс с literal-типами слишком многословно.
 */
function getSectionNode(t: ReturnType<typeof useI18n>["t"], kind: DocumentKind, id: string) {
  const doc = t.legal[kind] as unknown as Record<string, Record<string, string>>;
  return doc[id] ?? {};
}

export function LegalDocument({ kind }: { kind: DocumentKind }) {
  const { t } = useI18n();
  const l = t.legal;
  const doc = kind === "terms" ? l.terms : l.privacy;
  const sections = kind === "terms" ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <LegalShell>
      {/* Breadcrumb / quick back link */}
      <nav className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--muted)]">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft02Icon size={13} strokeWidth={2} />
          {l.backToLogin}
        </Link>
        <span className="opacity-50">·</span>
        <Link
          href="/register"
          className="transition-colors hover:text-[var(--foreground)]"
        >
          {l.backToRegister}
        </Link>
      </nav>

      {/* Heading block */}
      <header className="mb-7 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {l.jurisdiction}
        </p>
        <h1 className="m-0 text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">
          {doc.title}
        </h1>
        <p className="m-0 text-[14px] text-[var(--muted)]">{doc.subtitle}</p>
      </header>

      {/* Meta card */}
      <div className="mb-7 rounded-2xl border border-[var(--border)]/80 bg-[var(--surface)]/70 p-4 backdrop-blur-sm sm:p-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <MetaItem
            icon={<Calendar03Icon size={15} strokeWidth={1.75} />}
            label={l.effective}
            value={l.effectiveDate}
          />
          <MetaItem
            icon={<Calendar03Icon size={15} strokeWidth={1.75} />}
            label={l.updated}
            value={l.updatedDate}
          />
          <MetaItem
            icon={<Shield01Icon size={15} strokeWidth={1.75} />}
            label={l.operatorLabel}
            value={l.operatorName}
          />
          <MetaItem
            icon={<BookOpen02Icon size={15} strokeWidth={1.75} />}
            label={l.rknNotice}
            value={l.operatorAddress}
            compact
          />
        </div>
        <p className="mt-4 border-t border-[var(--border)]/60 pt-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
          {l.rfBanner}
        </p>
      </div>

      {/* Intro */}
      <p className="mb-7 text-[15px] leading-[1.75] text-[var(--foreground)]/90">{doc.intro}</p>

      {/* Table of contents */}
      <nav
        aria-label={l.toc}
        className="mb-9 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/40 p-4 sm:p-5"
      >
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          {l.toc}
        </p>
        <ol className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {sections.map((sec) => {
            const node = getSectionNode(t, kind, sec.id);
            return (
              <li key={sec.id} className="list-none">
                <a
                  href={`#${kind}-${sec.id}`}
                  className="block truncate text-[13px] leading-relaxed text-[var(--foreground)]/85 underline-offset-2 transition-colors hover:text-accent hover:underline"
                >
                  {node.title}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Sections */}
      <article className="space-y-9 pb-6">
        {sections.map((sec) => {
          const node = getSectionNode(t, kind, sec.id);
          const sectionAnchor = `${kind}-${sec.id}`;
          return (
            <section key={sec.id} id={sectionAnchor} className="scroll-mt-24">
              <h2 className="mb-3 text-[18px] font-semibold leading-snug tracking-tight text-[var(--foreground)]">
                <a
                  href={`#${sectionAnchor}`}
                  className="no-underline transition-colors hover:text-accent"
                >
                  {node.title}
                </a>
              </h2>

              {sec.kind === "paragraphs" && (
                <div className="space-y-3 text-[14.5px] leading-[1.75] text-[var(--foreground)]/90">
                  {Array.from({ length: sec.paragraphs }, (_, i) => (
                    <p key={i} className="m-0">
                      {node[`p${i + 1}`]}
                    </p>
                  ))}
                </div>
              )}

              {sec.kind === "list" && (
                <div className="space-y-3 text-[14.5px] leading-[1.75] text-[var(--foreground)]/90">
                  {node.lead && <p className="m-0">{node.lead}</p>}
                  <ul className="m-0 list-none space-y-2 pl-0">
                    {Array.from({ length: sec.items }, (_, i) => (
                      <li
                        key={i}
                        className="relative pl-5 before:absolute before:left-1 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-accent"
                      >
                        {node[`l${i + 1}`]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sec.kind === "list-tail" && (
                <div className="space-y-3 text-[14.5px] leading-[1.75] text-[var(--foreground)]/90">
                  {node.lead && <p className="m-0">{node.lead}</p>}
                  <ul className="m-0 list-none space-y-2 pl-0">
                    {Array.from({ length: sec.items }, (_, i) => (
                      <li
                        key={i}
                        className="relative pl-5 before:absolute before:left-1 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-accent"
                      >
                        {node[`l${i + 1}`]}
                      </li>
                    ))}
                  </ul>
                  {node.tail && <p className="m-0">{node.tail}</p>}
                </div>
              )}
            </section>
          );
        })}
      </article>

      {/* Related link */}
      <div className="mt-10 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/60 p-4 sm:p-5">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          {l.relatedTitle}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={kind === "terms" ? "/privacy" : "/terms"}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:border-accent/50 hover:bg-[var(--surface-secondary)] hover:text-accent"
          >
            <BookOpen02Icon size={14} strokeWidth={1.75} />
            {kind === "terms" ? l.relatedPrivacy : l.relatedTerms}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:border-accent/50 hover:bg-[var(--surface-secondary)] hover:text-accent"
          >
            <ArrowLeft02Icon size={14} strokeWidth={1.75} />
            {l.backToLogin}
          </Link>
        </div>
      </div>
    </LegalShell>
  );
}

function MetaItem({
  icon,
  label,
  value,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
          {label}
        </p>
        <p
          className={`m-0 text-[13px] font-medium leading-snug text-[var(--foreground)] ${
            compact ? "" : "truncate"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
