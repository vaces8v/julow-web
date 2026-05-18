/**
 * SectionSEO «Выводим сайты в топ поиска» — SEO-направление,
 * list-features + image (parallel к Section2 по структуре).
 *
 * Мигрировано из `landing/app/components/section-seo.tsx`.
 */

"use client";

import Image from "next/image";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { InView } from "@/components/landing/in-view";
import { useI18n } from "@/i18n/context";

const blurFadeVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

export function SectionSEO() {
  const { t } = useI18n();
  const l = t.landingPage;
  return (
    <section id="section-seo" className="relative bg-zinc-50 overflow-hidden">
      <div className="container mx-auto px-4 border border-t-0 border-b-0 border-zinc-200/80">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-h-[80vh] items-center py-16 md:py-24">
          <motion.div
            className="flex flex-col justify-center lg:col-span-5 lg:pl-16 xl:pl-24"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <InView variants={blurFadeVariants} transition={{ duration: 0.5, ease: "easeOut" }} viewOptions={{ once: true, margin: "-50px" }}>
              <p className="text-sm text-zinc-500 mb-4 tracking-wider uppercase">{l.seoEyebrow}</p>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} viewOptions={{ once: true, margin: "-50px" }}>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-zinc-900 leading-[1.1] mb-6 ">
                {l.seoTitleLine1}
                <br />
                <span className="text-sky-600">{l.seoTitleLine2}</span>
              </h2>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} viewOptions={{ once: true, margin: "-50px" }}>
              <p className="text-lg md:text-xl text-zinc-600 mb-8 max-w-lg leading-relaxed">
                {l.seoLead}
              </p>
            </InView>

            <motion.div variants={itemVariants} transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }} className="space-y-4 mb-10">
              {[
                { number: "01", text: l.seoStep1 },
                { number: "02", text: l.seoStep2 },
                { number: "03", text: l.seoStep3 },
                { number: "04", text: l.seoStep4 },
              ].map((item, index) => (
                <InView
                  key={index}
                  variants={blurFadeVariants}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 + index * 0.1 }}
                  viewOptions={{ once: true, margin: "-30px" }}
                >
                  <div className="flex items-start gap-4 group">
                    <span className="text-sm font-medium text-zinc-400 group-hover:text-sky-600 transition-colors">{item.number}</span>
                    <span className="text-zinc-700">{item.text}</span>
                  </div>
                </InView>
              ))}
            </motion.div>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, ease: "easeOut", delay: 0.7 }} viewOptions={{ once: true, margin: "-50px" }}>
              <a
                href="/#section-contact"
                className="inline-flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-all duration-300 hover:shadow-lg hover:shadow-zinc-900/20 group whitespace-nowrap"
              >
                {l.seoCta}
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} className="transition-transform group-hover:translate-x-1" />
              </a>
            </InView>
          </motion.div>

          <motion.div
            className="relative h-[350px] md:h-[450px] lg:h-[550px] lg:col-span-7 flex items-center justify-center"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <Image
              src="/seo.png"
              alt="SEO продвижение"
              width={700}
              height={550}
              loading="lazy"
              style={{ width: "100%", height: "auto" }}
              className="object-contain drop-shadow-none mix-blend-multiply"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
