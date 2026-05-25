"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { DisconnectReason, VideoPresets } from "livekit-client";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/context";
import { api } from "@/lib/api";

/* ── Public API ───────────────────────────────────────────────── */

export interface JoinResult {
  token: string;
  serverUrl: string;
}

export interface LiveMeetingState {
  /** Currently active meeting id (null = no meeting). */
  meetingId: string | null;
  /** LiveKit access token. */
  token: string | null;
  /** LiveKit server URL. */
  serverUrl: string;
  /** Whether the user is on the full-screen meeting page. */
  isFullScreen: boolean;
  /** True right after leave() – prevents optimistic redirect back to room. */
  justLeft: boolean;
  /** Join a meeting – fetches token, stores state. Returns result or null on error. */
  join: (meetingId: string) => Promise<JoinResult | null>;
  /** Leave the meeting entirely (clears all state). */
  leave: () => void;
  /** Clear the justLeft flag (call after consuming it). */
  clearJustLeft: () => void;
}

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "ws://localhost:7880";

const LiveMeetingCtx = createContext<LiveMeetingState>({
  meetingId: null,
  token: null,
  serverUrl: LIVEKIT_URL,
  isFullScreen: false,
  justLeft: false,
  join: async () => null,
  leave: () => {},
  clearJustLeft: () => {},
});

export const useLiveMeeting = () => useContext(LiveMeetingCtx);

/* ── Provider ─────────────────────────────────────────────────── */

/**
 * LiveMeetingProvider hosts a SINGLE persistent LiveKitRoom that lives
 * for the entire duration of a meeting, regardless of page navigation.
 * This prevents reconnections when switching between the room page and
 * other pages (PiP mode).
 */
export function LiveMeetingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const m = t.meetings;

  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState(LIVEKIT_URL);
  const [justLeft, setJustLeft] = useState(false);
  const intentionalLeaveRef = useRef(false);
  const lastMeetingIdRef = useRef<string | null>(null);

  const resetMeetingState = useCallback(() => {
    setMeetingId(null);
    setToken(null);
    setServerUrl(LIVEKIT_URL);
  }, []);

  useEffect(() => {
    if (meetingId) {
      lastMeetingIdRef.current = meetingId;
    }
  }, [meetingId]);

  const isFullScreen = useMemo(() => {
    if (!meetingId) return false;
    return pathname === `/meetings/${meetingId}/room`;
  }, [pathname, meetingId]);

  const join = useCallback(
    async (id: string): Promise<JoinResult | null> => {
      // Already in this meeting — return cached credentials.
      if (id === meetingId && token) {
        return { token, serverUrl };
      }
      try {
        const res = await api.joinMeeting(id);
        if (res.accessToken) {
          const url = res.joinUrl || LIVEKIT_URL;
          intentionalLeaveRef.current = false;
          lastMeetingIdRef.current = id;
          setJustLeft(false);
          setMeetingId(id);
          setToken(res.accessToken);
          setServerUrl(url);
          return { token: res.accessToken, serverUrl: url };
        }
      } catch (err) {
        console.error("LiveMeeting: join failed", err);
      }
      return null;
    },
    [meetingId, token, serverUrl],
  );

  const leave = useCallback(() => {
    intentionalLeaveRef.current = true;
    setJustLeft(true);
    resetMeetingState();
  }, [resetMeetingState]);

  const clearJustLeft = useCallback(() => {
    setJustLeft(false);
  }, []);

  const handleDisconnected = useCallback((reason?: DisconnectReason) => {
    const disconnectedMeetingId = lastMeetingIdRef.current ?? meetingId;
    const wasIntentional = intentionalLeaveRef.current;

    intentionalLeaveRef.current = false;

    if (reason === DisconnectReason.ROOM_DELETED) {
      setJustLeft(true);
    }

    resetMeetingState();

    if (wasIntentional) {
      return;
    }

    if (reason === DisconnectReason.ROOM_DELETED) {
      toast.info(m.roomEndedTitle, {
        description: m.roomEndedByOrganizer,
        id: disconnectedMeetingId ? `meeting-ended-${disconnectedMeetingId}` : undefined,
      });
      if (disconnectedMeetingId && pathname === `/meetings/${disconnectedMeetingId}/room`) {
        router.replace("/meetings");
      }
    }
  }, [m.roomEndedByOrganizer, m.roomEndedTitle, meetingId, pathname, resetMeetingState, router]);

  const value = useMemo<LiveMeetingState>(
    () => ({ meetingId, token, serverUrl, isFullScreen, justLeft, join, leave, clearJustLeft }),
    [meetingId, token, serverUrl, isFullScreen, justLeft, join, leave, clearJustLeft],
  );

  const isConnected = Boolean(meetingId && token);

  return (
    <LiveMeetingCtx.Provider value={value}>
      <LiveKitRoom
        token={token ?? ""}
        serverUrl={serverUrl}
        connect={isConnected}
        onDisconnected={handleDisconnected}
        style={{ display: "contents" }}
        options={{
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
          publishDefaults: {
            videoEncoding: VideoPresets.h720.encoding,
            videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
            simulcast: true,
            degradationPreference: "balanced",
          },
          videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution,
          },
        }}
      >
        {isConnected && <RoomAudioRenderer />}
        {children}
      </LiveKitRoom>
    </LiveMeetingCtx.Provider>
  );
}
