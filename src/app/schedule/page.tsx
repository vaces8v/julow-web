/**
 * /schedule — таблица текущих и предстоящих проектов студии. Mock-data,
 * в будущем подключим к календарю/CRM.
 *
 * Мигрировано из `landing/app/schedule/page.tsx`. Изменения:
 *   - `framer-motion` → `motion/react`;
 *   - `../components/*` → `@/components/landing/*`.
 */

"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Calendar01Icon,
  CheckmarkCircle02Icon,
  HourglassIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";

import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ChatWidget } from "@/components/landing/chat-widget";
import { TextEffect } from "@/components/landing/text-effect";

const workTasks = {
  current: [
    {
      id: 1,
      title: "Разработка корпоративного сайта «ТехноПром»",
      client: "ООО «ТехноПром»",
      status: "В работе",
      startDate: "25 марта 2025",
      endDate: "15 апреля 2025",
      progress: 65,
      type: "Сайт под ключ",
      description: "Дизайн, вёрстка, посадка на CMS. Интеграция с CRM.",
    },
    {
      id: 2,
      title: "SEO-оптимизация интернет-магазина",
      client: "ИП Смирнов",
      status: "В работе",
      startDate: "20 марта 2025",
      endDate: "10 апреля 2025",
      progress: 40,
      type: "SEO",
      description: "Технический аудит, оптимизация скорости, структура URL.",
    },
  ],
  upcoming: [
    {
      id: 3,
      title: "Редизайн лендинга SaaS-продукта",
      client: "Стартап «FlowApp»",
      status: "Запланировано",
      startDate: "5 апреля 2025",
      endDate: "20 апреля 2025",
      progress: 0,
      type: "Дизайн",
      description: "Обновление UI/UX, адаптация под мобильные устройства.",
    },
    {
      id: 4,
      title: "Интеграция платёжной системы",
      client: "ООО «МаркетПлюс»",
      status: "Запланировано",
      startDate: "12 апреля 2025",
      endDate: "18 апреля 2025",
      progress: 0,
      type: "Интеграция",
      description: "Подключение ЮKassa и СБП для интернет-магазина.",
    },
    {
      id: 5,
      title: "Адаптивная вёрстка 15 страниц",
      client: "Агентство «Пиксель»",
      status: "Запланировано",
      startDate: "20 апреля 2025",
      endDate: "5 мая 2025",
      progress: 0,
      type: "Вёрстка",
      description: "Next.js, Tailwind CSS, анимации Framer Motion.",
    },
  ],
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function SchedulePage() {
  const currentCount = workTasks.current.length;
  const upcomingCount = workTasks.upcoming.length;

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
                Расписание работ
              </TextEffect>
            </h1>
            <p className="text-xl md:text-2xl text-zinc-500 font-light mb-8 max-w-2xl">
              <TextEffect preset="fade-in-blur" per="word" delay={0.4} as="span">
                Текущие проекты и ближайшие задачи. Узнайте, когда можно заказать работу.
              </TextEffect>
            </p>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.7 }} className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-zinc-600 text-sm bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-200/60">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} className="text-green-600" />
                <span>{currentCount} в работе</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-600 text-sm bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-200/60">
                <HugeiconsIcon icon={HourglassIcon} size={18} className="text-amber-500" />
                <span>{upcomingCount} запланировано</span>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="w-full border-b border-zinc-200/80" />

        <div className="container mx-auto px-4 lg:px-8 py-16 md:py-20 bg-zinc-50 border-l border-r border-zinc-200/80">
          <div className="mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">Сейчас в работе</h2>
              <span className="text-zinc-400 text-sm">({currentCount})</span>
            </motion.div>

            <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6" variants={containerVariants} initial="hidden" animate="visible">
              {workTasks.current.map((task) => (
                <motion.div key={task.id} variants={itemVariants} className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full mb-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {task.status}
                        </span>
                        <h3 className="text-xl font-bold text-zinc-900 leading-tight">{task.title}</h3>
                        <p className="text-zinc-500 text-sm mt-1">{task.client}</p>
                      </div>
                      <span className="text-zinc-400 text-xs font-medium bg-zinc-100 px-2 py-1 rounded">{task.type}</span>
                    </div>

                    <p className="text-zinc-600 text-sm mb-4">{task.description}</p>

                    <div className="flex items-center gap-4 text-zinc-500 text-sm mb-4">
                      <div className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={Calendar01Icon} size={14} />
                        <span>{task.startDate} — {task.endDate}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-zinc-500">Прогресс</span>
                      <span className="font-medium text-zinc-900">{task.progress}%</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">В очереди</h2>
              <span className="text-zinc-400 text-sm">({upcomingCount})</span>
            </motion.div>

            <motion.div className="space-y-4" variants={containerVariants} initial="hidden" animate="visible">
              {workTasks.upcoming.map((task, index) => (
                <motion.div key={task.id} variants={itemVariants} className="bg-white/80 backdrop-blur-sm rounded-xl border border-zinc-200/60 p-5 hover:bg-white hover:border-zinc-300 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-zinc-400 text-sm font-medium">#{index + 1}</span>
                        <h3 className="text-lg font-semibold text-zinc-900">{task.title}</h3>
                      </div>
                      <p className="text-zinc-500 text-sm">{task.client} · {task.type}</p>
                    </div>

                    <div className="flex items-center gap-6 md:justify-end">
                      <div className="text-sm text-zinc-500">
                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={Calendar01Icon} size={14} />
                          <span>Начало: {task.startDate}</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-amber-600 text-sm font-medium bg-amber-50 px-3 py-1 rounded-full">
                        <HugeiconsIcon icon={HourglassIcon} size={14} />
                        Ожидает
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="mt-12">
            <div className="bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-300 p-8 text-center hover:border-zinc-400 hover:bg-zinc-100/50 transition-all cursor-pointer group">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white border-2 border-dashed border-zinc-300 flex items-center justify-center group-hover:border-zinc-400 group-hover:scale-110 transition-all">
                <HugeiconsIcon icon={PlusSignIcon} size={28} className="text-zinc-400 group-hover:text-zinc-600" />
              </div>

              <h3 className="text-xl font-bold text-zinc-900 mb-2">Свободный слот</h3>
              <p className="text-zinc-500 mb-6 max-w-md mx-auto">
                После {workTasks.upcoming[workTasks.upcoming.length - 1]?.endDate || "текущих проектов"} можно начать ваш проект
              </p>

              <Link href="/#section-contact">
                <button className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors group-hover:shadow-lg">
                  Заказать работу
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
                </button>
              </Link>
            </div>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.6 }} className="text-center text-zinc-400 text-sm mt-8">
            Расписание обновляется в реальном времени. Срочные проекты — обсуждаются индивидуально.
          </motion.p>
        </div>

        <Footer />
      </div>

      <ChatWidget />
    </div>
  );
}
