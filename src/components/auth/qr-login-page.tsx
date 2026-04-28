"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { useI18n } from "@/i18n/context";
import { ArrowLeft01Icon, SmartPhone01Icon, RefreshIcon } from "hugeicons-react";

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `julow://qr/${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const EXPIRE_SECONDS = 120;

export function QrLoginPageClient() {
  const { t } = useI18n();
  const a = t.auth;
  const steps = useMemo(
    () => [a.qrStep1, a.qrStep2, a.qrStep3, a.qrStep4],
    [a.qrStep1, a.qrStep2, a.qrStep3, a.qrStep4],
  );

  const [token, setToken] = useState(() => generateToken());
  const [secondsLeft, setSecondsLeft] = useState(EXPIRE_SECONDS);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setToken(generateToken());
          return EXPIRE_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = () => {
    setToken(generateToken());
    setSecondsLeft(EXPIRE_SECONDS);
  };

  const pct = (secondsLeft / EXPIRE_SECONDS) * 100;
  const urgent = secondsLeft <= 20;

  return (
    <AuthShell title={a.qrPageTitle} subtitle={a.qrPageSubtitle}>
      <div className="space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft01Icon size={14} strokeWidth={2} />
          {a.backToSignIn}
        </Link>

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="h-1 w-full bg-[var(--border)]/40">
            <div
              className="h-full origin-left transition-all duration-1000 ease-linear"
              style={{
                width: `${pct}%`,
                backgroundColor: urgent ? "var(--danger)" : "var(--accent)",
              }}
            />
          </div>

          <div className="flex flex-col items-center gap-5 px-6 py-8">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <QRCode value={token} size={192} level="M" fgColor="#111" bgColor="#fff" />
            </div>

            <div className="flex items-center gap-3">
              <span
                className="font-mono text-sm tabular-nums"
                style={{ color: urgent ? "var(--danger)" : "var(--muted)" }}
              >
                {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
                {String(secondsLeft % 60).padStart(2, "0")}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {urgent ? a.qrExpiringSoon : a.qrAutoRefresh}
              </span>
              <button
                type="button"
                onClick={refresh}
                className="rounded-lg p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                aria-label={a.qrRefreshAria}
              >
                <RefreshIcon size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <SmartPhone01Icon size={16} strokeWidth={2} className="text-accent" />
            <p className="text-sm font-semibold text-[var(--foreground)]">{a.qrHowTitle}</p>
          </div>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                  {i + 1}
                </span>
                <span className="text-sm leading-snug text-[var(--muted)]">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-center text-[11px] text-[var(--muted)]/70">{a.qrPreviewNote}</p>
      </div>
    </AuthShell>
  );
}
