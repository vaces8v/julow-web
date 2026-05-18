/**
 * /about — страница «О нас» с миссией, ценностями, временной линией
 * и CTA-секцией в конце. Мигрировано из `landing/app/about/page.tsx`.
 *
 * Изменения:
 *   - "L-web" → "Julow" (в timeline и тэглайн);
 *   - `framer-motion` → `motion/react`;
 *   - Импорты компонент: `../components/*` → `@/components/landing/*`;
 *   - text-effect перенесён в `@/components/landing/text-effect`.
 */

"use client";

import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Calendar01Icon,
  UserIcon,
  AwardIcon,
  TargetIcon,
  FavouriteIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";

import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ChatWidget } from "@/components/landing/chat-widget";
import { TextEffect } from "@/components/landing/text-effect";

const companyValues = [
  {
    title: "Качество",
    description: "Каждый проект — это наша репутация. Мы не делаем «на отвали».",
    icon: AwardIcon,
  },
  {
    title: "Прозрачность",
    description: "Честные сроки, честные цены, понятные процессы.",
    icon: TargetIcon,
  },
  {
    title: "Забота",
    description: "Думаем о вашем бизнесе как о своём. Решаем задачи, а не просто пишем код.",
    icon: FavouriteIcon,
  },
];

const timeline = [
  {
    year: "2025",
    title: "Основание Julow",
    description: "Запуск студии. Фокус на Next.js, AI-интеграциях и современном веб-дизайне.",
  },
  {
    year: "Сейчас",
    title: "Активный рост",
    description: "Формируем портфолио, ищем первых клиентов, создаём классные проекты.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 relative border-l border-r border-zinc-200/80">
      <div className="relative z-10 flex flex-col min-h-full">
        <Navbar />

        <div className="container mx-auto px-4 border border-t-0 border-b-0 border-zinc-200/80 relative overflow-hidden bg-zinc-50" style={{ minHeight: "420px" }}>
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-30 pointer-events-none">
            <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-blue-200 blur-3xl mix-blend-multiply" />
            <div className="absolute top-40 right-40 w-48 h-48 rounded-full bg-sky-200 blur-3xl mix-blend-multiply" />
          </div>

          <div className="relative z-20 flex flex-col justify-center pt-36 pb-16 max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-display font-bold text-zinc-900 leading-tight mb-6">
              <TextEffect preset="fade-in-blur" per="word" delay={0.1}>
                О нас
              </TextEffect>
            </h1>
            <p className="text-xl md:text-2xl text-zinc-500 font-light mb-8 max-w-2xl">
              <TextEffect preset="fade-in-blur" per="word" delay={0.4} as="span">
                Создаём цифровые продукты, которые работают на результат.
              </TextEffect>
            </p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="flex items-center gap-6"
            >
              <div className="flex items-center gap-2 text-zinc-600 text-sm bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-200/60">
                <HugeiconsIcon icon={Calendar01Icon} size={18} />
                <span>С 2025 года</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-600 text-sm bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-200/60">
                <HugeiconsIcon icon={UserIcon} size={18} />
                <span>Новая студия</span>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="w-full border-b border-zinc-200/80" />

        <div className="container mx-auto px-4 lg:px-8 py-16 md:py-20 bg-zinc-50 border-l border-r border-zinc-200/80">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-4">Наши ценности</h2>
            <p className="text-zinc-500 max-w-xl">Три столпа, на которых держится наша работа.</p>
          </motion.div>

          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6" variants={containerVariants} initial="hidden" animate="visible">
            {companyValues.map((value) => (
              <motion.div key={value.title} variants={itemVariants} className="bg-white rounded-2xl border border-zinc-200/80 p-8">
                <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mb-6">
                  <HugeiconsIcon icon={value.icon} size={24} className="text-zinc-700" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-3">{value.title}</h3>
                <p className="text-zinc-500 leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="w-full border-b border-zinc-200/80" />

        <div className="container mx-auto px-4 lg:px-8 py-16 md:py-20 bg-zinc-50 border-l border-r border-zinc-200/80">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-4">Начало пути</h2>
            <p className="text-zinc-500 max-w-xl">Первые шаги и планы на будущее.</p>
          </motion.div>

          <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
            {timeline.map((item, index) => (
              <motion.div key={item.year} variants={itemVariants} className="flex gap-6 md:gap-12">
                <div className="flex-shrink-0 w-20 md:w-24 text-right">
                  <span className="text-xl md:text-2xl font-bold text-zinc-900">{item.year}</span>
                </div>
                <div className="relative flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-zinc-300 mt-2" />
                  {index !== timeline.length - 1 && <div className="absolute top-6 left-1.5 w-px h-full bg-zinc-200" />}
                </div>
                <div className="flex-1 pb-8">
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">{item.title}</h3>
                  <p className="text-zinc-500">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="w-full border-b border-zinc-200/80" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="container mx-auto px-4 lg:px-8 py-16 md:py-20 bg-zinc-50 border-l border-r border-zinc-200/80">
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">Давайте работать вместе</h2>
            <p className="text-zinc-500 mb-8 max-w-lg mx-auto">
              Расскажите о вашем проекте, и мы подберём лучшее решение для ваших задач.
            </p>
            <Link
              href="/#section-contact"
              className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Обсудить проект
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
            </Link>
          </div>
        </motion.div>

        <Footer />
      </div>

      <ChatWidget />
    </div>
  );
}
