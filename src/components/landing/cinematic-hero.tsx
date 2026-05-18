/**
 * CinematicSvgHero — декоративный SVG-hero для blog-страницы.
 * Орбитальные кольца + светящаяся центральная точка, всё крутится
 * за счёт `animate-[spin_..._linear_infinite]`.
 *
 * Скопировано из `landing/app/blog/cinematic-hero.tsx`.
 */

export const CinematicSvgHero = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-end">
    <div className="absolute right-[5%] top-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-sky-100/40 to-blue-200/30 blur-[100px] mix-blend-multiply" />

    <svg
      viewBox="0 0 1000 1000"
      className="absolute right-[-15%] top-1/2 -translate-y-1/2 w-[1100px] h-[1100px] opacity-60 text-zinc-300"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.8" />
          <stop offset="80%" stopColor="#7dd3fc" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g className="origin-center animate-[spin_60s_linear_infinite]">
        <circle cx="500" cy="500" r="450" stroke="url(#lineGrad)" strokeWidth="0.5" fill="none" />
        <circle cx="500" cy="500" r="350" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="5 20" fill="none" />
        <circle cx="500" cy="500" r="250" stroke="url(#lineGrad)" strokeWidth="0.5" fill="none" />

        <circle cx="950" cy="500" r="3" fill="#0ea5e9" className="opacity-50" />
        <circle cx="150" cy="500" r="4" fill="#38bdf8" />
        <circle cx="500" cy="250" r="2" fill="#0ea5e9" />
        <circle cx="500" cy="850" r="2" fill="#bae6fd" />
      </g>

      <g className="origin-center animate-[spin_40s_linear_infinite_reverse]">
        <circle cx="500" cy="500" r="400" stroke="#bae6fd" strokeWidth="0.5" strokeDasharray="1 15" fill="none" className="opacity-60" />
        <path d="M100 500 A400 400 0 0 1 900 500" stroke="url(#lineGrad)" strokeWidth="1" fill="none" className="opacity-40" />
        <circle cx="500" cy="100" r="3" fill="#0ea5e9" />
      </g>

      <g className="origin-center animate-[spin_80s_linear_infinite]">
        <circle cx="500" cy="500" r="180" stroke="url(#lineGrad)" strokeWidth="0.5" strokeDasharray="2 4" fill="none" className="opacity-70" />
        <circle cx="500" cy="500" r="120" stroke="#7dd3fc" strokeWidth="0.5" strokeDasharray="1 6" fill="none" className="opacity-50" />
        <circle cx="500" cy="500" r="70" stroke="url(#ringGrad)" strokeWidth="1" fill="none" className="opacity-80" />
        <circle cx="500" cy="500" r="40" stroke="#bae6fd" strokeWidth="0.5" strokeDasharray="1 3" fill="none" className="opacity-40" />

        <path d="M400 500 L500 400 L600 500 L500 600 Z" stroke="url(#ringGrad)" strokeWidth="0.5" fill="none" />
        <circle cx="500" cy="500" r="100" fill="url(#ringGrad)" className="opacity-10" />
      </g>

      <g>
        <circle cx="500" cy="500" r="6" fill="#0ea5e9" />
        <circle cx="500" cy="500" r="12" fill="#38bdf8" className="opacity-40 animate-pulse" />
        <circle cx="500" cy="500" r="24" fill="#7dd3fc" className="opacity-20 animate-pulse" style={{ animationDelay: "0.5s" }} />
      </g>
    </svg>
  </div>
);
