/**
 * /portfolio — bento-grid галерея проектов. Hover-эффекты с slide-up
 * описания и метриками.
 *
 * Мигрировано из `landing/app/portfolio/page.tsx`. Отличие: оригинал
 * использовал `FluidSpiralScene` (Three.js / react-three-fiber) в
 * качестве декоративного hero-фона; чтобы не тянуть тяжёлый three-стек
 * в bundle, заменили на CSS-градиент с blur-blob'ами — визуально похоже,
 * но без WebGL-нагрузки.
 */

"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";

import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ChatWidget } from "@/components/landing/chat-widget";
import { TextEffect } from "@/components/landing/text-effect";

const projects = [
  {
    id: 1,
    title: "Экосистема Финтех-стартапа",
    category: "Веб-приложение",
    description: "Полный цикл разработки: от архитектуры до релиза. Интеграция AI-алгоритмов скоринга.",
    image: "/section-1/image-bg2.png",
    colSpan: "col-span-1 md:col-span-2 lg:col-span-8",
    rowSpan: "row-span-1 lg:row-span-2",
    metrics: { label: "Удержание", value: "45%" },
    blendMode: false,
  },
  {
    id: 2,
    title: "Умный бот для клиники",
    category: "AI Разработка",
    description: "Автоматическая запись на приём и FAQ-модуль, разгрузивший колл-центр.",
    image: "/bot.png",
    colSpan: "col-span-1 md:col-span-2 lg:col-span-4",
    rowSpan: "row-span-1 lg:row-span-1",
    blendMode: true,
  },
  {
    id: 3,
    title: "Премиальный лендинг",
    category: "Веб-дизайн",
    description: "Адаптивный дизайн с WebGL-анимациями для архитектурного бюро.",
    image: "/section-1/image1.png",
    colSpan: "col-span-1 md:col-span-2 lg:col-span-4",
    rowSpan: "row-span-1 lg:row-span-1",
    blendMode: false,
  },
  {
    id: 4,
    title: "Вывод в ТОП Яндекса",
    category: "SEO-продвижение",
    description: "Увеличение органического трафика для крупного интернет-магазина.",
    image: "/seo.png",
    colSpan: "col-span-1 md:col-span-2 lg:col-span-6",
    rowSpan: "row-span-1 lg:row-span-1",
    metrics: { label: "Рост трафика", value: "3x" },
    blendMode: true,
  },
  {
    id: 5,
    title: "Система онлайн-записи",
    category: "CRM Интеграция",
    description: "Кастомный виджет расписания для фитнес-центров клуба.",
    image: "/calendar.png",
    colSpan: "col-span-1 md:col-span-2 lg:col-span-6",
    rowSpan: "row-span-1 lg:row-span-1",
    blendMode: true,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function PortfolioPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-sky-200/40 via-transparent to-transparent opacity-60 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-200/30 via-transparent to-transparent opacity-60 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3" />
      </div>

      <div className="relative z-10 flex flex-col min-h-full">
        <Navbar />

        <div className="container mx-auto px-4 border-l border-r border-zinc-200/80 pt-32 pb-16 md:pt-40 md:pb-32 border-b relative overflow-hidden bg-zinc-50">
          {/* Декоративный фон вместо three.js FluidSpiralScene */}
          <div aria-hidden className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-80">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full"
                 style={{
                   background: "conic-gradient(from 0deg at 50% 50%, rgba(56,189,248,0.18), rgba(99,102,241,0.12), rgba(244,114,182,0.08), rgba(56,189,248,0.18))",
                   filter: "blur(80px)",
                 }} />
            <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-sky-200/40 to-transparent blur-[90px]" />
          </div>

          <div className="relative z-10 text-center max-w-4xl mx-auto lg:px-8">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-zinc-900 leading-tight mb-6">
              <TextEffect preset="fade-in-blur" per="word" delay={0.1}>
                Наши лучшие цифровые решения
              </TextEffect>
            </h1>
            <p className="text-xl md:text-2xl text-zinc-600 font-light mb-10 max-w-2xl mx-auto">
              <TextEffect preset="fade-in-blur" per="word" delay={0.4} as="span">
                От креативных лендингов до сложных веб-приложений и интеграций искусственного интеллекта.
              </TextEffect>
            </p>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.8 }}>
              <button className="px-8 py-4 bg-zinc-900 text-white font-medium rounded-full hover:bg-zinc-800 transition-all hover:shadow-lg inline-flex items-center gap-3 group">
                Обсудить ваш проект
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>
        </div>

        <div className="container mx-auto px-4 lg:px-8 py-16 md:py-24 border-l border-r border-zinc-200/80">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {projects.map((project) => (
              <motion.div
                key={project.id}
                variants={itemVariants}
                className={`${project.colSpan} ${project.rowSpan} group relative overflow-hidden rounded-[2rem] bg-white border border-zinc-200 hover:border-sky-200 shadow-sm hover:shadow-xl hover:shadow-sky-100/50 transition-all duration-500 min-h-[400px] flex flex-col justify-end`}
              >
                <div className="absolute inset-0 z-0 p-8 sm:p-12 transition-transform duration-700 group-hover:scale-105 flex items-center justify-center bg-zinc-50/50">
                  <div className="relative w-full h-full">
                    <Image
                      src={project.image}
                      alt={project.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      loading="lazy"
                      className={`object-contain ${project.blendMode ? "mix-blend-multiply" : "object-cover rounded-2xl"}`}
                    />
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-900/90 via-zinc-900/40 to-transparent z-10 transition-opacity duration-300 opacity-60 group-hover:opacity-80" />

                <div className="relative z-20 p-6 md:p-8 flex flex-col h-full pointer-events-none">
                  <div className={`mt-auto transform transition-transform duration-500 ease-in-out group-hover:-translate-y-[6rem] pointer-events-auto ${project.metrics ? "pb-16" : ""}`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className="inline-block px-4 py-2 bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-semibold rounded-full tracking-wide">
                        {project.category}
                      </span>
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 -translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 border border-white/30 hidden md:flex">
                        <HugeiconsIcon icon={ArrowUpRight01Icon} size={20} className="text-white" />
                      </div>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-display font-bold text-white">{project.title}</h3>
                  </div>

                  <div className={`absolute left-6 right-6 md:left-8 md:right-8 opacity-0 translate-y-8 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-in-out pointer-events-none group-hover:pointer-events-auto ${project.metrics ? "bottom-[5.5rem]" : "bottom-6 md:bottom-8"}`}>
                    <p className="text-sm md:text-base text-zinc-100 font-light max-w-lg leading-relaxed line-clamp-3 mb-2">
                      {project.description}
                    </p>
                  </div>

                  {project.metrics && (
                    <div className="absolute left-6 right-6 md:left-8 md:right-8 bottom-6 md:bottom-8 flex items-baseline gap-2 pt-4 border-t border-white/20 pointer-events-auto">
                      <span className="text-3xl font-bold text-sky-300">{project.metrics.value}</span>
                      <span className="text-sm text-zinc-200">{project.metrics.label}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="container mx-auto px-4 lg:px-8 py-16 md:py-24 border-l border-r border-zinc-200/80 bg-zinc-50">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white rounded-2xl border border-zinc-200/80 p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">Хотите такой же результат?</h2>
            <p className="text-zinc-500 mb-8 max-w-lg mx-auto">
              Давайте обсудим ваш проект и создадим что-то крутое вместе.
            </p>
            <Link href="/#section-contact" className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors">
              Начать проект
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
