/**
 * FAQ — аккордеон вопросов-ответов, sticky-заголовок слева,
 * раскрывающиеся карточки справа.
 *
 * Мигрировано из `landing/app/components/faq.tsx`.
 */

"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { InView } from "@/components/landing/in-view";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useI18n } from "@/i18n/context";

const blurFadeVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

// faqItems больше не модуль-level и собирается внутри компонента из i18n.

interface FaqItemData {
  question: string;
  answer: string;
}

function FaqItem({
  item,
  index,
  isOpen,
  onToggle,
}: {
  item: FaqItemData;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <button onClick={onToggle} className="w-full text-left group">
        <div className="flex items-center justify-between py-6">
          <h3
            className={`text-base md:text-lg font-semibold pr-8 transition-colors duration-200 ${
              isOpen ? "text-zinc-900" : "text-zinc-700 group-hover:text-zinc-900"
            }`}
          >
            {item.question}
          </h3>
          <motion.span
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 ${
              isOpen ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="7" y1="1" x2="7" y2="13" />
              <line x1="1" y1="7" x2="13" y2="7" />
            </svg>
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <p className="text-zinc-500 text-sm md:text-base leading-relaxed pb-6 pr-12 max-w-2xl">{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-px bg-zinc-200" />
    </motion.div>
  );
}

export function FAQ() {
  const { t } = useI18n();
  const l = t.landingPage;
  const [openIndex, setOpenIndex] = useState(0);

  const faqItems: FaqItemData[] = useMemo(
    () => [
      { question: l.faqQ1, answer: l.faqA1 },
      { question: l.faqQ2, answer: l.faqA2 },
      { question: l.faqQ3, answer: l.faqA3 },
      { question: l.faqQ4, answer: l.faqA4 },
      { question: l.faqQ5, answer: l.faqA5 },
    ],
    [l],
  );

  return (
    <section id="section-faq" className="relative bg-zinc-50 overflow-hidden">
      <div className="container mx-auto px-4 border border-t-0 border-b-0 border-zinc-200/80">
        <div className="py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 max-w-6xl mx-auto">
            <div className="flex flex-col justify-start lg:sticky lg:top-32 lg:self-start">
              <InView variants={blurFadeVariants} transition={{ duration: 0.6 }} viewOptions={{ once: true }}>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-zinc-900 leading-[1.1] mb-6">
                  {l.faqTitleLine1}
                  <br />
                  <span className="text-zinc-900">{l.faqTitleLine2}</span>
                </h2>
              </InView>

              <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.1 }} viewOptions={{ once: true }}>
                <p className="text-base md:text-lg text-zinc-500 leading-relaxed mb-8 max-w-md">
                  {l.faqLead}
                </p>
              </InView>

              <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.2 }} viewOptions={{ once: true }}>
                <a
                  href="#section-contact"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-700 transition-colors group"
                >
                  {l.faqCtaMore}
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="transition-transform group-hover:translate-x-1" />
                </a>
              </InView>
            </div>

            <div>
              <div className="h-px bg-zinc-200" />
              {faqItems.map((item, index) => (
                <FaqItem
                  key={index}
                  item={item}
                  index={index}
                  isOpen={openIndex === index}
                  onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
