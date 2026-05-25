"use client";

import {
  GridLayout,
  ParticipantTile,
  VideoTrack,
  StartMediaButton,
  ConnectionStateToast,
  FocusLayoutContainer,
  CarouselLayout,
  LayoutContextProvider,
  ChatEntry,
  ChatToggle,
  useConnectionQualityIndicator,
  useCreateLayoutContext,
  useIsSpeaking,
  usePinnedTracks,
  useTracks,
  useTrackMutedIndicator,
  useLocalParticipant,
  useLocalParticipantPermissions,
  usePersistentUserChoices,
  useTrackToggle,
  useChat,
  useMaybeLayoutContext,
  useMaybeTrackRefContext,
  useParticipantInfo,
  useRoomContext,
  type MessageFormatter,
} from "@livekit/components-react";
import type {
  TrackReferenceOrPlaceholder,
  WidgetState,
  ChatMessage,
  ChatOptions,
} from "@livekit/components-core";
import { isEqualTrackRef, isTrackReference, isWeb, supportsScreenSharing } from "@livekit/components-core";
import {
  RoomEvent,
  Track,
  VideoPresets,
  type AudioCaptureOptions,
  type Room,
  type VideoCaptureOptions,
} from "livekit-client";
import "@livekit/components-styles";
import { Call02Icon } from "hugeicons-react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Video,
  VideoOff,
} from "lucide-react";
import { Button, ListBox, ListBoxItem, Select } from "@heroui/react";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/context";
import { useLiveMeeting } from "@/components/live-meeting-context";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

type RoomState = "loading" | "connected" | "error" | "left";

type ParticipantVisualState = {
  avatarUrl?: string;
};

const participantVisualCache = new Map<string, ParticipantVisualState>();
const participantVisualRequestCache = new Map<string, Promise<ParticipantVisualState>>();

function getParticipantDisplayName(name?: string | null, identity?: string | null): string {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;
  return identity ?? "";
}

function getParticipantInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getConnectionQualityLabel(
  quality: string | undefined,
  labels: {
    connecting: string;
    excellent: string;
    good: string;
    poor: string;
    unknown: string;
  },
): string {
  if (!quality) return labels.connecting;

  switch (quality) {
    case "excellent":
      return labels.excellent;
    case "good":
      return labels.good;
    case "poor":
      return labels.poor;
    case "unknown":
      return labels.unknown;
    default:
      return labels.connecting;
  }
}

function getConnectionQualityTone(quality?: string): {
  barsClassName: string;
  labelClassName: string;
} {
  switch (quality) {
    case "excellent":
      return {
        barsClassName: "bg-emerald-400",
        labelClassName: "text-emerald-300",
      };
    case "good":
      return {
        barsClassName: "bg-amber-400",
        labelClassName: "text-amber-300",
      };
    case "poor":
      return {
        barsClassName: "bg-red-400",
        labelClassName: "text-red-300",
      };
    default:
      return {
        barsClassName: "bg-white/30",
        labelClassName: "text-white/70",
      };
  }
}

const MEETING_NOISE_SUPPRESSION_STORAGE_KEY = "julow_meeting_noise_suppression";

function buildCameraCaptureOptions(deviceId?: string): VideoCaptureOptions {
  return {
    ...(deviceId ? { deviceId } : {}),
    resolution: VideoPresets.h720.resolution,
  };
}

function buildMicrophoneCaptureOptions(
  noiseSuppressionEnabled: boolean,
  deviceId?: string,
): AudioCaptureOptions {
  return {
    ...(deviceId ? { deviceId } : {}),
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: noiseSuppressionEnabled,
  };
}

type MediaDeviceErrorKind = "permission_denied" | "device_not_found" | "unavailable";

function getMediaDeviceErrorKind(error: Error): MediaDeviceErrorKind {
  const errorName = error.name.toLowerCase();
  const errorMessage = error.message.toLowerCase();

  if (
    errorName.includes("notallowed") ||
    errorName.includes("permissiondenied") ||
    errorName.includes("securityerror") ||
    errorMessage.includes("permission denied") ||
    errorMessage.includes("permissions check failed") ||
    errorMessage.includes("denied permission") ||
    errorMessage.includes("permission dismissed") ||
    errorMessage.includes("not allowed")
  ) {
    return "permission_denied";
  }

  if (
    errorName.includes("notfound") ||
    errorName.includes("devicesnotfound") ||
    errorName.includes("overconstrained") ||
    errorMessage.includes("device not found") ||
    errorMessage.includes("requested device not found") ||
    (errorMessage.includes("requested device") && errorMessage.includes("not found"))
  ) {
    return "device_not_found";
  }

  return "unavailable";
}

function getMediaDeviceErrorDescription(
  error: Error,
  copy: {
    permissionDenied: string;
    deviceNotFound: string;
    unavailable: string;
  },
): string {
  switch (getMediaDeviceErrorKind(error)) {
    case "permission_denied":
      return copy.permissionDenied;
    case "device_not_found":
      return copy.deviceNotFound;
    default:
      return copy.unavailable;
  }
}

/**
 * Permission-safe media devices enumerator. Unlike LiveKit's `useMediaDevices`
 * hook, this does NOT request `getUserMedia` on mount, which is critical:
 * browsers reject auto-fired permission requests outside of a user gesture and
 * may permanently cache that denial for the page session, after which no
 * subsequent permission prompt will appear.
 */
const VIRTUAL_DEVICE_IDS = new Set(["default", "communications"]);

function filterPreferredDevices(
  devices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
): MediaDeviceInfo[] {
  const matchingDevices = devices.filter((device) => device.kind === kind);
  const physicalDevices = matchingDevices.filter(
    (device) => !VIRTUAL_DEVICE_IDS.has(device.deviceId),
  );

  return physicalDevices.length > 0 ? physicalDevices : matchingDevices;
}

function useMediaDevicesSafe(kind: MediaDeviceKind): {
  devices: MediaDeviceInfo[];
  refresh: () => Promise<void>;
} {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refresh = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setDevices([]);
      return;
    }

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(filterPreferredDevices(all, kind));
    } catch {
      setDevices([]);
    }
  }, [kind]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return;
    }

    void refresh();

    const handler = () => void refresh();
    navigator.mediaDevices.addEventListener("devicechange", handler);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handler);
    };
  }, [refresh]);

  return { devices, refresh };
}

/**
 * Explicitly request browser permission for the requested media kind from a
 * direct user gesture. We use minimal constraints to maximize the chance the
 * browser shows a prompt rather than silently rejecting because of overly
 * specific defaults. The temporary tracks are stopped immediately to avoid
 * leaking the device.
 */
async function ensureMediaPermission(kind: "microphone" | "camera"): Promise<void> {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    const error = new Error(
      "getUserMedia requires a secure context (HTTPS or localhost).",
    );
    error.name = "SecurityError";
    throw error;
  }
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    const error = new Error("Media devices are not supported in this browser.");
    error.name = "NotSupportedError";
    throw error;
  }

  const constraints: MediaStreamConstraints =
    kind === "microphone" ? { audio: true } : { video: true };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  stream.getTracks().forEach((track) => track.stop());
}

type RestartableLocalTrack<TOptions> = {
  restartTrack: (options?: TOptions) => Promise<void>;
};

function hasRestartTrack<TOptions>(track: unknown): track is RestartableLocalTrack<TOptions> {
  return (
    typeof track === "object" &&
    track !== null &&
    "restartTrack" in track &&
    typeof (track as { restartTrack?: unknown }).restartTrack === "function"
  );
}

type TrackWithRTCStatsReport = {
  getRTCStatsReport: () => Promise<RTCStatsReport | undefined>;
};

function hasRTCStatsReport(track: unknown): track is TrackWithRTCStatsReport {
  return (
    typeof track === "object" &&
    track !== null &&
    "getRTCStatsReport" in track &&
    typeof (track as { getRTCStatsReport?: unknown }).getRTCStatsReport === "function"
  );
}

function getStatsTrack(trackRef: TrackReferenceOrPlaceholder): TrackWithRTCStatsReport | null {
  if (isTrackReference(trackRef) && hasRTCStatsReport(trackRef.publication.track)) {
    return trackRef.publication.track;
  }

  const fallbackPublication = trackRef.participant
    .getTrackPublications()
    .find((publication) => hasRTCStatsReport(publication.track));

  return fallbackPublication && hasRTCStatsReport(fallbackPublication.track)
    ? fallbackPublication.track
    : null;
}

function extractPingMs(statsReport?: RTCStatsReport): number | null {
  if (!statsReport) return null;

  let candidatePairPingMs: number | null = null;
  let remoteInboundPingMs: number | null = null;

  statsReport.forEach((stat) => {
    if (stat.type === "candidate-pair") {
      const candidatePair = stat as RTCStats & {
        nominated?: boolean;
        currentRoundTripTime?: number;
      };

      if (candidatePair.nominated && typeof candidatePair.currentRoundTripTime === "number") {
        candidatePairPingMs = Math.round(candidatePair.currentRoundTripTime * 1000);
      }
    }

    if (stat.type === "remote-inbound-rtp") {
      const remoteInbound = stat as RTCStats & {
        roundTripTime?: number;
      };

      if (typeof remoteInbound.roundTripTime === "number") {
        remoteInboundPingMs = Math.round(remoteInbound.roundTripTime * 1000);
      }
    }
  });

  return remoteInboundPingMs ?? candidatePairPingMs;
}

function getSignalPingMs(room: Room): number | null {
  const signalRtt = room.engine.client.rtt;

  if (!Number.isFinite(signalRtt) || signalRtt <= 0) {
    return null;
  }

  return Math.round(signalRtt);
}

function useParticipantPing(trackRef: TrackReferenceOrPlaceholder): number | null {
  const room = useRoomContext();
  const [pingMs, setPingMs] = useState<number | null>(null);
  const statsKey = isTrackReference(trackRef)
    ? `${trackRef.participant.identity}:${trackRef.source}:${trackRef.publication.trackSid}`
    : `${trackRef.participant.identity}:${trackRef.source}:placeholder`;

  useEffect(() => {
    let cancelled = false;

    const samplePing = async () => {
      const signalPingMs = getSignalPingMs(room);
      if (signalPingMs != null) {
        if (!cancelled) {
          setPingMs(signalPingMs);
        }
        return;
      }

      const statsTrack = getStatsTrack(trackRef);
      if (!statsTrack) {
        if (!cancelled) setPingMs(null);
        return;
      }

      try {
        const statsReport = await statsTrack.getRTCStatsReport();
        if (!cancelled) {
          setPingMs(extractPingMs(statsReport));
        }
      } catch {
        if (!cancelled) {
          setPingMs(null);
        }
      }
    };

    void samplePing();
    const intervalId = window.setInterval(() => {
      void samplePing();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [room, statsKey, trackRef]);

  return pingMs;
}

function ConnectionQualityBadge({
  quality,
  pingMs,
}: {
  quality?: string;
  pingMs: number | null;
}) {
  const { t } = useI18n();
  const m = t.meetings;
  const tone = getConnectionQualityTone(quality);
  const qualityLabel = getConnectionQualityLabel(quality, {
    connecting: m.roomConnecting,
    excellent: m.roomConnectionExcellent,
    good: m.roomConnectionGood,
    poor: m.roomConnectionPoor,
    unknown: m.roomConnectionUnknown,
  });
  const formattedPing = pingMs != null ? `${pingMs} ms` : m.roomPingUnavailable;

  return (
    <div className="group/connection relative inline-flex items-center gap-2">
      <span className="flex items-end gap-[3px]" aria-hidden>
        <span className={`h-2 w-1 rounded-full ${tone.barsClassName} opacity-60`} />
        <span className={`h-3.5 w-1 rounded-full ${tone.barsClassName} opacity-80`} />
        <span className={`h-5 w-1 rounded-full ${tone.barsClassName}`} />
      </span>
      <span className={`text-[11px] font-medium ${tone.labelClassName}`}>{qualityLabel}</span>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 min-w-[160px] -translate-x-1/2 translate-y-1 rounded-[16px] border border-white/10 bg-[rgba(8,13,26,0.92)] px-3 py-2 opacity-0 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.75)] backdrop-blur-md transition-all duration-200 group-hover/connection:translate-y-0 group-hover/connection:opacity-100">
        <div className="text-[11px] font-semibold text-white">
          {m.roomConnection}: {qualityLabel}
        </div>
        <div className="mt-1 text-[10px] text-white/70">
          {m.roomPing}: {formattedPing}
        </div>
      </div>
    </div>
  );
}

async function loadParticipantVisual(identity: string, isLocal: boolean): Promise<ParticipantVisualState> {
  const cached = participantVisualCache.get(identity);
  if (cached) return cached;

  const inFlight = participantVisualRequestCache.get(identity);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const profile = isLocal ? await api.getMyProfile() : await api.getPublicProfile(identity);
      const visual = { avatarUrl: profile.avatarUrl };
      participantVisualCache.set(identity, visual);
      return visual;
    } catch {
      const visual = {};
      participantVisualCache.set(identity, visual);
      return visual;
    } finally {
      participantVisualRequestCache.delete(identity);
    }
  })();

  participantVisualRequestCache.set(identity, request);
  return request;
}

function useParticipantVisual(identity?: string, isLocal = false) {
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(() =>
    identity ? participantVisualCache.get(identity)?.avatarUrl : undefined,
  );

  useEffect(() => {
    if (!identity) {
      setAvatarUrl(undefined);
      return;
    }

    const cached = participantVisualCache.get(identity);
    if (cached) {
      setAvatarUrl(cached.avatarUrl);
      return;
    }

    let cancelled = false;
    void loadParticipantVisual(identity, isLocal).then((visual) => {
      if (!cancelled) {
        setAvatarUrl(visual.avatarUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [identity, isLocal]);

  return avatarUrl;
}

/* ─── Translated Chat ────────────────────────────────────────── */

function TranslatedChat({
  messagesLabel,
  placeholderLabel,
  sendLabel,
  messageFormatter,
  messageDecoder,
  messageEncoder,
  channelTopic,
  style,
}: {
  messagesLabel: string;
  placeholderLabel: string;
  sendLabel: string;
  messageFormatter?: MessageFormatter;
  messageDecoder?: ChatOptions["messageDecoder"];
  messageEncoder?: ChatOptions["messageEncoder"];
  channelTopic?: string;
  style?: React.CSSProperties;
}) {
  const ulRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatOptions: ChatOptions = React.useMemo(
    () => ({ messageDecoder, messageEncoder, channelTopic }),
    [messageDecoder, messageEncoder, channelTopic],
  );
  const { chatMessages, send, isSending } = useChat(chatOptions);

  const layoutContext = useMaybeLayoutContext();
  const lastReadMsgAt = useRef<ChatMessage["timestamp"]>(0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inputRef.current && inputRef.current.value.trim() !== "") {
      await send(inputRef.current.value);
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  useEffect(() => {
    ulRef.current?.scrollTo({ top: ulRef.current.scrollHeight });
  }, [chatMessages]);

  useEffect(() => {
    if (!layoutContext || chatMessages.length === 0) return;
    if (
      layoutContext.widget.state?.showChat &&
      chatMessages.length > 0 &&
      lastReadMsgAt.current !== chatMessages[chatMessages.length - 1]?.timestamp
    ) {
      lastReadMsgAt.current = chatMessages[chatMessages.length - 1]?.timestamp;
      return;
    }
    const unreadMessageCount = chatMessages.filter(
      (msg) => !lastReadMsgAt.current || msg.timestamp > lastReadMsgAt.current,
    ).length;
    const { widget } = layoutContext;
    if (unreadMessageCount > 0 && widget.state?.unreadMessages !== unreadMessageCount) {
      widget.dispatch?.({ msg: "unread_msg", count: unreadMessageCount });
    }
  }, [chatMessages, layoutContext?.widget]);

  const chatClassName = [
    "lk-chat my-3 mr-3 grid h-[calc(100%-1.5rem)] min-h-0 w-[min(392px,38vw)] min-w-[336px] shrink-0 grid-rows-[auto,minmax(0,1fr),auto] overflow-hidden rounded-[30px] border border-(--border)/60 bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] text-(--foreground)",
    "shadow-[-24px_0_60px_-34px_rgba(15,23,42,0.18),0_24px_50px_-30px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:shadow-[-24px_0_60px_-34px_rgba(15,23,42,0.5),0_24px_50px_-30px_rgba(15,23,42,0.45)]",
    "max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-40 max-md:my-0 max-md:mr-0 max-md:h-[46vh]",
    "max-md:w-full max-md:max-w-none max-md:min-w-0 max-md:rounded-t-[28px] max-md:rounded-b-none",
    "[&_.lk-chat-header]:flex [&_.lk-chat-header]:items-center [&_.lk-chat-header]:justify-between",
    "[&_.lk-chat-header]:border-b [&_.lk-chat-header]:border-(--border)/40 [&_.lk-chat-header]:bg-[color-mix(in_oklch,var(--foreground)_3%,var(--surface))] [&_.lk-chat-header]:px-5",
    "[&_.lk-chat-header]:py-4 [&_.lk-chat-header]:text-sm [&_.lk-chat-header]:font-semibold [&_.lk-chat-header]:tracking-[0.01em]",
    "[&_.lk-chat-messages]:m-0 [&_.lk-chat-messages]:flex [&_.lk-chat-messages]:min-h-0",
    "[&_.lk-chat-messages]:list-none [&_.lk-chat-messages]:flex-col [&_.lk-chat-messages]:gap-2.5",
    "[&_.lk-chat-messages]:overflow-y-auto [&_.lk-chat-messages]:bg-[color-mix(in_oklch,var(--foreground)_2%,var(--surface))] [&_.lk-chat-messages]:px-3.5 [&_.lk-chat-messages]:py-4",
    "[&_.lk-chat-entry]:relative [&_.lk-chat-entry]:flex [&_.lk-chat-entry]:max-w-[82%] [&_.lk-chat-entry]:flex-col [&_.lk-chat-entry]:gap-1",
    "[&_.lk-chat-entry]:rounded-[18px] [&_.lk-chat-entry]:border [&_.lk-chat-entry]:px-3 [&_.lk-chat-entry]:py-2",
    "[&_.lk-chat-entry]:shadow-[0_12px_24px_-20px_rgba(15,23,42,0.25)]",
    "[&_.lk-chat-entry[data-lk-message-origin='remote']]:mr-auto [&_.lk-chat-entry[data-lk-message-origin='remote']]:rounded-bl-[8px]",
    "[&_.lk-chat-entry[data-lk-message-origin='remote']]:border-(--border)/60 [&_.lk-chat-entry[data-lk-message-origin='remote']]:bg-[color-mix(in_oklch,var(--surface-secondary)_82%,var(--surface))] [&_.lk-chat-entry[data-lk-message-origin='remote']]:text-(--foreground)",
    "[&_.lk-chat-entry[data-lk-message-origin='local']]:ml-auto [&_.lk-chat-entry[data-lk-message-origin='local']]:rounded-br-[8px]",
    "[&_.lk-chat-entry[data-lk-message-origin='local']]:border-accent/20 [&_.lk-chat-entry[data-lk-message-origin='local']]:bg-[linear-gradient(135deg,rgba(59,130,246,0.24),rgba(37,99,235,0.18))]",
    "[&_.lk-chat-entry[data-lk-message-origin='local']]:text-white",
    "[&_.lk-meta-data]:mb-0 [&_.lk-meta-data]:flex [&_.lk-meta-data]:items-center [&_.lk-meta-data]:justify-between",
    "[&_.lk-meta-data]:gap-2 [&_.lk-meta-data]:text-[10px] [&_.lk-meta-data]:text-muted [&_.lk-meta-data]:opacity-90",
    "[&_.lk-chat-entry[data-lk-message-origin='local']_.lk-meta-data]:text-white/70",
    "[&_.lk-participant-name]:truncate [&_.lk-participant-name]:text-[10px] [&_.lk-participant-name]:font-semibold [&_.lk-participant-name]:tracking-[0.01em]",
    "[&_.lk-chat-entry[data-lk-message-origin='local']_.lk-participant-name]:text-white",
    "[&_.lk-message-body]:block [&_.lk-message-body]:whitespace-pre-wrap [&_.lk-message-body]:break-words [&_.lk-message-body]:text-[13px] [&_.lk-message-body]:leading-5",
    "[&_.lk-message-attachements]:mt-1 [&_.lk-message-attachements]:flex [&_.lk-message-attachements]:flex-wrap [&_.lk-message-attachements]:gap-2",
    "[&_.lk-message-attachements_img]:overflow-hidden [&_.lk-message-attachements_img]:rounded-2xl [&_.lk-message-attachements_img]:border [&_.lk-message-attachements_img]:border-(--border)/50",
    "[&_.lk-chat-form]:grid [&_.lk-chat-form]:grid-cols-[minmax(0,1fr)_auto] [&_.lk-chat-form]:gap-2.5",
    "[&_.lk-chat-form]:border-t [&_.lk-chat-form]:border-(--border)/40 [&_.lk-chat-form]:bg-[color-mix(in_oklch,var(--foreground)_3%,var(--surface))] [&_.lk-chat-form]:p-4",
    "[&_.lk-chat-form-input]:h-11 [&_.lk-chat-form-input]:rounded-full [&_.lk-chat-form-input]:border",
    "[&_.lk-chat-form-input]:border-(--border)/65 [&_.lk-chat-form-input]:bg-[color-mix(in_oklch,var(--surface-secondary)_72%,var(--surface))]",
    "[&_.lk-chat-form-input]:px-4 [&_.lk-chat-form-input]:text-[13px] [&_.lk-chat-form-input]:outline-none",
    "[&_.lk-chat-form-input]:transition-colors [&_.lk-chat-form-input]:placeholder:text-muted/80",
    "[&_.lk-chat-form-input]:focus:border-accent/45 [&_.lk-chat-form-input]:focus:bg-[color-mix(in_oklch,var(--surface-secondary)_88%,var(--surface))]",
    "[&_.lk-chat-form-button]:h-12 [&_.lk-chat-form-button]:rounded-2xl [&_.lk-chat-form-button]:bg-accent",
    "[&_.lk-chat-form-button]:px-4.5 [&_.lk-chat-form-button]:text-sm [&_.lk-chat-form-button]:font-semibold",
    "[&_.lk-chat-form-button]:text-white [&_.lk-chat-form-button]:shadow-[0_18px_36px_-20px_rgba(59,130,246,0.75)] [&_.lk-chat-form-button]:transition-all",
    "hover:[&_.lk-chat-form-button]:-translate-y-0.5 hover:[&_.lk-chat-form-button]:bg-accent/90",
    "[&_.lk-close-button]:flex [&_.lk-close-button]:size-8 [&_.lk-close-button]:items-center",
    "[&_.lk-close-button]:justify-center [&_.lk-close-button]:rounded-full [&_.lk-close-button]:text-muted",
    "hover:[&_.lk-close-button]:bg-surface-secondary/80 hover:[&_.lk-close-button]:text-(--foreground)",
  ].join(" ");

  return (
    <div
      className={chatClassName}
      style={style}
    >
      <div className="lk-chat-header">
        {messagesLabel}
        {layoutContext && (
          <ChatToggle className="lk-close-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
              <path
                fill="currentColor"
                d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"
              />
            </svg>
          </ChatToggle>
        )}
      </div>

      <ul className="lk-list lk-chat-messages" ref={ulRef}>
        {chatMessages.map((msg, idx, allMsg) => {
          const hideName = idx >= 1 && allMsg[idx - 1].from === msg.from;
          const hideTimestamp = idx >= 1 && msg.timestamp - allMsg[idx - 1].timestamp < 60_000;
          return (
            <ChatEntry
              key={msg.id ?? idx}
              hideName={hideName}
              hideTimestamp={hideName === false ? false : hideTimestamp}
              entry={msg}
              messageFormatter={messageFormatter}
            />
          );
        })}
      </ul>
      <form className="lk-chat-form" onSubmit={handleSubmit}>
        <input
          className="lk-form-control lk-chat-form-input"
          disabled={isSending}
          ref={inputRef}
          type="text"
          placeholder={placeholderLabel}
          onInput={(ev) => ev.stopPropagation()}
          onKeyDown={(ev) => ev.stopPropagation()}
          onKeyUp={(ev) => ev.stopPropagation()}
        />
        <button type="submit" className="lk-button lk-chat-form-button" disabled={isSending}>
          {sendLabel}
        </button>
      </form>
    </div>
  );
}

/* ─── Translated Control Bar ─────────────────────────────────── */

type DeviceOption = {
  deviceId: string;
  label: string;
};

function getDeviceLabel(device: MediaDeviceInfo, fallback: string, index: number): string {
  const label = device.label?.trim();
  if (label) return label;
  return `${fallback} ${index + 1}`;
}

function DeviceSelect({
  value,
  devices,
  placeholder,
  disabled,
  onChange,
  footer,
  onOpenChange,
}: {
  value: string;
  devices: DeviceOption[];
  placeholder: string;
  disabled: boolean;
  onChange: (deviceId: string) => void;
  footer?: React.ReactNode;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const currentKey = value || undefined;

  return (
    <Select
      selectedKey={currentKey}
      onOpenChange={onOpenChange}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
      isDisabled={disabled}
      className="w-11 shrink-0"
    >
      <Select.Trigger className="flex h-11 w-11 items-center justify-center rounded-full border border-(--border)/60 bg-surface-secondary px-0 text-muted transition-colors hover:bg-surface-tertiary data-[pressed]:scale-[0.98] disabled:opacity-50">
        <ChevronDown className="size-4" />
      </Select.Trigger>
      <Select.Popover className="z-50 min-w-[240px] max-w-[320px] rounded-2xl border border-(--border)/70 bg-surface p-1 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]">
        <ListBox className="max-h-64 overflow-auto outline-none">
          {devices.map((device) => (
            <ListBoxItem
              key={device.deviceId}
              id={device.deviceId}
              textValue={device.label}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-(--foreground) outline-none hover:bg-surface-secondary data-[selected]:bg-accent/10 data-[selected]:text-accent"
            >
              {device.label}
            </ListBoxItem>
          ))}
          {devices.length === 0 && (
            <ListBoxItem
              key="no-devices"
              id="no-devices"
              textValue={placeholder}
              isDisabled
              className="rounded-xl px-3 py-2 text-sm text-muted"
            >
              {placeholder}
            </ListBoxItem>
          )}
        </ListBox>
        {footer ? (
          <div className="mt-1 border-t border-(--border)/60 px-1 pt-1">{footer}</div>
        ) : null}
      </Select.Popover>
    </Select>
  );
}

function RoomControlButton({
  label,
  icon,
  tone = "neutral",
  showText,
  badge,
  pressed,
  onPress,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  tone?: "neutral" | "accent" | "danger";
  showText: boolean;
  badge?: number;
  pressed?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const toneClass =
    tone === "accent"
      ? "border-accent/30 bg-accent text-white hover:bg-accent/90"
      : tone === "danger"
        ? "border-red-500/20 bg-red-500 text-white hover:bg-red-600"
        : "border-[var(--border)]/60 bg-[var(--surface-secondary)] text-[var(--foreground)] hover:bg-[var(--surface-tertiary)]";

  return (
    <Button
      variant="secondary"
      size="sm"
      isIconOnly={!showText}
      onPress={onPress}
      isDisabled={disabled}
      aria-pressed={pressed}
      className={`relative h-11 ${showText ? "min-w-[132px] px-4" : "w-11 min-w-11 px-0"} rounded-full border shadow-none transition-all hover:-translate-y-0.5 disabled:opacity-60 ${toneClass}`}
    >
      <span className={`flex items-center ${showText ? "gap-2" : ""}`}>
        {icon}
        {showText ? <span className="text-sm font-medium">{label}</span> : null}
      </span>
      {badge && badge > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white shadow-lg">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Button>
  );
}

function MeetingParticipantTileContent({
  trackRef,
  focus = false,
  compact = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  focus?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const m = t.meetings;
  const participant = trackRef.participant;
  const { identity, name } = useParticipantInfo({ participant });
  const isSpeaking = useIsSpeaking(participant);
  const { quality } = useConnectionQualityIndicator({ participant });
  const microphoneTrackRef = React.useMemo<TrackReferenceOrPlaceholder>(
    () => ({
      participant,
      source: Track.Source.Microphone,
      publication: participant.getTrackPublication(Track.Source.Microphone),
    }),
    [participant],
  );
  const { isMuted: isMicrophoneMuted } = useTrackMutedIndicator(microphoneTrackRef);
  const avatarUrl = useParticipantVisual(identity, participant.isLocal);
  const displayName = getParticipantDisplayName(name, identity) || m.roomParticipant;
  const initials = getParticipantInitials(displayName);
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const videoTrackRef = isTrackReference(trackRef) ? trackRef : undefined;
  const pingMs = useParticipantPing(trackRef);
  const isCompactTile = compact && !focus;

  return (
    <div
      className={`${focus ? "lk-focused-participant min-h-0 h-full w-full" : "h-full w-full"} group/meetingtile overflow-hidden rounded-[28px] border bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] backdrop-blur-sm transition-[border-color,box-shadow] duration-300 ${
        isSpeaking
          ? "border-emerald-400/70 shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_28px_80px_-38px_rgba(16,185,129,0.55)]"
          : "border-[var(--border)]/60 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.35)]"
      }`}
    >
      <ParticipantTile
        trackRef={trackRef}
        disableSpeakingIndicator
        className="h-full w-full overflow-hidden rounded-[28px] border-0 bg-transparent [&_.lk-focus-toggle]:hidden"
      >
        <>
          {videoTrackRef ? (
            <VideoTrack
              trackRef={videoTrackRef}
              className={`h-full w-full ${
                isScreenShare ? "object-contain bg-[rgba(2,6,23,0.96)]" : "object-cover"
              }`}
            />
          ) : null}
          {!isScreenShare ? (
            <div
              className={`absolute inset-0 ${
                videoTrackRef
                  ? "bg-linear-to-t from-black/70 via-black/10 to-black/20"
                  : "bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.35),rgba(15,23,42,0.96)_70%)]"
              }`}
            />
          ) : null}
          {!videoTrackRef ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div
                className={`flex size-28 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-3xl font-semibold uppercase tracking-wide text-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.6)] ${
                  isSpeaking ? "ring-4 ring-emerald-400/70" : ""
                }`}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
            </div>
          ) : null}
          {isScreenShare ? (
            <div className="pointer-events-none absolute left-3 top-3 z-10 translate-y-1 opacity-0 transition-all duration-200 group-hover/meetingtile:translate-y-0 group-hover/meetingtile:opacity-100">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(8,13,26,0.72)] px-2.5 py-1.5 text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.7)] backdrop-blur-md">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-[11px] font-semibold uppercase tracking-wide text-white ${
                    isSpeaking ? "ring-2 ring-emerald-400/80 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" : ""
                  }`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <span className="max-w-[180px] truncate text-xs font-medium text-white/85">
                  {displayName}
                </span>
              </div>
            </div>
          ) : (
            isCompactTile ? (
              <>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/85 via-black/40 to-transparent" />
                <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-[16px] border border-white/10 bg-[rgba(15,23,42,0.6)] px-2.5 py-1.5 text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.7)] backdrop-blur-md">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-white">{displayName}</div>
                  </div>
                  {isMicrophoneMuted ? <MicOff className="size-3.5 shrink-0 text-red-300" /> : null}
                </div>
              </>
            ) : (
              <>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-black/80 via-black/45 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[20px] border border-white/10 bg-[rgba(15,23,42,0.58)] px-3 py-2.5 text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.65)] backdrop-blur-md">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-sm font-semibold uppercase tracking-wide text-white ${
                      isSpeaking ? "ring-2 ring-emerald-400/80 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" : ""
                    }`}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                      {participant.isLocal ? (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-white">
                          {m.roomYou}
                        </span>
                      ) : null}
                      <ConnectionQualityBadge quality={quality} pingMs={pingMs} />
                    </div>
                  </div>
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      isMicrophoneMuted
                        ? "bg-red-500/15 text-red-300"
                        : isSpeaking
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/10 text-white/70"
                    }`}
                  >
                    {isMicrophoneMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </div>
                </div>
              </>
            )
          )}
        </>
      </ParticipantTile>
    </div>
  );
}

function MeetingParticipantTile({
  trackRef,
  focus = false,
  compact = false,
}: {
  trackRef?: TrackReferenceOrPlaceholder;
  focus?: boolean;
  compact?: boolean;
}) {
  const contextualTrackRef = useMaybeTrackRefContext();
  const resolvedTrackRef = trackRef ?? contextualTrackRef;

  return resolvedTrackRef ? (
    <MeetingParticipantTileContent trackRef={resolvedTrackRef} focus={focus} compact={compact} />
  ) : null;
}

function TranslatedControlBar({
  micLabel,
  camLabel,
  noiseSuppressionLabel,
  shareLabel,
  stopShareLabel,
  chatLabel,
  leaveLabel,
  startMediaLabel,
  controls,
  onLeave,
}: {
  micLabel: string;
  camLabel: string;
  noiseSuppressionLabel: string;
  shareLabel: string;
  stopShareLabel: string;
  chatLabel: string;
  leaveLabel: string;
  startMediaLabel: string;
  controls?: { chat?: boolean };
  onLeave?: () => void;
}) {
  const visibleControls = {
    microphone: true,
    camera: true,
    chat: false,
    screenShare: true,
    leave: true,
    ...controls,
  };

  const localPermissions = useLocalParticipantPermissions();
  const room = useRoomContext();
  const {
    localParticipant,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const { devices: audioDevices, refresh: refreshAudioDevices } = useMediaDevicesSafe("audioinput");
  const { devices: videoDevices, refresh: refreshVideoDevices } = useMediaDevicesSafe("videoinput");
  const layoutContext = useMaybeLayoutContext();

  if (!localPermissions) {
    visibleControls.camera = false;
    visibleControls.microphone = false;
    visibleControls.screenShare = false;
    visibleControls.chat = false;
  } else {
    visibleControls.camera ??= localPermissions.canPublish;
    visibleControls.microphone ??= localPermissions.canPublish;
    visibleControls.screenShare ??= localPermissions.canPublish;
    visibleControls.chat ??= localPermissions.canPublishData && (controls?.chat ?? false);
  }

  const isTooSmall = useMediaQueryInternal("(max-width: 820px)");
  const showText = !isTooSmall;
  const browserSupportsScreenSharing = supportsScreenSharing();
  const { t } = useI18n();
  const meetingCopy = t.meetings;
  const isChatOpen = Boolean(layoutContext?.widget.state?.showChat);
  const unreadMessages = layoutContext?.widget.state?.unreadMessages ?? 0;
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(MEETING_NOISE_SUPPRESSION_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: false });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        MEETING_NOISE_SUPPRESSION_STORAGE_KEY,
        noiseSuppressionEnabled ? "true" : "false",
      );
    }
  }, [noiseSuppressionEnabled]);

  const microphoneCaptureOptions = React.useMemo(
    () => buildMicrophoneCaptureOptions(noiseSuppressionEnabled, audioDeviceId || undefined),
    [audioDeviceId, noiseSuppressionEnabled],
  );

  const cameraCaptureOptions = React.useMemo(
    () => buildCameraCaptureOptions(videoDeviceId || undefined),
    [videoDeviceId],
  );

  const audioOptions = React.useMemo<DeviceOption[]>(() => {
    return audioDevices.map((device, index) => ({
      deviceId: device.deviceId,
      label: getDeviceLabel(device, micLabel, index),
    }));
  }, [audioDevices, micLabel]);

  const videoOptions = React.useMemo<DeviceOption[]>(() => {
    return videoDevices.map((device, index) => ({
      deviceId: device.deviceId,
      label: getDeviceLabel(device, camLabel, index),
    }));
  }, [camLabel, videoDevices]);

  useEffect(() => {
    const syncActiveDevices = () => {
      setAudioDeviceId(room.getActiveDevice("audioinput") ?? "");
      setVideoDeviceId(room.getActiveDevice("videoinput") ?? "");
    };

    syncActiveDevices();

    const handleActiveDeviceChange = (kind: MediaDeviceKind, deviceId: string) => {
      if (kind === "audioinput") setAudioDeviceId(deviceId);
      if (kind === "videoinput") setVideoDeviceId(deviceId);
    };

    room.on(RoomEvent.ActiveDeviceChanged, handleActiveDeviceChange);
    return () => {
      room.off(RoomEvent.ActiveDeviceChanged, handleActiveDeviceChange);
    };
  }, [audioOptions, room, videoOptions]);

  const handleDeviceError = useCallback((
    title: string,
    kind: "audioinput" | "videoinput",
    error: Error,
  ) => {
    const errorKind = getMediaDeviceErrorKind(error);

    if (errorKind === "device_not_found") {
      if (kind === "audioinput") {
        setAudioDeviceId("");
        saveAudioInputDeviceId("");
      } else {
        setVideoDeviceId("");
        saveVideoInputDeviceId("");
      }

      void room.switchActiveDevice(kind, "default", false).catch(() => undefined);
    }

    toast.error(title, {
      description: getMediaDeviceErrorDescription(error, {
        permissionDenied: meetingCopy.roomMediaPermissionDenied,
        deviceNotFound: meetingCopy.roomMediaDeviceNotFound,
        unavailable: meetingCopy.roomMediaUnavailable,
      }),
    });
  }, [
    meetingCopy.roomMediaDeviceNotFound,
    meetingCopy.roomMediaPermissionDenied,
    meetingCopy.roomMediaUnavailable,
    room,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  ]);

  const microphoneOnChange = useCallback(
    (enabled: boolean, isUserInitiated: boolean) => {
      if (isUserInitiated) {
        saveAudioInputEnabled(enabled);
      }
    },
    [saveAudioInputEnabled],
  );

  const cameraOnChange = useCallback(
    (enabled: boolean, isUserInitiated: boolean) => {
      if (isUserInitiated) {
        saveVideoInputEnabled(enabled);
      }
    },
    [saveVideoInputEnabled],
  );

  const microphoneToggle = useTrackToggle({
    source: Track.Source.Microphone,
    captureOptions: microphoneCaptureOptions,
    onChange: microphoneOnChange,
    onDeviceError: (error) => handleDeviceError(micLabel, "audioinput", error),
  });

  const cameraToggle = useTrackToggle({
    source: Track.Source.Camera,
    captureOptions: cameraCaptureOptions,
    onChange: cameraOnChange,
    onDeviceError: (error) => handleDeviceError(camLabel, "videoinput", error),
  });

  const handleAudioDeviceMenuOpenChange = useCallback(async (isOpen: boolean) => {
    if (!isOpen) return;

    const hasPhysicalDevices = audioDevices.some(
      (device) => !VIRTUAL_DEVICE_IDS.has(device.deviceId) && device.label.trim().length > 0,
    );
    if (hasPhysicalDevices) return;

    try {
      await ensureMediaPermission("microphone");
      await refreshAudioDevices();
    } catch (error) {
      handleDeviceError(
        micLabel,
        "audioinput",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }, [audioDevices, handleDeviceError, micLabel, refreshAudioDevices]);

  const handleVideoDeviceMenuOpenChange = useCallback(async (isOpen: boolean) => {
    if (!isOpen) return;

    const hasPhysicalDevices = videoDevices.some(
      (device) => !VIRTUAL_DEVICE_IDS.has(device.deviceId) && device.label.trim().length > 0,
    );
    if (hasPhysicalDevices) return;

    try {
      await ensureMediaPermission("camera");
      await refreshVideoDevices();
    } catch (error) {
      handleDeviceError(
        camLabel,
        "videoinput",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }, [camLabel, handleDeviceError, refreshVideoDevices, videoDevices]);

  const handleMicrophoneToggle = useCallback(async () => {
    const willEnable = !microphoneToggle.enabled;
    const hasExistingTrack = Boolean(
      localParticipant.getTrackPublication(Track.Source.Microphone),
    );

    if (willEnable && !hasExistingTrack) {
      try {
        await ensureMediaPermission("microphone");
        await refreshAudioDevices();
      } catch (error) {
        handleDeviceError(
          micLabel,
          "audioinput",
          error instanceof Error ? error : new Error(String(error)),
        );
        return;
      }
    }

    await microphoneToggle.toggle();
  }, [handleDeviceError, localParticipant, micLabel, microphoneToggle, refreshAudioDevices]);

  const handleCameraToggle = useCallback(async () => {
    const willEnable = !cameraToggle.enabled;
    const hasExistingTrack = Boolean(
      localParticipant.getTrackPublication(Track.Source.Camera),
    );

    if (willEnable && !hasExistingTrack) {
      try {
        await ensureMediaPermission("camera");
        await refreshVideoDevices();
      } catch (error) {
        handleDeviceError(
          camLabel,
          "videoinput",
          error instanceof Error ? error : new Error(String(error)),
        );
        return;
      }
    }

    await cameraToggle.toggle();
  }, [camLabel, cameraToggle, handleDeviceError, localParticipant, refreshVideoDevices]);

  const handleNoiseSuppressionChange = useCallback(async (checked: boolean) => {
    setNoiseSuppressionEnabled(checked);

    const activeAudioDeviceId = audioDeviceId || room.getActiveDevice("audioinput") || undefined;
    const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone)?.track;

    if (!microphoneToggle.enabled || !audioTrack || !hasRestartTrack<AudioCaptureOptions>(audioTrack)) {
      return;
    }

    try {
      await audioTrack.restartTrack(buildMicrophoneCaptureOptions(checked, activeAudioDeviceId));
    } catch {
      toast.error(noiseSuppressionLabel, {
        description: meetingCopy.roomNoiseSuppressionFailed,
      });
    }
  }, [
    audioDeviceId,
    localParticipant,
    meetingCopy.roomNoiseSuppressionFailed,
    microphoneToggle.enabled,
    noiseSuppressionLabel,
    room,
  ]);

  const handleScreenShareToggle = useCallback(async () => {
    try {
      await localParticipant.setScreenShareEnabled(
        !isScreenShareEnabled,
        !isScreenShareEnabled ? { audio: true, selfBrowserSurface: "include" } : undefined,
      );
    } catch {
      return;
    }
  }, [isScreenShareEnabled, localParticipant]);

  const handleChatToggle = useCallback(() => {
    layoutContext?.widget.dispatch?.({ msg: "toggle_chat" });
  }, [layoutContext]);

  const handleAudioDeviceChange = useCallback(async (deviceId: string) => {
    setAudioDeviceId(deviceId);
    saveAudioInputDeviceId(deviceId);
    try {
      await room.switchActiveDevice("audioinput", deviceId);
    } catch (error) {
      handleDeviceError(
        micLabel,
        "audioinput",
        error instanceof Error ? error : new Error(String(error)),
      );
      setAudioDeviceId(room.getActiveDevice("audioinput") ?? "");
    }
  }, [handleDeviceError, micLabel, room, saveAudioInputDeviceId]);

  const handleVideoDeviceChange = useCallback(async (deviceId: string) => {
    setVideoDeviceId(deviceId);
    saveVideoInputDeviceId(deviceId);
    try {
      await room.switchActiveDevice("videoinput", deviceId);
    } catch (error) {
      handleDeviceError(
        camLabel,
        "videoinput",
        error instanceof Error ? error : new Error(String(error)),
      );
      setVideoDeviceId(room.getActiveDevice("videoinput") ?? "");
    }
  }, [camLabel, handleDeviceError, room, saveVideoInputDeviceId]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 px-4 pb-4 pt-3">
      {visibleControls.microphone && (
        <div className="flex items-center gap-1 rounded-full border border-(--border)/65 bg-[color-mix(in_oklch,var(--surface)_90%,transparent)] p-1 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.45)] backdrop-blur-xl">
          <RoomControlButton
            label={micLabel}
            icon={microphoneToggle.enabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            tone={microphoneToggle.enabled ? "neutral" : "danger"}
            showText={showText}
            pressed={microphoneToggle.enabled}
            disabled={microphoneToggle.pending}
            onPress={() => void handleMicrophoneToggle()}
          />
          <DeviceSelect
            value={audioDeviceId}
            devices={audioOptions}
            placeholder={micLabel}
            disabled={!visibleControls.microphone}
            onChange={(deviceId) => void handleAudioDeviceChange(deviceId)}
            onOpenChange={(isOpen) => void handleAudioDeviceMenuOpenChange(isOpen)}
            footer={
              <div
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <span className="text-sm font-medium text-(--foreground)">{noiseSuppressionLabel}</span>
                <Switch
                  checked={noiseSuppressionEnabled}
                  onCheckedChange={(checked) => void handleNoiseSuppressionChange(checked)}
                  aria-label={noiseSuppressionLabel}
                />
              </div>
            }
          />
        </div>
      )}
      {visibleControls.camera && (
        <div className="flex items-center gap-1 rounded-full border border-(--border)/65 bg-[color-mix(in_oklch,var(--surface)_90%,transparent)] p-1 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.45)] backdrop-blur-xl">
          <RoomControlButton
            label={camLabel}
            icon={cameraToggle.enabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
            tone={cameraToggle.enabled ? "neutral" : "danger"}
            showText={showText}
            pressed={cameraToggle.enabled}
            disabled={cameraToggle.pending}
            onPress={() => void handleCameraToggle()}
          />
          <DeviceSelect
            value={videoDeviceId}
            devices={videoOptions}
            placeholder={camLabel}
            disabled={!visibleControls.camera}
            onChange={(deviceId) => void handleVideoDeviceChange(deviceId)}
            onOpenChange={(isOpen) => void handleVideoDeviceMenuOpenChange(isOpen)}
          />
        </div>
      )}
      {visibleControls.screenShare && browserSupportsScreenSharing && (
        <RoomControlButton
          label={isScreenShareEnabled ? stopShareLabel : shareLabel}
          icon={isScreenShareEnabled ? <ScreenShareOff className="size-4" /> : <ScreenShare className="size-4" />}
          tone={isScreenShareEnabled ? "accent" : "neutral"}
          showText={showText}
          pressed={isScreenShareEnabled}
          onPress={() => void handleScreenShareToggle()}
        />
      )}
      {visibleControls.chat && (
        <RoomControlButton
          label={chatLabel}
          icon={<MessageSquare className="size-4" />}
          tone={isChatOpen ? "accent" : "neutral"}
          showText={showText}
          badge={!isChatOpen ? unreadMessages : undefined}
          pressed={isChatOpen}
          onPress={handleChatToggle}
        />
      )}
      {visibleControls.leave && (
        <RoomControlButton
          label={leaveLabel}
          icon={<PhoneOff className="size-4" />}
          tone="danger"
          showText={showText}
          onPress={onLeave}
        />
      )}
      <StartMediaButton
        label={startMediaLabel}
        className="h-11 rounded-full border border-accent/15 bg-accent px-4 text-sm font-semibold text-white shadow-[0_18px_36px_-22px_rgba(79,70,229,0.75)] transition-transform hover:-translate-y-0.5 hover:bg-accent/90"
      />
    </div>
  );
}

function useMediaQueryInternal(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

/* ─── Translated VideoConference ─────────────────────────────── */

function TranslatedVideoConference({
  m,
  onLeave,
}: {
  m: {
    roomMicrophone: string;
    roomCamera: string;
    roomNoiseSuppression: string;
    roomShareScreen: string;
    roomStopShareScreen: string;
    roomChat: string;
    roomLeave: string;
    roomStartMedia: string;
    roomMessages: string;
    roomMessagePlaceholder: string;
    roomSend: string;
  };
  onLeave?: () => void;
}) {
  const [widgetState, setWidgetState] = useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack = useRef<TrackReferenceOrPlaceholder | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  const widgetUpdate = (state: WidgetState) => setWidgetState(state);
  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);
  const isCompactFocusLayout = useMediaQueryInternal("(max-width: 960px)");

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));
  const isFocusedScreenShare = Boolean(focusTrack && focusTrack.source === Track.Source.ScreenShare);

  useEffect(() => {
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      layoutContext.pin.dispatch?.({ msg: "set_pin", trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      layoutContext.pin.dispatch?.({ msg: "clear_pin" });
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (tr) =>
          tr.participant.identity === focusTrack.participant.identity &&
          tr.source === focusTrack.source,
      );
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        layoutContext.pin.dispatch?.({ msg: "set_pin", trackReference: updatedFocusTrack });
      }
    }
  }, [
    screenShareTracks
      .map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
      .join(),
    focusTrack?.publication?.trackSid,
    tracks,
  ]);

  return (
    <div className="lk-video-conference">
      {isWeb() && (
        <LayoutContextProvider value={layoutContext} onWidgetChange={widgetUpdate}>
          <div className="lk-video-conference-inner">
            {!focusTrack ? (
              <div className="lk-grid-layout-wrapper">
                <GridLayout tracks={tracks}>
                  <MeetingParticipantTile />
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper">
                <FocusLayoutContainer
                  className="min-h-0"
                  style={
                    isCompactFocusLayout
                      ? {
                          gridTemplateColumns: "minmax(0,1fr)",
                          gridTemplateRows: "auto minmax(0,1fr)",
                        }
                      : isFocusedScreenShare
                        ? { gridTemplateColumns: "minmax(148px,148px) minmax(0,1fr)" }
                        : { gridTemplateColumns: "minmax(220px,280px) minmax(0,1fr)" }
                  }
                >
                  <CarouselLayout
                    tracks={carouselTracks}
                    orientation={isCompactFocusLayout ? "horizontal" : "vertical"}
                    className={`min-h-0 max-h-full ${
                      isFocusedScreenShare
                        ? isCompactFocusLayout
                          ? "*:h-[112px]! *:w-[112px]! *:aspect-square! *:flex-none!"
                          : "w-[148px] min-w-[148px] max-w-[148px] overflow-y-auto overflow-x-hidden pr-1 *:h-[128px]! *:w-[128px]! *:aspect-square! *:flex-none! *:mx-auto"
                        : ""
                    }`}
                  >
                    <MeetingParticipantTile compact={isFocusedScreenShare} />
                  </CarouselLayout>
                  {focusTrack && <MeetingParticipantTile trackRef={focusTrack} focus />}
                </FocusLayoutContainer>
              </div>
            )}
            <TranslatedControlBar
              micLabel={m.roomMicrophone}
              camLabel={m.roomCamera}
              noiseSuppressionLabel={m.roomNoiseSuppression}
              shareLabel={m.roomShareScreen}
              stopShareLabel={m.roomStopShareScreen}
              chatLabel={m.roomChat}
              leaveLabel={m.roomLeave}
              startMediaLabel={m.roomStartMedia}
              controls={{ chat: true }}
              onLeave={onLeave}
            />
          </div>
          <TranslatedChat
            messagesLabel={m.roomMessages}
            placeholderLabel={m.roomMessagePlaceholder}
            sendLabel={m.roomSend}
            style={{ display: widgetState.showChat ? "grid" : "none" }}
          />
        </LayoutContextProvider>
      )}
    </div>
  );
}

/* ─── Leave Confirmation Dialog ───────────────────────────────── */

function LeaveConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  labels,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  labels: { title: string; desc: string; cancel: string; confirm: string };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.desc}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="secondary" size="sm">{labels.cancel}</Button>
          </DialogClose>
          <Button
            variant="primary"
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white"
            onPress={onConfirm}
          >
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page Component ────────────────────────────────────── */

export function MeetingRoomPage({ meetingId }: { meetingId: string }) {
  const { t } = useI18n();
  const m = t.meetings;
  const router = useRouter();
  const liveMeeting = useLiveMeeting();
  const [state, setState] = useState<RoomState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [ending, setEnding] = useState(false);
  const leavingRef = useRef(false);

  const fetchToken = useCallback(async () => {
    if (leavingRef.current || liveMeeting.justLeft) return;
    setState("loading");
    setError(null);
    try {
      const result = await liveMeeting.join(meetingId);
      if (leavingRef.current || liveMeeting.justLeft) return;
      if (result) {
        setState("connected");
      } else {
        setState("error");
        setError(m.roomError);
      }
    } catch (err) {
      if (leavingRef.current || liveMeeting.justLeft) return;
      setState("error");
      setError(err instanceof Error ? err.message : m.roomError);
    }
  }, [meetingId, m.roomError, liveMeeting, liveMeeting.justLeft]);

  useEffect(() => {
    if (leavingRef.current || liveMeeting.justLeft) return;
    void fetchToken();
  }, [fetchToken, liveMeeting.justLeft]);

  // Detect whether current user is the organizer of this meeting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, meeting] = await Promise.all([
          api.getMe(),
          api.getMeeting(meetingId),
        ]);
        if (cancelled) return;
        setIsOrganizer(me.id === meeting.organizerId);
      } catch {
        /* ignore — non-critical */
      }
    })();
    return () => { cancelled = true; };
  }, [meetingId]);

  const goBack = useCallback(() => {
    router.push("/meetings");
  }, [router]);

  const handleLeaveRequest = useCallback(() => {
    setLeaveDialogOpen(true);
  }, []);

  const handleLeaveConfirm = useCallback(() => {
    setLeaveDialogOpen(false);
    leavingRef.current = true;
    liveMeeting.leave();
    router.push("/meetings");
  }, [liveMeeting, router]);

  const handleEndRequest = useCallback(() => {
    setEndDialogOpen(true);
  }, []);

  const handleEndConfirm = useCallback(async () => {
    setEnding(true);
    try {
      await api.completeMeeting(meetingId);
      toast.success(m.roomEndedTitle, {
        description: m.roomEndedForEveryone,
        id: `meeting-ended-${meetingId}`,
      });
      setEndDialogOpen(false);
      leavingRef.current = true;
      liveMeeting.leave();
      router.push("/meetings");
    } catch (err) {
      toast.error(m.endMeeting, {
        description: err instanceof Error ? err.message : m.roomError,
      });
    } finally {
      setEnding(false);
    }
  }, [meetingId, liveMeeting, m.endMeeting, m.roomEndedForEveryone, m.roomEndedTitle, m.roomError, router]);

  const leaveLabels = {
    title: m.roomLeave,
    desc: m.leaveConfirmDesc,
    cancel: m.leaveCancel,
    confirm: m.roomLeave,
  };

  // ── Loading state ──
  if (state === "loading") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
        <Loader2 className="size-8 animate-spin text-accent" />
        <p className="text-sm text-muted">{m.roomLoading}</p>
      </div>
    );
  }

  // ── Error state ──
  if (state === "error") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
          <AlertCircle className="size-8 text-red-500" />
        </div>
        <p className="max-w-sm text-center text-sm text-muted">{error ?? m.roomError}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onPress={goBack}>
            <ArrowLeft className="size-4" />
            {m.roomBackToList}
          </Button>
          <Button variant="primary" size="sm" onPress={() => void fetchToken()}>
            {m.roomRetry}
          </Button>
        </div>
      </div>
    );
  }

  // ── Left state ──
  if (state === "left") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-secondary">
          <PhoneOff className="size-8 text-muted" />
        </div>
        <p className="text-sm font-medium">{m.roomLeft}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onPress={goBack}>
            <ArrowLeft className="size-4" />
            {m.roomBackToList}
          </Button>
          <Button variant="primary" size="sm" onPress={() => void fetchToken()}>
            <Call02Icon size={16} />
            {m.join}
          </Button>
        </div>
      </div>
    );
  }

  // ── Connected — VideoConference (LiveKitRoom is in provider) ──
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface" data-lk-theme="default">
      <div className="absolute left-4 top-4 z-50 flex items-center gap-2">
        {isOrganizer && (
          <Button
            variant="secondary"
            size="sm"
            onPress={handleEndRequest}
            isDisabled={ending}
            className="h-10 rounded-full border border-amber-500/20 bg-amber-500 px-4 text-white shadow-lg transition-colors hover:bg-amber-600"
          >
            <PhoneOff className="size-4" />
            {m.endMeeting}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onPress={handleLeaveRequest}
          className="h-10 rounded-full border border-red-500/20 bg-red-500 px-4 text-white shadow-lg transition-colors hover:bg-red-600"
        >
          <PhoneOff className="size-4" />
          {m.roomLeave}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-16">
        <TranslatedVideoConference
          m={m}
          onLeave={handleLeaveRequest}
        />
        <ConnectionStateToast />
      </div>

      <LeaveConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        onConfirm={handleLeaveConfirm}
        labels={leaveLabels}
      />

      {/* End meeting confirm dialog (organizer only) */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{m.endMeeting}</DialogTitle>
            <DialogDescription>{m.endMeetingConfirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <DialogClose asChild>
              <Button variant="secondary" size="sm" isDisabled={ending}>{m.leaveCancel}</Button>
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onPress={() => void handleEndConfirm()}
              isDisabled={ending}
            >
              {ending ? <Loader2 className="size-4 animate-spin" /> : null}
              {m.endMeeting}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
