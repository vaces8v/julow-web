/**
 * Section6 «Блог» — превью статей в 4-column-grid с category-метками
 * и read-time.
 *
 * Мигрировано из `landing/app/components/section6.tsx`.
 */

"use client";

import Image from "next/image";
import { useMemo } from "react";
import { InView } from "@/components/landing/in-view";
import { ArrowRight01Icon, CheckmarkCircle01Icon, Edit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useI18n } from "@/i18n/context";

const blurFadeVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export function Section6() {
  const { t } = useI18n();
  const l = t.landingPage;
  const features = useMemo(
    () => [
      { icon: CheckmarkCircle01Icon, text: l.s6FeatExpert },
      { icon: CheckmarkCircle01Icon, text: l.s6FeatCases },
    ],
    [l],
  );
  const articles = useMemo(
    () => [
      { id: 1, title: l.s6A1Title, category: l.s6A1Cat, image: "/section-1/image1.png", description: l.s6A1Desc, readTime: l.s6A1Read },
      { id: 2, title: l.s6A2Title, category: l.s6A2Cat, image: "/section-1/image-bg2.png", description: l.s6A2Desc, readTime: l.s6A2Read },
      { id: 3, title: l.s6A3Title, category: l.s6A3Cat, image: "/section-1/image-bg3.png", description: l.s6A3Desc, readTime: l.s6A3Read },
      { id: 4, title: l.s6A4Title, category: l.s6A4Cat, image: "/section-1/image1.png", description: l.s6A4Desc, readTime: l.s6A4Read },
    ],
    [l],
  );
  return (
    <section id="section-blog" className="relative bg-zinc-50 overflow-hidden">
      <div className="container mx-auto px-4 border border-t-0 border-b-0 border-zinc-200/80">
        <div className="py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12 lg:mb-16">
            <div className="lg:col-span-7">
              <InView variants={blurFadeVariants} transition={{ duration: 0.5 }} viewOptions={{ once: true }}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 border border-zinc-200 mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                  </span>
                  <p className="text-xs font-medium tracking-wide text-zinc-600">{l.s6Badge}</p>
                </div>
              </InView>

              <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.1 }} viewOptions={{ once: true }}>
                <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-zinc-900 leading-[1.1] mb-6">
                  {l.s6TitleLine1}
                  <br />
                  <span className="text-sky-600">{l.s6TitleLine2}</span> {l.s6TitleLine3}
                </h2>
              </InView>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-end">
              <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.2 }} viewOptions={{ once: true }}>
                <p className="text-base md:text-lg text-zinc-600 leading-relaxed mb-6">
                  {l.s6Lead}
                </p>
              </InView>

              <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.3 }} viewOptions={{ once: true }}>
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-zinc-700">
                      <HugeiconsIcon icon={feature.icon} size={18} className="text-sky-500" />
                      <span>{feature.text}</span>
                    </div>
                  ))}
                </div>
              </InView>

              <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.4 }} viewOptions={{ once: true }}>
                <button className="flex items-center justify-center gap-3 w-full md:w-auto px-8 py-4 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-all duration-300 hover:shadow-lg hover:shadow-zinc-900/20 group whitespace-nowrap">
                  <HugeiconsIcon icon={Edit01Icon} size={20} />
                  {l.s6CtaRead}
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} className="transition-transform group-hover:translate-x-1" />
                </button>
              </InView>
            </div>
          </div>

          <InView variants={blurFadeVariants} transition={{ duration: 0.8, delay: 0.3 }} viewOptions={{ once: true }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {articles.map((article) => (
                <article
                  key={article.id}
                  className="group cursor-pointer rounded-2xl overflow-hidden bg-white border border-zinc-200/60 shadow-sm hover:shadow-xl transition-shadow duration-300 flex flex-col"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={article.image}
                      alt={article.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      loading="lazy"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                    <div className="absolute top-3 left-3">
                      <span className="text-[11px] font-medium text-white/90 bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full">
                        {article.category}
                      </span>
                    </div>

                    <div className="absolute bottom-3 right-3">
                      <span className="text-[11px] font-medium text-white/70">{article.readTime}</span>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-base font-display font-semibold text-zinc-900 mb-1.5 line-clamp-2 group-hover:text-sky-600 transition-colors duration-200">
                      {article.title}
                    </h3>
                    <p className="text-sm text-zinc-500 line-clamp-2 flex-1">{article.description}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {l.s6ReadMore}
                      <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </InView>
        </div>
      </div>
    </section>
  );
}
