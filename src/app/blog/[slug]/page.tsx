/**
 * /blog/[slug] — детальная страница статьи. Контент пока mock-овый
 * (HTML-строка); в будущем подключим к CMS или MDX. `params.slug`
 * читается, но используется только для url-навигации — все статьи
 * показывают один и тот же контент-плейсхолдер.
 *
 * Мигрировано из `landing/app/blog/[slug]/page.tsx`.
 *
 * NB: Next.js 16 — async `params` для page-компонента. Тип — Promise.
 */

"use client";

import React, { use } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Clock01Icon } from "@hugeicons/core-free-icons";

import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ChatWidget } from "@/components/landing/chat-widget";

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  // Next.js 16 — await params. Используем React `use()` чтобы не ломать
  // 'use client'-семантику.
  use(params);

  const post = {
    title: "Как AI меняет веб-разработку в 2025 году",
    category: "Искусственный интеллект",
    date: "28 марта 2025",
    readTime: "7 мин",
    author: "Александр Иванов",
    content: `
      <p>Мир веб-разработки стремительно меняется. С появлением инструментов на базе больших языковых моделей (LLM) рутинные задачи, которые раньше занимали часы, теперь выполняются за секунды.</p>

      <h3>Что изменилось?</h3>
      <p>Вместо написания шаблонного кода, разработчики всё чаще выступают в роли «архитекторов систем», делегируя написание базовой логики AI-агентам. Это не значит, что программисты больше не нужны — наоборот, ценность глубокого понимания архитектуры только возросла.</p>

      <blockquote>
        "Искусственный интеллект не заменит инженеров, но инженеры, использующие ИИ, заменят тех, кто полагается только на старые инструменты."
      </blockquote>

      <h3>Основные тренды 2025 года</h3>
      <ul>
        <li><strong>Автоматическая генерация UI:</strong> Создание целых интерфейсов по текстовому описанию (Prompt-to-UI).</li>
        <li><strong>Интеллектуальный дебаггинг:</strong> Системы, которые не только находят ошибки, но и предлагают контекстно-зависимые пути решения.</li>
        <li><strong>Конкретика и качество:</strong> LLM стали реже галлюцинировать при работе с современными фреймворками вроде Next.js, если предоставить им правильный контекст.</li>
      </ul>

      <p>Ключевым навыком становится умение правильно формулировать задачи для машинно-когнитивных систем и эффективно проверять их результаты.</p>
    `,
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 relative border-l border-r border-zinc-200/80">
      <Navbar />

      <main className="flex-grow pt-32 lg:pt-40 pb-24 relative z-10 block">
        <header className="container mx-auto px-4 lg:px-8 max-w-4xl mb-12">
          <Link href="/blog" className="inline-flex items-center gap-2 text-zinc-500 hover:text-blue-600 transition-colors mb-10 text-sm font-medium">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
            Назад к блогу
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-blue-600 text-sm font-semibold tracking-wide uppercase">{post.category}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-zinc-300" />
            <span className="text-zinc-500 text-sm">{post.date}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-zinc-300" />
            <span className="text-zinc-500 text-sm flex items-center gap-1.5">
              <HugeiconsIcon icon={Clock01Icon} size={14} />
              {post.readTime}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-5xl tracking-tight font-bold text-zinc-900 leading-[1.15] mb-8">
            {post.title}
          </h1>

          <div className="flex items-center gap-4 border-t border-zinc-100 pt-8 mt-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-sky-200 border border-zinc-200" />
            <div>
              <p className="font-semibold text-zinc-900">{post.author}</p>
              <p className="text-zinc-500 text-sm">Инженер-разработчик</p>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 lg:px-8 max-w-5xl mb-16">
          <div className="w-full aspect-[21/9] bg-gradient-to-br from-slate-50 to-zinc-100 rounded-3xl border border-zinc-100 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <div className="w-32 h-32 rounded-full bg-sky-200 blur-3xl mix-blend-multiply" />
              <div className="w-32 h-32 rounded-full bg-blue-200 blur-3xl mix-blend-multiply -ml-16" />
            </div>
          </div>
        </div>

        <article className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div
            className="article-content text-zinc-600 leading-[1.8] text-[1.125rem]"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          <style jsx global>{`
            .article-content h3 {
              font-family: inherit;
              font-size: 1.6rem;
              font-weight: 700;
              color: #18181b;
              margin-top: 3rem;
              margin-bottom: 1.25rem;
              letter-spacing: -0.015em;
              line-height: 1.3;
            }
            .article-content p { margin-bottom: 1.5rem; }
            .article-content ul {
              list-style-type: none;
              padding-left: 0;
              margin-top: 1.5rem;
              margin-bottom: 1.5rem;
            }
            .article-content li {
              position: relative;
              padding-left: 1.5rem;
              margin-bottom: 0.75rem;
            }
            .article-content li::before {
              content: "";
              position: absolute;
              left: 0.25rem;
              top: 0.6rem;
              width: 0.375rem;
              height: 0.375rem;
              border-radius: 50%;
              background-color: #d4d4d8;
            }
            .article-content blockquote {
              border-left: 3px solid #3b82f6;
              background-color: #f8fafc;
              padding: 1.5rem 1.5rem;
              border-radius: 0 0.5rem 0.5rem 0;
              font-style: italic;
              color: #3f3f46;
              margin-top: 2.5rem;
              margin-bottom: 2.5rem;
              font-size: 1.2rem;
              line-height: 1.6;
            }
            .article-content strong {
              color: #18181b;
              font-weight: 600;
            }
          `}</style>
        </article>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}
