/**
 * ChatWidget — плавающая кнопка чата (показывается при скролле вниз)
 * + slide-from-right drawer с псевдо-AI диалогом. Mock-responses
 * выбираются случайно.
 *
 * Мигрировано из `landing/app/components/chat-widget.tsx`. Изменения:
 *   - "L-web" → "Julow" в первом приветствии + footer-подписи;
 *   - `framer-motion` → `motion/react`.
 */

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Cancel01Icon, SentIcon, ChatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useI18n } from "@/i18n/context";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  time: string;
}

export function ChatWidget() {
  const { t, locale } = useI18n();
  const l = t.landingPage;
  /** Locale string для toLocaleTimeString — в зависимости от выбранного i18n locale. */
  const timeLocale = locale === "ru" ? "ru-RU" : locale === "de" ? "de-DE" : "en-US";
  const initialMessages: Message[] = useMemo(
    () => [
      {
        id: 1,
        text: l.chatGreeting,
        sender: "bot",
        time: new Date().toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" }),
      },
    ],
    [l.chatGreeting, timeLocale],
  );
  const botResponses = useMemo(
    () => [l.chatBot1, l.chatBot2, l.chatBot3, l.chatBot4],
    [l],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => setShowButton(window.scrollY > 200);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const sendMessage = () => {
    if (!input.trim()) return;

    const now = new Date().toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = { id: Date.now(), text: input.trim(), sender: "user", time: now };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const botMsg: Message = {
        id: Date.now() + 1,
        text: botResponses[Math.floor(Math.random() * botResponses.length)],
        sender: "bot",
        time: new Date().toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" }),
      };
      setIsTyping(false);
      setMessages((prev) => [...prev, botMsg]);
    }, 1200 + Math.random() * 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <AnimatePresence>
        {showButton && !isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => setIsOpen(true)}
            aria-label={l.chatAriaOpen}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-600/30 flex items-center justify-center transition-colors duration-200 cursor-pointer"
          >
            <HugeiconsIcon icon={ChatIcon} size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/40 z-[80]"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[400px] sm:max-w-[90vw] bg-white z-[90] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 bg-sky-600 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                    <HugeiconsIcon icon={ChatIcon} size={20} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white leading-tight">{l.chatTitle}</h4>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] text-white/70">{l.chatOnline}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label={l.chatAriaClose}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-zinc-50">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-sky-600 text-white rounded-2xl rounded-br-md"
                          : "bg-white text-zinc-800 rounded-2xl rounded-bl-md border border-zinc-100 shadow-sm"
                      }`}
                    >
                      <p>{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${msg.sender === "user" ? "text-white/60" : "text-zinc-400"}`}>{msg.time}</p>
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                    <div className="bg-white text-zinc-500 rounded-2xl rounded-bl-md border border-zinc-100 shadow-sm px-4 py-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 px-4 py-3 bg-white border-t border-zinc-100">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={l.chatPlaceholder}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    aria-label={l.chatSend}
                    className="w-10 h-10 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-zinc-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  >
                    <HugeiconsIcon icon={SentIcon} size={18} />
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 text-center mt-2">{l.chatFooter}</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
