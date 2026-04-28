"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@heroui/react";

function formatMediaTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type ChatVideoPlayerProps = {
  src: string;
  className?: string;
};

export function ChatVideoPlayer({ src, className }: ChatVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const seekingRef = useRef(false);

  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const syncTime = useCallback(() => {
    const v = videoRef.current;
    if (v && !seekingRef.current) setCurrent(v.currentTime);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => setDuration(v.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", syncTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    return () => {
      v.removeEventListener("timeupdate", syncTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
    };
  }, [src, syncTime]);

  const seekToRatio = useCallback((ratio: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const next = Math.min(Math.max(0, ratio), 1) * duration;
    v.currentTime = next;
    setCurrent(next);
  }, [duration]);

  const onBarPointer = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const x = clientX - rect.left;
      seekToRatio(x / rect.width);
    },
    [duration, seekToRatio],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!seekingRef.current) return;
      onBarPointer(e.clientX);
    };
    const onUp = () => {
      seekingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [onBarPointer]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFs = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }, []);

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group/v relative mt-1.5 max-h-56 w-full overflow-hidden rounded-lg bg-black ring-1 ring-[var(--border)]/40",
        isFs && "flex h-full min-h-0 w-full flex-col rounded-none bg-black",
        className,
      )}
    >
      <video
        ref={videoRef}
        src={src}
        className={cn(
          "block w-full object-contain",
          isFs ? "max-h-none min-h-0 flex-1" : "max-h-56",
        )}
        playsInline
        preload="metadata"
        muted={muted}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
      />

      {!playing && (
        <button
          type="button"
          className="absolute inset-0 z-[1] flex items-center justify-center bg-black/25 transition-colors hover:bg-black/35"
          aria-label="Play"
          onClick={(e) => {
            e.stopPropagation();
            void videoRef.current?.play();
          }}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-white/12 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.35)] backdrop-blur-xl backdrop-saturate-150 transition-[transform,background-color,box-shadow] hover:scale-105 hover:bg-white/18 hover:border-white/45">
            <Play className="ml-0.5 size-6 drop-shadow-sm" strokeWidth={2} aria-hidden />
          </span>
        </button>
      )}

      <div
        className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pb-2.5 pt-6 sm:px-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={barRef}
          className="relative mb-2 h-1.5 w-full cursor-pointer rounded-full bg-white/25"
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          onPointerDown={(e) => {
            seekingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            onBarPointer(e.clientX);
          }}
          onKeyDown={(e) => {
            if (!duration) return;
            const r = current / duration;
            if (e.key === "ArrowLeft") seekToRatio(Math.max(0, r - 0.05));
            if (e.key === "ArrowRight") seekToRatio(Math.min(1, r + 0.05));
          }}
        >
          <div
            className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${progress}%` }}
          />
          <div
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-foreground)] shadow ring-2 ring-[var(--accent)]"
            style={{ left: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/95 transition-colors hover:bg-white/15"
            aria-label={playing ? "Pause" : "Play"}
            onClick={togglePlay}
          >
            {playing ? <Pause className="size-4" strokeWidth={2} /> : <Play className="size-4" strokeWidth={2} />}
          </button>
          <span className="min-w-0 flex-1 tabular-nums text-[11px] text-white/85">
            {formatMediaTime(current)} / {formatMediaTime(duration)}
          </span>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/95 transition-colors hover:bg-white/15"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          >
            {muted ? <VolumeX className="size-4" strokeWidth={2} /> : <Volume2 className="size-4" strokeWidth={2} />}
          </button>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/95 transition-colors hover:bg-white/15"
            aria-label="Fullscreen"
            onClick={toggleFs}
          >
            <Maximize className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
