/**
 * Marketing-сайт navbar. Floating pill-форма по центру сверху.
 * Мобильное меню — slide-from-right drawer с группами разделов.
 *
 * Мигрировано из `landing/app/components/navbar.tsx`. Изменения:
 *   - `framer-motion` → `motion/react`;
 *   - "L-web" → "Julow" (логотип в desktop и mobile drawer);
 *   - Pricing-link `/pricing` оставлен в категории "Услуги" — у нас
 *     нет аналога, но обёрнут anchor, поэтому ничего не ломает.
 */

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Cancel01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useI18n } from "@/i18n/context";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

export function Navbar() {
  const { t } = useI18n();
  const n = t.landingNav;

  /**
   * Структура drop-down'а собирается из i18n-ключей. Категории/айтемы
   * специально подобраны под Julow PM: "Продукт" вместо "Услуги",
   * "Self-hosted" как третий тип «услуги» (без которого форма заявки
   * в Section7 выглядела бы вырванной из контекста).
   */
  const navSections = useMemo(
    () => [
      {
        category: n.catServices,
        items: [
          { title: n.serviceTasksTitle, description: n.serviceTasksDesc, href: "/#section-why" },
          { title: n.serviceAITitle, description: n.serviceAIDesc, href: "/#section-ai" },
          { title: n.serviceSelfHostTitle, description: n.serviceSelfHostDesc, href: "/#section-contact" },
        ],
      },
      {
        category: n.catCompany,
        items: [
          // "О нас" убран — на лендинге нет секции About, а отдельный
          // /about — заглушка вне потока лендинга. Оставляем
          // только разделы, на которые есть реальные якоря.
          { title: n.companyCasesTitle, description: n.companyCasesDesc, href: "/#section-portfolio" },
          { title: n.companyScheduleTitle, description: n.companyScheduleDesc, href: "/#section-schedule" },
        ],
      },
      {
        category: n.catSupport,
        items: [
          { title: n.supportBlogTitle, description: n.supportBlogDesc, href: "/#section-blog" },
          { title: n.supportFAQTitle, description: n.supportFAQDesc, href: "/#section-faq" },
          { title: n.supportContactTitle, description: n.supportContactDesc, href: "/#section-contact" },
        ],
      },
    ],
    [n],
  );

  const mobileLinks = useMemo(
    () => [
      { title: n.mobileHome, href: "/" },
      // Все ссылки — якоря на существующие секции лендинга.
      // Отдельных страниц /portfolio и /blog являются плацхолдерами
          // — навбар ведёт на якоря-секции внутри лендинга.
      { title: n.mobilePortfolio, href: "/#section-portfolio" },
      { title: n.mobileBlog, href: "/#section-blog" },
      { title: n.mobileFAQ, href: "/#section-faq" },
      { title: n.mobileContact, href: "/#section-contact" },
    ],
    [n],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const closeMenu = () => setIsOpen(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Desktop dropdown overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-zinc-900/40 z-40 pointer-events-none hidden md:block"
          />
        )}
      </AnimatePresence>

      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 h-[56px] w-[calc(100%-2rem)] max-w-[1100px] rounded-full flex items-center bg-zinc-50/80 backdrop-blur-2xl backdrop-saturate-150 border border-white/10">
        <div className="w-full flex items-center justify-between px-4 sm:px-6 h-full">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/logo.png" alt="Julow" width={24} height={24} className="h-6 w-6 object-contain" />
            <span className="font-display text-base font-semibold tracking-tight text-zinc-900">
              Julow
            </span>
          </Link>

          {/* Middle: Nav Links (desktop only) */}
          <div className="hidden md:flex items-center gap-0">
            <div
              className="relative z-50"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-full text-zinc-900/80 hover:text-zinc-900 hover:bg-zinc-900/10 transition-all duration-200 text-sm">
                {n.sectionsLabel}
                <motion.svg
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    className="absolute top-[calc(100%+16px)] left-1/2 -translate-x-1/2 w-[560px] bg-zinc-50/95 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-white/10 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)] p-5"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="grid grid-cols-3 gap-6">
                      {navSections.map((section, sectionIndex) => (
                        <div key={section.category}>
                          <p className="text-[11px] font-semibold text-zinc-800 uppercase tracking-widest mb-3 px-1">
                            {section.category}
                          </p>
                          <div className="space-y-1">
                            {section.items.map((item, index) => (
                              <motion.a
                                key={item.title}
                                href={item.href}
                                onClick={closeMenu}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: sectionIndex * 0.05 + index * 0.03, duration: 0.3 }}
                                className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/8 transition-all duration-200 group"
                              >
                                <div>
                                  <p className="text-sm font-medium text-zinc-900 group-hover:text-zinc-900 transition-colors duration-200 leading-tight">
                                    {item.title}
                                  </p>
                                  <p className="text-[11px] text-zinc-500 group-hover:text-zinc-600 transition-colors duration-200">
                                    {item.description}
                                  </p>
                                </div>
                              </motion.a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Top-nav якоря — ведут на реальные секции лендинга,
                а не на плейсхолдеры /portfolio /blog. Имена (n.portfolio /
                n.blog / n.faq) оставлены — это лейблы кнопок, а не пути. */}
            <Link href="/#section-portfolio" className="px-4 py-2 rounded-full text-zinc-900/80 hover:bg-zinc-900/10 transition-all duration-200 text-sm hover:text-zinc-900">
              {n.portfolio}
            </Link>
            <Link href="/#section-blog" className="px-4 py-2 rounded-full text-zinc-900/80 hover:bg-zinc-900/10 transition-all duration-200 text-sm hover:text-zinc-900">
              {n.blog}
            </Link>
            <Link href="/#section-faq" className="px-4 py-2 rounded-full text-zinc-900/80 hover:bg-zinc-900/10 transition-all duration-200 text-sm hover:text-zinc-900">
              {n.faq}
            </Link>
          </div>

          {/* Right: locale + secondary contact + Login CTA + burger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/*
             * LocaleSwitcher — визуально это маленькая EN/RU/DE-кнопка,
             * обёрнутая в круглый chip-стиль, чтобы попадать в ритм light-pillя.
             * `variant="landing"` из julow-web library ожидает обёртку
             * `flex h-full min-h-0`, поэтому даём фиксированную высоту.
             */}
            <div className="hidden sm:flex h-9 items-stretch overflow-hidden rounded-full border border-zinc-900/10 bg-white/60 backdrop-blur-sm">
              <LocaleSwitcher variant="landing" />
            </div>

            {/* Secondary text link — сохраняет быстрый доступ к форме
                 self-hosted-заявки (Section7) без рекламы. */}
            <Link
              href="/#section-contact"
              className="hidden md:inline-flex rounded-full px-4 py-2 text-zinc-900/80 hover:bg-zinc-900/10 transition-all duration-200 text-sm hover:text-zinc-900"
            >
              {n.contactSecondary}
            </Link>

            {/* Primary CTA — вход в свой workspace. Раньше была "Связаться",
                 но Julow — это продукт, у пользователей есть аккаунты. */}
            <Link
              href="/login"
              className="hidden md:inline-flex px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-full transition-all duration-200 text-sm font-medium whitespace-nowrap"
            >
              {n.login}
            </Link>

            <button
              aria-label={n.sectionsLabel}
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-900/10 transition-colors"
            >
              <HugeiconsIcon icon={Menu01Icon} size={22} className="text-zinc-900" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/40 z-[60] md:hidden"
              onClick={closeMobile}
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-[85vw] max-w-[360px] bg-white z-[70] md:hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
                <span className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-zinc-900">
                  <Image src="/logo.png" alt="Julow" width={24} height={24} className="h-6 w-6 object-contain" />
                  Julow
                </span>
                <button
                  aria-label={t.landingPage.chatMenuAria}
                  onClick={closeMobile}
                  className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-zinc-700" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-1 mb-8">
                  {mobileLinks.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                    >
                      <Link
                        href={link.href}
                        onClick={closeMobile}
                        className="block px-3 py-3 text-base font-medium text-zinc-900 rounded-xl hover:bg-zinc-50 transition-colors"
                      >
                        {link.title}
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {navSections.map((section, si) => (
                  <div key={section.category} className="mb-6">
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 px-3">
                      {section.category}
                    </p>
                    <div className="space-y-0.5">
                      {section.items.map((item, ii) => (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + si * 0.05 + ii * 0.03, duration: 0.25 }}
                        >
                          <Link
                            href={item.href}
                            onClick={closeMobile}
                            className="block px-3 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors"
                          >
                            <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                            <p className="text-xs text-zinc-500">{item.description}</p>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 px-6 py-5 border-t border-zinc-100">
                {/* LocaleSwitcher в drawer-footer'е рядом с CTA — мобильные
                    юзеры тоже должны иметь доступ к переключателю языка. */}
                <div className="flex h-11 items-stretch overflow-hidden rounded-full border border-zinc-200 bg-white">
                  <LocaleSwitcher variant="landing" />
                </div>
                <Link
                  href="/login"
                  onClick={closeMobile}
                  className="flex-1 text-center px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-full transition-colors text-sm font-medium"
                >
                  {n.login}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
