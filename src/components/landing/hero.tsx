/**
 * Hero — full-screen первый экран с заголовком, email-формой подписки
 * и анимированными mesh-блобами на бэкграунде. Email-валидация
 * локальная (regex), toast-feedback на success/warning.
 *
 * Мигрировано из `landing/app/components/hero.tsx` без изменения копии.
 *
 * Замечание: <style jsx> остался — keyframes floatMesh1/2/3 и fadeInUp
 * также дублированы в globals.css. Локальный scoped-вариант
 * перекрывает имена, что нормально (одинаковые keyframes).
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ArrowRight01Icon, Alert01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { TextEffect } from "@/components/landing/text-effect";
import { useI18n } from "@/i18n/context";

type ToastType = "success" | "warning";

interface ToastData {
  id: number;
  type: ToastType;
  message: string;
}

function Toast({ toast, onDone }: { toast: ToastData; onDone: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDone(toast.id), 300);
    }, 3000);
    return () => clearTimeout(t);
  }, [toast.id, onDone]);

  const isSuccess = toast.type === "success";

  return (
    <div
      className={`
        flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-xl
        transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] pointer-events-auto
        ${isSuccess
          ? "bg-emerald-50/90 border-emerald-200/60 text-emerald-800"
          : "bg-amber-50/90 border-amber-200/60 text-amber-800"}
        ${visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95"}
      `}
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${isSuccess ? "bg-emerald-100" : "bg-amber-100"}`}>
        <HugeiconsIcon icon={isSuccess ? CheckmarkCircle01Icon : Alert01Icon} size={18} className={isSuccess ? "text-emerald-600" : "text-amber-600"} />
      </div>
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Hero() {
  const { t } = useI18n();
  const l = t.landingPage;
  const [email, setEmail] = useState("");
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const hasValue = email.trim().length > 0;

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  }, []);

  const handleSubmit = () => {
    if (!hasValue) return;
    if (!EMAIL_RE.test(email.trim())) {
      addToast("warning", l.heroToastInvalid);
      return;
    }
    // Email ловится как заявка на демо Julow / self-hosted-развёртку.
    // Полная форма со спецификациями — в Section7.
    addToast("success", l.heroToastSuccess);
    setEmail("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <section className="relative overflow-hidden bg-zinc-50" style={{ contain: "paint" }}>
      <div className="relative z-20 container mx-auto px-4 border-l border-r border-zinc-200/80 min-h-screen flex flex-col items-center justify-center py-16 md:py-20 overflow-hidden text-zinc-900">
        {/* Light Mesh Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 z-0">
            {/* Blob 1 — sky blue */}
            <div className="absolute top-[15%] left-[25%] -translate-x-1/2 -translate-y-1/2">
              <div
                className="w-[60vw] md:w-[60vw] lg:w-[800px] h-[60vw] md:h-[60vw] lg:h-[800px] rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(14,165,233,0.2) 0%, rgba(14,165,233,0) 70%)",
                  filter: "blur(30px)",
                  animation: "floatMesh1 12s ease-in-out infinite alternate",
                  willChange: "transform",
                }}
              />
            </div>
            {/* Blob 2 — indigo */}
            <div className="absolute bottom-[-5%] right-[-5%]">
              <div
                className="w-[50vw] md:w-[50vw] lg:w-[800px] h-[50vw] md:h-[50vw] lg:h-[800px] rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0) 70%)",
                  filter: "blur(40px)",
                  animation: "floatMesh2 15s ease-in-out infinite alternate",
                  willChange: "transform",
                }}
              />
            </div>
            {/* Blob 3 — cyan */}
            <div className="absolute top-[-5%] right-[10%]">
              <div
                className="w-[45vw] md:w-[40vw] lg:w-[600px] h-[45vw] md:h-[40vw] lg:h-[600px] rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0) 70%)",
                  filter: "blur(35px)",
                  animation: "floatMesh3 10s ease-in-out infinite alternate",
                  willChange: "transform",
                }}
              />
            </div>
          </div>

          {/* Rotated Glass Columns Layer */}
          <div
            className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 rotate-45 z-10"
            style={{ width: "300%", height: "300%" }}
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-full"
                style={{
                  background: "linear-gradient(90deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.03) 100%)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  borderLeft: "1px solid rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Text Content */}
        <div className="relative z-10 text-center max-w-3xl mb-6 md:mb-8 pointer-events-auto px-2">
          {/* eyebrow-бейдж — позиционирует продукт сразу: PM + self-hosted */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full bg-white border border-zinc-200 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
            </span>
            <span className="text-[11px] font-medium tracking-wide text-zinc-700 uppercase">
              {l.heroBadge}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4 md:mb-6 leading-tight md:leading-none">
            <TextEffect preset="fade-in-blur" per="word" delay={0.2} key={l.heroTitle}>
              {l.heroTitle}
            </TextEffect>
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-zinc-600 mb-3 md:mb-4 leading-relaxed tracking-wide font-light">
            <TextEffect preset="fade-in-blur" per="word" delay={0.5} as="span" key={l.heroSub1}>
              {l.heroSub1}
            </TextEffect>
          </p>
          <p className="text-sm sm:text-base md:text-lg text-zinc-500 mb-6 md:mb-8 max-w-2xl mx-auto font-light leading-relaxed">
            <TextEffect preset="fade-in-blur" per="word" delay={0.8} as="span" key={l.heroSub2}>
              {l.heroSub2}
            </TextEffect>
          </p>

          {/* CTA Block. Левый input — быстрый лидген на демо/self-hosted.
               Правая кнопка — вход в свой workspace для существующих юзеров. */}
          <div
            className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pointer-events-auto mt-6 md:mt-10"
            style={{ animation: "fadeInUp 0.6s ease-out 1.1s both" }}
          >
            <div className="flex items-center bg-white rounded-full border border-zinc-200 shadow-sm p-1.5 pl-4 sm:pl-5 w-full sm:w-auto">
              <input
                type="email"
                placeholder={l.heroEmailPh}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-[160px] sm:min-w-[200px] bg-transparent outline-none text-zinc-700 placeholder:text-zinc-400 text-sm"
                style={{ paddingRight: 8 }}
              />
              <button
                aria-label={l.heroCtaDemoAria}
                onClick={handleSubmit}
                className="flex items-center justify-center bg-sky-500 hover:bg-sky-600 active:scale-95 text-white rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ml-2 overflow-hidden shrink-0"
                /*
                 * Ширины подобраны под самый длинный вариант текста среди
                 * локалей: "Отправить" (RU) ≈ 75px при text-sm font-medium.
                 * 150px = paddingX 16+16 + gap 8 + icon 18 + 92 на текст.
                 * maxWidth ползунка-span'а 100px — с запасом, на случай
                 * вариаций рендеринга шрифта.
                 */
                style={{
                  width: hasValue ? 150 : 40,
                  height: 40,
                  gap: hasValue ? 8 : 0,
                  paddingLeft: hasValue ? 16 : 0,
                  paddingRight: hasValue ? 16 : 0,
                }}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} className="shrink-0 transition-transform duration-300" />
                <span
                  className="text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden"
                  style={{
                    maxWidth: hasValue ? 100 : 0,
                    opacity: hasValue ? 1 : 0,
                  }}
                >
                  {l.heroCtaDemo}
                </span>
              </button>
            </div>

            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 shadow-sm rounded-full font-medium transition-colors duration-200 whitespace-nowrap text-sm text-center"
            >
              {l.heroCtaLogin}
            </Link>
          </div>
        </div>
      </div>

      <div className="fixed z-[100] flex flex-col gap-2 pointer-events-none top-20 left-4 right-4 items-center sm:top-auto sm:bottom-6 sm:left-auto sm:right-6 sm:items-end">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDone={removeToast} />
        ))}
      </div>
    </section>
  );
}
