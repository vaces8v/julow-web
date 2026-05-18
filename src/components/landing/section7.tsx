/**
 * Section7 «Контакты» — большая форма заявки + контактная карта с
 * Iridescence-фоном слева. С полной валидацией (имя/email/телефон/
 * компания/тип проекта/бюджет/способ связи/сообщение).
 *
 * Мигрировано из `landing/app/components/section7.tsx`. Изменения:
 *   - "L-web" → "Julow" (подпись «— Команда L-web» в нижней цитате);
 *   - `framer-motion` → `motion/react`;
 *   - `@/components/Iridescence` → `@/components/landing/iridescence`.
 */

"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { InView } from "@/components/landing/in-view";
import dynamic from "next/dynamic";
import { useI18n } from "@/i18n/context";
import {
  Mail01Icon,
  Calling02Icon,
  Location01Icon,
  ClockIcon,
  CheckmarkCircle01Icon,
  Tick02Icon,
  Cancel01Icon,
  Building03Icon,
  Dollar02Icon,
  LinkIcon,
  SmartPhoneIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const Iridescence = dynamic(() => import("@/components/landing/iridescence"), {
  ssr: false,
});

const blurFadeVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export function Section7() {
  const { t } = useI18n();
  const l = t.landingPage;
  const contactInfo = useMemo(
    () => [
      { icon: Calling02Icon, title: l.s7CiPhoneTitle, value: l.s7CiPhone, description: l.s7CiPhoneDesc },
      { icon: Mail01Icon, title: l.s7CiEmailTitle, value: l.s7CiEmail, description: l.s7CiEmailDesc },
      { icon: Location01Icon, title: l.s7CiAddressTitle, value: l.s7CiAddress, description: l.s7CiAddressDesc },
      { icon: ClockIcon, title: l.s7CiHoursTitle, value: l.s7CiHours, description: l.s7CiHoursDesc },
    ],
    [l],
  );
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    projectType: "",
    budget: "",
    contactMethod: "email",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = l.s7ErrName;
    if (!formData.email.trim()) newErrors.email = l.s7ErrEmail;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = l.s7ErrEmailInv;
    if (!formData.phone.trim()) newErrors.phone = l.s7ErrPhone;
    if (!formData.company.trim()) newErrors.company = l.s7ErrCompany;
    if (!formData.projectType) newErrors.projectType = l.s7ErrType;
    if (!formData.budget) newErrors.budget = l.s7ErrBudget;
    if (!formData.message.trim()) newErrors.message = l.s7ErrMsg;
    else if (formData.message.length < 10) newErrors.message = l.s7ErrMsgMin;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      name: true,
      email: true,
      phone: true,
      company: true,
      projectType: true,
      budget: true,
      message: true,
    });
    if (validate()) {
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({
          name: "",
          email: "",
          phone: "",
          company: "",
          projectType: "",
          budget: "",
          contactMethod: "email",
          message: "",
        });
        setTouched({});
        setErrors({});
      }, 3000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name]) validate();
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    validate();
  };

  const isValid = (field: string) =>
    touched[field] && !errors[field] && formData[field as keyof typeof formData];
  const isInvalid = (field: string) => touched[field] && errors[field];

  return (
    <section id="section-contact" className="relative bg-zinc-50 overflow-hidden">
      <div className="container mx-auto px-4 border border-t-0 border-b-0 border-zinc-200/80">
        <div className="py-16 md:py-24">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <InView variants={blurFadeVariants} transition={{ duration: 0.5 }} viewOptions={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 border border-zinc-200 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                </span>
                <p className="text-xs font-medium tracking-wide text-zinc-600">{l.s7Badge}</p>
              </div>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.1 }} viewOptions={{ once: true }}>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-zinc-900 leading-[1.1] mb-6">
                {l.s7TitleA} <span className="text-sky-600">{l.s7TitleHl}</span> {l.s7TitleB}
              </h2>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.2 }} viewOptions={{ once: true }}>
              <p className="text-lg text-zinc-600 leading-relaxed">
                {l.s7Lead}
              </p>
            </InView>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 lg:gap-10 max-w-6xl mx-auto">
            <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.3 }} viewOptions={{ once: true }}>
              <div className="h-full relative overflow-hidden">
                <div className="absolute inset-0 rounded-3xl overflow-hidden">
                  <Iridescence color={[0.3, 0.5, 0.9]} speed={0.8} amplitude={0.1} mouseReact={true} />
                </div>
                <div className="absolute inset-0 bg-zinc-900/40 rounded-3xl" />

                <div className="relative z-10 p-8 h-full flex flex-col justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 mb-6">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-medium text-white/70">{l.s7CardOnline}</span>
                    </div>

                    <h3 className="text-2xl font-display font-bold text-white mb-2 leading-tight">
                      {l.s7CardTeam}
                    </h3>
                    <p className="text-sm text-zinc-200 mb-8">{l.s7CardSub}</p>

                    <div className="space-y-0">
                      {contactInfo.map((item, index) => (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: 0.1 * index }}
                        >
                          <div className="flex items-center gap-3.5 py-3.5 group">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-zinc-50/15 text-zinc-50">
                              <HugeiconsIcon icon={item.icon} size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white group-hover:text-sky-300 transition-colors">
                                {item.value}
                              </p>
                              <p className="text-[11px] text-zinc-100">{item.description}</p>
                            </div>
                          </div>
                          {index < contactInfo.length - 1 && <div className="h-px bg-white/5" />}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-xs text-zinc-50 italic leading-relaxed">
                      {l.s7CardQuote}
                    </p>
                    <p className="text-[11px] text-zinc-100 mt-1.5">{l.s7CardQuoteAuthor}</p>
                  </div>
                </div>
              </div>
            </InView>

            <InView variants={blurFadeVariants} transition={{ duration: 0.6, delay: 0.4 }} viewOptions={{ once: true }}>
              <div className="relative">
                <div className="bg-white rounded-3xl border border-zinc-200 p-8 md:p-10 shadow-[0_4px_30px_rgba(0,0,0,0.06)]">
                  {isSubmitted ? (
                    <motion.div
                      className="flex flex-col items-center justify-center py-16 text-center"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={32} className="text-emerald-600" />
                      </div>
                      <h3 className="text-2xl font-display font-bold text-zinc-900 mb-2">
                        {l.s7SuccessTitle}
                      </h3>
                      <p className="text-zinc-600">{l.s7SuccessText}</p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="mb-2">
                        <h3 className="text-xl font-display font-bold text-zinc-900">{l.s7FormTitle}</h3>
                        <p className="text-sm text-zinc-500 mt-1">{l.s7FormSub}</p>
                      </div>

                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                          {l.s7Name}
                          {isValid("name") && <HugeiconsIcon icon={Tick02Icon} size={16} className="text-emerald-500" />}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder={l.s7NamePh}
                            className={`w-full px-4 py-3.5 rounded-2xl bg-zinc-50 border text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:bg-white transition-all text-sm ${
                              isInvalid("name")
                                ? "border-red-400 focus:ring-red-500/20 focus:border-red-500"
                                : isValid("name")
                                ? "border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500"
                                : "border-zinc-300 focus:ring-sky-500/20 focus:border-sky-500"
                            }`}
                          />
                          {isInvalid("name") && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-red-500" />
                            </div>
                          )}
                        </div>
                        {isInvalid("name") && <p className="text-xs text-red-500">{errors.name}</p>}
                      </div>

                      {/* Email & Phone */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                            {l.s7Email}
                            {isValid("email") && <HugeiconsIcon icon={Tick02Icon} size={16} className="text-emerald-500" />}
                          </label>
                          <div className="relative">
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              placeholder={l.s7EmailPh}
                              className={`w-full px-4 py-3.5 rounded-2xl bg-zinc-50 border text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:bg-white transition-all text-sm ${
                                isInvalid("email")
                                  ? "border-red-400 focus:ring-red-500/20 focus:border-red-500"
                                  : isValid("email")
                                  ? "border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500"
                                  : "border-zinc-300 focus:ring-sky-500/20 focus:border-sky-500"
                              }`}
                            />
                            {isInvalid("email") && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-red-500" />
                              </div>
                            )}
                          </div>
                          {isInvalid("email") && <p className="text-xs text-red-500">{errors.email}</p>}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                            {l.s7Phone}
                            {isValid("phone") && <HugeiconsIcon icon={Tick02Icon} size={16} className="text-emerald-500" />}
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              name="phone"
                              value={formData.phone}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              placeholder={l.s7PhonePh}
                              className={`w-full px-4 py-3.5 rounded-2xl bg-zinc-50 border text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:bg-white transition-all text-sm ${
                                isInvalid("phone")
                                  ? "border-red-400 focus:ring-red-500/20 focus:border-red-500"
                                  : isValid("phone")
                                  ? "border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500"
                                  : "border-zinc-300 focus:ring-sky-500/20 focus:border-sky-500"
                              }`}
                            />
                            {isInvalid("phone") && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-red-500" />
                              </div>
                            )}
                          </div>
                          {isInvalid("phone") && <p className="text-xs text-red-500">{errors.phone}</p>}
                        </div>
                      </div>

                      {/* Company */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                          <HugeiconsIcon icon={Building03Icon} size={16} className="text-zinc-400" />
                          {l.s7Company}
                          {isValid("company") && <HugeiconsIcon icon={Tick02Icon} size={16} className="text-emerald-500" />}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder={l.s7CompanyPh}
                            className={`w-full px-4 py-3.5 rounded-2xl bg-zinc-50 border text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:bg-white transition-all text-sm ${
                              isInvalid("company")
                                ? "border-red-400 focus:ring-red-500/20 focus:border-red-500"
                                : isValid("company")
                                ? "border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500"
                                : "border-zinc-300 focus:ring-sky-500/20 focus:border-sky-500"
                            }`}
                          />
                          {isInvalid("company") && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-red-500" />
                            </div>
                          )}
                        </div>
                        {isInvalid("company") && <p className="text-xs text-red-500">{errors.company}</p>}
                      </div>

                      {/* Project Type & Budget */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                            <HugeiconsIcon icon={LinkIcon} size={16} className="text-zinc-400" />
                            {l.s7DeployType}
                          </label>
                          <div className="relative">
                            <select
                              name="projectType"
                              value={formData.projectType}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className={`w-full px-4 py-3.5 rounded-2xl bg-zinc-50 border text-zinc-900 focus:outline-none focus:ring-2 focus:bg-white transition-all appearance-none cursor-pointer text-sm ${
                                isInvalid("projectType")
                                  ? "border-red-400 focus:ring-red-500/20 focus:border-red-500"
                                  : isValid("projectType")
                                  ? "border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500"
                                  : "border-zinc-300 focus:ring-sky-500/20 focus:border-sky-500"
                              }`}
                            >
                              <option value="">{l.s7DeployPh}</option>
                              <option value="cloud">{l.s7TypeCloud}</option>
                              <option value="on-prem">{l.s7TypeOnPrem}</option>
                              <option value="hybrid">{l.s7TypeHybrid}</option>
                              <option value="private-cloud">{l.s7TypePvtCloud}</option>
                              <option value="other">{l.s7TypeOther}</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                          {isInvalid("projectType") && <p className="text-xs text-red-500">{errors.projectType}</p>}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                            <HugeiconsIcon icon={Dollar02Icon} size={16} className="text-zinc-400" />
                            {l.s7TeamSize}
                          </label>
                          <div className="relative">
                            <select
                              name="budget"
                              value={formData.budget}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className={`w-full px-4 py-3.5 rounded-2xl bg-zinc-50 border text-zinc-900 focus:outline-none focus:ring-2 focus:bg-white transition-all appearance-none cursor-pointer text-sm ${
                                isInvalid("budget")
                                  ? "border-red-400 focus:ring-red-500/20 focus:border-red-500"
                                  : isValid("budget")
                                  ? "border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500"
                                  : "border-zinc-300 focus:ring-sky-500/20 focus:border-sky-500"
                              }`}
                            >
                              <option value="">{l.s7DeployPh}</option>
                              <option value="xs">{l.s7SizeXS}</option>
                              <option value="s">{l.s7SizeS}</option>
                              <option value="m">{l.s7SizeM}</option>
                              <option value="l">{l.s7SizeL}</option>
                              <option value="xl">{l.s7SizeXL}</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                          {isInvalid("budget") && <p className="text-xs text-red-500">{errors.budget}</p>}
                        </div>
                      </div>

                      {/* Contact Method */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                          <HugeiconsIcon icon={SmartPhoneIcon} size={16} className="text-zinc-400" />
                          {l.s7Contact}
                        </label>
                        <div className="flex gap-3">
                          {[
                            { value: "email", label: l.s7ContactEmail, icon: Mail01Icon },
                            { value: "phone", label: l.s7ContactPhone, icon: Calling02Icon },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, contactMethod: option.value }))}
                              className={`flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all text-sm ${
                                formData.contactMethod === option.value
                                  ? "bg-sky-50 border-sky-200 text-sky-700 shadow-sm"
                                  : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100"
                              }`}
                            >
                              <HugeiconsIcon icon={option.icon} size={18} />
                              <span className="font-medium">{option.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Message */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                          {l.s7Message}
                          {isValid("message") && <HugeiconsIcon icon={Tick02Icon} size={16} className="text-emerald-500" />}
                        </label>
                        <textarea
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          rows={3}
                          placeholder={l.s7MessagePh}
                          className={`w-full px-4 py-3.5 rounded-2xl bg-zinc-50 border text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:bg-white transition-all resize-none text-sm ${
                            isInvalid("message")
                              ? "border-red-400 focus:ring-red-500/20 focus:border-red-500"
                              : isValid("message")
                              ? "border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500"
                              : "border-zinc-300 focus:ring-sky-500/20 focus:border-sky-500"
                          }`}
                        />
                        <div className="flex justify-between">
                          {isInvalid("message") ? <p className="text-xs text-red-500">{errors.message}</p> : <span />}
                          <p className="text-xs text-zinc-400">{formData.message.length} {l.s7MessageCount}</p>
                        </div>
                      </div>

                      <motion.button
                        type="submit"
                        className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-sky-600 text-white text-sm font-semibold rounded-2xl hover:bg-sky-700 transition-all duration-300 hover:shadow-lg hover:shadow-sky-600/20 group mt-2"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {l.s7Submit}
                        <HugeiconsIcon icon={Mail01Icon} size={18} className="transition-transform group-hover:translate-x-1" />
                      </motion.button>

                      <p className="text-xs text-zinc-400 text-center">
                        {l.s7Agreement}
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </InView>
          </div>
        </div>
      </div>
    </section>
  );
}
