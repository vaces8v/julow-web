/**
 * /blog — список статей в bento-grid стиле с cinematic SVG hero.
 *
 * Мигрировано из `landing/app/blog/page.tsx`. Изменения:
 *   - `framer-motion` → `motion/react`;
 *   - `../components/*` → `@/components/landing/*`;
 *   - `./cinematic-hero` → `@/components/landing/cinematic-hero`.
 */

"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Clock01Icon } from "@hugeicons/core-free-icons";

import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ChatWidget } from "@/components/landing/chat-widget";
import { TextEffect } from "@/components/landing/text-effect";
import { CinematicSvgHero } from "@/components/landing/cinematic-hero";

const posts = [
  {
    id: 1,
    title: "Как AI меняет веб-разработку в 2025 году",
    category: "Искусственный интеллект",
    excerpt:
      "Разбираем, как инструменты на основе LLM и AI-агенты трансформируют рабочие процессы разработчиков и что это значит для вашего бизнеса.",
    readTime: "7 мин",
    date: "28 марта 2025",
    gradient: "from-blue-100 to-sky-50",
  },
  {
    id: 2,
    title: "SEO-оптимизация Next.js приложений: полный гайд",
    category: "SEO",
    excerpt: "Технические приёмы от metadata API до структурированных данных.",
    readTime: "5 мин",
    date: "22 марта 2025",
    gradient: "from-indigo-100 to-violet-50",
  },
  {
    id: 3,
    title: "Glassmorphism 2025: как выглядит дорогой UI",
    category: "UI/UX Дизайн",
    excerpt: "Детальный разбор современного стеклянного дизайна — от принципов до кода.",
    readTime: "6 мин",
    date: "15 марта 2025",
    gradient: "from-sky-100 to-cyan-50",
  },
  {
    id: 4,
    title: "Архитектура микросервисов: когда стоит переходить",
    category: "Архитектура",
    excerpt: "Честный анализ плюсов и минусов микросервисного подхода для стартапов и корпораций.",
    readTime: "8 мин",
    date: "10 марта 2025",
    gradient: "from-cyan-100 to-teal-50",
  },
  {
    id: 5,
    title: "Анимации на JavaScript: GSAP против Framer Motion",
    category: "Разработка",
    excerpt: "Сравниваем два гиганта анимации по производительности, гибкости и кривой обучения.",
    readTime: "4 мин",
    date: "5 марта 2025",
    gradient: "from-blue-50 to-indigo-100",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};

export default function BlogPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 relative">
      <div className="relative z-10 flex flex-col min-h-full">
        <Navbar />

        <div className="container mx-auto px-4 border-l border-r border-zinc-200/80 border-b relative overflow-hidden bg-zinc-50" style={{ minHeight: "520px" }}>
          <CinematicSvgHero />

          <div className="relative z-20 flex flex-col justify-center pt-40 pb-20 max-w-2xl">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-zinc-900 leading-tight mb-6">
              <TextEffect preset="fade-in-blur" per="word" delay={0.1}>
                Знания и опыт
              </TextEffect>
            </h1>
            <p className="text-xl md:text-2xl text-zinc-500 font-light mb-10 max-w-xl">
              <TextEffect preset="fade-in-blur" per="word" delay={0.4} as="span">
                Разбираем технологии, дизайн и бизнес в цифровую эпоху.
              </TextEffect>
            </p>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.7 }}>
              <button className="px-8 py-4 bg-zinc-900 text-white font-medium rounded-full hover:bg-zinc-700 transition-all hover:shadow-lg inline-flex items-center gap-3 group">
                Все статьи
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>
        </div>

        <div className="container mx-auto px-4 lg:px-8 py-16 md:py-24 border-l border-r border-zinc-200/80 bg-white">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {posts.map((post) => (
              <Link href={`/blog/${post.id}`} key={post.id} className="group">
                <motion.div variants={itemVariants} className="flex flex-col h-full">
                  <div className={`w-full aspect-[16/10] rounded-2xl bg-gradient-to-br ${post.gradient} border border-zinc-100 mb-6 overflow-hidden relative shadow-sm transition-transform duration-500 group-hover:-translate-y-1 group-hover:shadow-md`}>
                    <div className="absolute inset-0 bg-white/20 group-hover:bg-transparent transition-colors duration-500" />
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-zinc-600 text-sm font-medium">{post.category}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-300" />
                    <span className="text-zinc-400 text-sm flex items-center gap-1.5">
                      <HugeiconsIcon icon={Clock01Icon} size={14} />
                      {post.readTime}
                    </span>
                  </div>

                  <h2 className="text-xl md:text-2xl font-bold text-zinc-900 leading-snug mb-3 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h2>

                  <p className="text-zinc-500 leading-relaxed line-clamp-3 mb-6 flex-grow">{post.excerpt}</p>

                  <div className="mt-auto text-sm text-zinc-400 font-medium pt-4 border-t border-zinc-100">{post.date}</div>
                </motion.div>
              </Link>
            ))}
          </motion.div>
        </div>

        <div className="container mx-auto px-4 lg:px-8 py-16 md:py-20 border-l border-r border-zinc-200/80 bg-zinc-50">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white rounded-2xl border border-zinc-200/80 p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">Нужна помощь с проектом?</h2>
            <p className="text-zinc-500 mb-8 max-w-lg mx-auto">
              Мы применяем все эти знания на практике. Давайте обсудим вашу задачу.
            </p>
            <Link href="/#section-contact" className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors">
              Связаться с нами
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
            </Link>
          </motion.div>
        </div>

        <Footer />
      </div>

      <ChatWidget />
    </div>
  );
}
