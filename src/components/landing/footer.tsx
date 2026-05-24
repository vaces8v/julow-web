/**
 * Marketing-сайт footer. Колонки услуг/компании/ресурсов/контактов,
 * brand-блок с тэглайном.
 *
 * Мигрировано из `landing/app/components/footer.tsx`. Изменения:
 *   - "L-web" → "Julow" (логотип + copyright);
 *   - "hello@l-web.ru" → "hello@julow.ru" (placeholder, можно заменить
 *     на реальный domain);
 *   - "vk.com/lwebstudio" / "t.me/lwebstudio" → julowstudio.
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useI18n } from "@/i18n/context";

const currentYear = new Date().getFullYear();

export function Footer() {
  const { t } = useI18n();
  const l = t.landingPage;

  /** Колонки footer'а собираем из i18n-ключей, чтобы при смене локали
   *  все подписи (Product / Company / Resources / Contacts) переключались
   *  вместе с layout-ом. Hrefs нелокализованные — они общие. */
  const footerLinks = useMemo(
    () => [
      {
        title: l.footerColProduct,
        links: [
          { label: l.footerProductCloud, href: "/login" },
          { label: l.footerProductSelfHost, href: "/#section-contact" },
          { label: l.footerProductAI, href: "/#section-ai" },
          { label: l.footerProductBoards, href: "/#section-why" },
        ],
      },
      {
        title: l.footerColCompany,
        links: [
          { label: l.footerCompanyAbout, href: "/about" },
          { label: l.footerCompanyCases, href: "/portfolio" },
          { label: l.footerCompanyRoadmap, href: "/schedule" },
          { label: l.footerCompanyBlog, href: "/blog" },
          { label: l.footerCompanyContact, href: "/#section-contact" },
        ],
      },
      {
        title: l.footerColResources,
        links: [
          { label: l.footerResFaq, href: "/#section-faq" },
          { label: l.footerResLogin, href: "/login" },
          { label: l.footerResPrivacy, href: "/privacy" },
          { label: l.footerResTerms, href: "/terms" },
        ],
      },
      {
        title: l.footerColContacts,
        links: [
          { label: l.s7CiEmail, href: `mailto:${l.s7CiEmail}` },
          { label: l.s7CiPhone, href: `tel:${l.s7CiPhone.replace(/[^+0-9]/g, "")}` },
          { label: l.footerCity, href: "#" },
          { label: "Telegram", href: "https://t.me/julowstudio" },
          { label: "VK", href: "https://vk.com/julowstudio" },
        ],
      },
    ],
    [l],
  );
  return (
    <footer className="bg-zinc-50">
      <div className="container mx-auto px-4 border-l border-r border-zinc-200/80">
        <div className="py-16 md:py-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <Image src="/logo.png" alt="Julow" width={32} height={32} className="h-8 w-8 object-contain" />
              <span className="font-display text-2xl font-bold tracking-tight text-zinc-900">
                Julow
              </span>
            </Link>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6 max-w-xs">
              {l.footerTagline}
            </p>
          </div>

          {footerLinks.map((col) => (
            <div key={col.title} className="lg:col-span-1">
              <h4 className="text-sm font-semibold mb-4 tracking-wide uppercase text-zinc-900">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            © {currentYear} Julow. {l.footerCopy}
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              {l.footerPrivacy}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
