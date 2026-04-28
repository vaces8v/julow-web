"use client";

import { useEffect, useRef } from "react";

/* ─── Animated mesh-gradient WebGL background ─────────────────────────
 * Theme-aware: reads CSS variables (`--accent`, `--background`) so it
 * follows light/dark automatically.  Three drifting radial blobs blend
 * in screen space, giving a Linear/Vercel-style organic gradient.
 * ─────────────────────────────────────────────────────────────────── */

const VS = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FS = `
precision highp float;
uniform vec2 u_res;
uniform float u_t;
uniform vec2 u_m;
uniform vec3 u_bg;
uniform vec3 u_a1;
uniform vec3 u_a2;
uniform vec3 u_a3;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_res.x / u_res.y;

  float t = u_t * 0.18;
  vec2 m = (u_m * 2.0 - 1.0) * 0.25;

  vec2 b1 = vec2(sin(t * 0.7) * 0.75, cos(t * 0.55) * 0.5) + m;
  vec2 b2 = vec2(cos(t * 0.4 + 1.3) * 0.85, sin(t * 0.65 + 0.6) * 0.55) - m * 0.6;
  vec2 b3 = vec2(sin(t * 0.5 + 2.2) * 0.65, cos(t * 0.8 + 1.0) * 0.7) + m * 0.3;

  float d1 = 1.0 / (length(p - b1) * 1.6 + 0.35);
  float d2 = 1.0 / (length(p - b2) * 1.8 + 0.35);
  float d3 = 1.0 / (length(p - b3) * 2.0 + 0.4);

  vec3 col = u_bg;
  col = mix(col, u_a1, clamp(d1 * 0.55, 0.0, 0.85));
  col = mix(col, u_a2, clamp(d2 * 0.42, 0.0, 0.7));
  col = mix(col, u_a3, clamp(d3 * 0.4, 0.0, 0.65));

  // subtle grain to avoid banding
  float g = (hash(gl_FragCoord.xy) - 0.5) * 0.018;
  col += g;

  // soft radial vignette pulls eye to center
  float vig = smoothstep(1.6, 0.2, length(p));
  col = mix(col * 0.82, col, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(c: string): [number, number, number] {
  /* Accepts #rrggbb | #rgb | oklch() | rgb() — returns sRGB 0..1 */
  if (typeof window === "undefined") return [0.1, 0.1, 0.15];
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [0.1, 0.1, 0.15];
  ctx.fillStyle = "#000";
  ctx.fillStyle = c;
  const resolved = ctx.fillStyle as string;
  const m = resolved.match(/#([0-9a-f]{6})/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const r = resolved.match(/\d+(\.\d+)?/g);
  if (r && r.length >= 3) return [+r[0] / 255, +r[1] / 255, +r[2] / 255];
  return [0.1, 0.1, 0.15];
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function ShaderBG({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const mouseRef = useRef<[number, number]>([0.5, 0.5]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aLoc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uT = gl.getUniformLocation(prog, "u_t");
    const uM = gl.getUniformLocation(prog, "u_m");
    const uBg = gl.getUniformLocation(prog, "u_bg");
    const uA1 = gl.getUniformLocation(prog, "u_a1");
    const uA2 = gl.getUniformLocation(prog, "u_a2");
    const uA3 = gl.getUniformLocation(prog, "u_a3");

    let colors = {
      bg: [0.95, 0.95, 0.96],
      a1: [0.42, 0.55, 0.95],
      a2: [0.6, 0.45, 0.95],
      a3: [0.35, 0.75, 0.95],
    };

    const readColors = () => {
      const accent = hexToRgb(cssVar("--accent") || "oklch(62% 0.195 253)");
      const bg = hexToRgb(cssVar("--background") || "#fff");
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      colors = {
        bg,
        a1: accent,
        a2: [accent[0] * 0.7 + 0.2, accent[1] * 0.5 + 0.1, accent[2] * 1.05].map((x) =>
          Math.min(1, Math.max(0, x)),
        ) as [number, number, number],
        a3: isDark
          ? [accent[0] * 0.4, accent[1] * 0.8, accent[2] * 1.1].map((x) => Math.min(1, x)) as [
              number,
              number,
              number,
            ]
          : [accent[0] * 1.1, accent[1] * 0.75, accent[2] * 1.0].map((x) => Math.min(1, x)) as [
              number,
              number,
              number,
            ],
      };
    };
    readColors();

    const obs = new MutationObserver(readColors);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = [
        (e.clientX - r.left) / r.width,
        1 - (e.clientY - r.top) / r.height,
      ];
    };
    window.addEventListener("mousemove", onMove);

    const start = performance.now();
    const render = () => {
      const t = (performance.now() - start) / 1000;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, t);
      gl.uniform2f(uM, mouseRef.current[0], mouseRef.current[1]);
      gl.uniform3f(uBg, colors.bg[0], colors.bg[1], colors.bg[2]);
      gl.uniform3f(uA1, colors.a1[0], colors.a1[1], colors.a1[2]);
      gl.uniform3f(uA2, colors.a2[0], colors.a2[1], colors.a2[2]);
      gl.uniform3f(uA3, colors.a3[0], colors.a3[1], colors.a3[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      ro.disconnect();
      obs.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
