"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { AuthShell } from "@/components/auth/auth-shell";
import { useI18n } from "@/i18n/context";
import { ArrowLeft01Icon, SmartPhone01Icon, RefreshIcon, Tick02Icon } from "hugeicons-react";

const EXPIRE_SECONDS = 300;

type QrCreateData = {
  qr_token: string;
  expires_at: string;
  qr_uri: string;
  poll_interval_ms: number;
};

type PollStatus = "pending" | "confirmed" | "expired" | "loading";

function secondsUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

export function QrLoginPageClient() {
  const { t } = useI18n();
  const a = t.auth;
  const router = useRouter();
  const steps = useMemo(
    () => [a.qrStep1, a.qrStep2, a.qrStep3, a.qrStep4],
    [a.qrStep1, a.qrStep2, a.qrStep3, a.qrStep4],
  );

  const [qrData, setQrData] = useState<QrCreateData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EXPIRE_SECONDS);
  const [pollStatus, setPollStatus] = useState<PollStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const createQr = useCallback(async () => {
    setError(null);
    setPollStatus("loading");
    const res = await fetch("/api/auth/qr/create", { method: "POST", credentials: "include" });
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: QrCreateData } | null;
    if (!res.ok || !json?.data?.qr_uri) {
      setError(a.qrCreateFailed ?? "Не удалось создать QR-код");
      setPollStatus("expired");
      return;
    }
    setQrData(json.data);
    setSecondsLeft(secondsUntil(json.data.expires_at));
    setPollStatus("pending");
  }, [a]);

  useEffect(() => {
    void createQr();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [createQr]);

  useEffect(() => {
    if (!qrData || pollStatus !== "pending") return;

    const tick = () => {
      setSecondsLeft(secondsUntil(qrData.expires_at));
    };
    const clock = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(clock);
  }, [qrData, pollStatus]);

  useEffect(() => {
    if (!qrData || pollStatus !== "pending") return;

    const intervalMs = qrData.poll_interval_ms || 2000;

    const poll = async () => {
      try {
        const res = await fetch(`/api/auth/qr/poll/${encodeURIComponent(qrData.qr_token)}`, {
          credentials: "include",
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: { status: PollStatus; user?: unknown };
        } | null;
        const status = json?.data?.status;
        if (status === "confirmed") {
          setPollStatus("confirmed");
          if (pollTimer.current) clearInterval(pollTimer.current);
          window.setTimeout(() => {
            router.replace("/workspace");
            router.refresh();
          }, 1200);
        } else if (status === "expired") {
          setPollStatus("expired");
          if (pollTimer.current) clearInterval(pollTimer.current);
        }
      } catch {
        /* keep polling */
      }
    };

    poll();
    pollTimer.current = setInterval(poll, intervalMs);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [qrData, pollStatus, router]);

  const refresh = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    void createQr();
  };

  const pct = qrData ? (secondsLeft / EXPIRE_SECONDS) * 100 : 0;
  const urgent = secondsLeft <= 20;
  const confirmed = pollStatus === "confirmed";

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

        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
              >
                <Tick02Icon size={32} strokeWidth={2} />
              </motion.div>
              <p className="text-center text-sm font-medium text-[var(--foreground)]">
                {a.qrConfirmedTitle ?? "Вход подтверждён"}
              </p>
              <p className="text-center text-xs text-[var(--muted)]">
                {a.qrConfirmedSubtitle ?? "Перенаправляем в рабочее пространство…"}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="qr"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
            >
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
                  {qrData?.qr_uri ? (
                    <QRCode value={qrData.qr_uri} size={192} level="M" fgColor="#111" bgColor="#fff" />
                  ) : (
                    <div className="flex h-[192px] w-[192px] items-center justify-center text-xs text-[var(--muted)]">
                      {pollStatus === "loading" ? "…" : "—"}
                    </div>
                  )}
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
                {error ? <p className="text-center text-xs text-[var(--danger)]">{error}</p> : null}
                {pollStatus === "expired" ? (
                  <button
                    type="button"
                    onClick={refresh}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {a.qrRefreshAria}
                  </button>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
      </div>
    </AuthShell>
  );
}
