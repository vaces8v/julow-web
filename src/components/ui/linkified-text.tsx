"use client";

import type { ReactNode } from "react";

// Detects `http(s)://...` URLs as well as bare `www.*` URLs. The pattern stops
// at common trailing punctuation/whitespace that's unlikely to be part of the
// URL — keeps things conservative for chat messages.
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>")\]]+/gi;

// Trailing punctuation that the regex might greedily consume but which is
// almost never actually part of the URL (trailing dots / parentheses / etc.).
const TRAILING_PUNCT_RE = /[.,!?;:)\]"']+$/;

/**
 * Splits `text` into plain segments and clickable link nodes. Each detected
 * URL is rendered as a `<button>` that forwards the URL to `onLinkClick`,
 * letting the parent show a confirmation modal before actually navigating.
 *
 * Returning a button (instead of an `<a href>`) is deliberate: it prevents
 * accidental "open in new tab" / middle-click bypasses of the confirmation
 * step, and lets us keep `noopener noreferrer` semantics in one place.
 */
export function LinkifiedText({
  text,
  onLinkClick,
  linkClassName = "cursor-pointer text-sky-500 underline underline-offset-2 hover:text-sky-400 active:text-sky-600 break-all",
}: {
  text: string;
  onLinkClick: (url: string) => void;
  linkClassName?: string;
}): ReactNode {
  if (!text) return null;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // `RegExp` instances are stateful when used with the `g` flag — reset
  // `lastIndex` defensively so repeated renders don't drift.
  URL_RE.lastIndex = 0;
  let i = 0;

  while ((match = URL_RE.exec(text)) !== null) {
    const start = match.index;
    let matched = match[0];

    // Strip trailing punctuation so "see https://foo.com." doesn't link the dot.
    const trailing = matched.match(TRAILING_PUNCT_RE);
    if (trailing) {
      matched = matched.slice(0, matched.length - trailing[0].length);
    }

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    const href = matched.startsWith("http") ? matched : `https://${matched}`;
    parts.push(
      <button
        key={`lk-${i++}`}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onLinkClick(href);
        }}
        className={linkClassName}
      >
        {matched}
      </button>,
    );

    lastIndex = start + matched.length;
    if (trailing) {
      // We trimmed punctuation off the link — push it back into the plain
      // text stream so the rendered message still reads naturally.
      parts.push(trailing[0]);
      lastIndex += trailing[0].length;
    }
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
