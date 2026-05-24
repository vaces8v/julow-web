"use client";

import {
  GridLayout,
  ParticipantTile,
  TrackToggle,
  MediaDeviceMenu,
  ChatToggle,
  StartMediaButton,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  CarouselLayout,
  LayoutContextProvider,
  ChatEntry,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
  useLocalParticipant,
  useLocalParticipantPermissions,
  usePersistentUserChoices,
  useIsSpeaking,
  useChat,
  useMaybeLayoutContext,
  type MessageFormatter,
} from "@livekit/components-react";
import type {
  TrackReferenceOrPlaceholder,
  WidgetState,
  ChatMessage,
  ChatOptions,
} from "@livekit/components-core";
import { isEqualTrackRef, isTrackReference, isWeb, supportsScreenSharing } from "@livekit/components-core";
import { RoomEvent, Track } from "livekit-client";
import "@livekit/components-styles";
import { Call02Icon } from "hugeicons-react";
import { ArrowLeft, Loader2, AlertCircle, PhoneOff } from "lucide-react";
import { Button } from "@heroui/react";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/context";
import { useLiveMeeting } from "@/components/live-meeting-context";
import { api } from "@/lib/api";
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

  return (
    <div className="lk-chat" style={style}>
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

function TranslatedControlBar({
  micLabel,
  camLabel,
  shareLabel,
  stopShareLabel,
  chatLabel,
  leaveLabel,
  controls,
  onLeave,
}: {
  micLabel: string;
  camLabel: string;
  shareLabel: string;
  stopShareLabel: string;
  chatLabel: string;
  leaveLabel: string;
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
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const isSpeaking = useIsSpeaking(localParticipant);

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

  const isTooSmall = useMediaQueryInternal("(max-width: 600px)");
  const showText = !isTooSmall;
  const showIcon = true;
  const browserSupportsScreenSharing = supportsScreenSharing();

  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const onScreenShareChange = useCallback((enabled: boolean) => setIsScreenShareEnabled(enabled), []);

  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: false });

  const microphoneOnChange = useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveAudioInputEnabled(enabled) : null,
    [saveAudioInputEnabled],
  );
  const cameraOnChange = useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveVideoInputEnabled(enabled) : null,
    [saveVideoInputEnabled],
  );

  // Speaking indicator: show animated blue ring around mic when speaking
  const showSpeakingRing = isMicrophoneEnabled && isSpeaking;

  return (
    <div className="lk-control-bar">
      {visibleControls.microphone && (
        <div className="lk-button-group relative">
          {/* Animated speaking ring */}
          {showSpeakingRing && (
            <span className="pointer-events-none absolute -inset-[3px] z-0 rounded-[var(--lk-border-radius)] animate-pulse ring-2 ring-emerald-400/70 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          )}
          <TrackToggle source={Track.Source.Microphone} showIcon={showIcon} onChange={microphoneOnChange}>
            {showText && micLabel}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="audioinput"
              onActiveDeviceChange={(_kind, deviceId) => saveAudioInputDeviceId(deviceId ?? "default")}
            />
          </div>
        </div>
      )}
      {visibleControls.camera && (
        <div className="lk-button-group">
          <TrackToggle source={Track.Source.Camera} showIcon={showIcon} onChange={cameraOnChange}>
            {showText && camLabel}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="videoinput"
              onActiveDeviceChange={(_kind, deviceId) => saveVideoInputDeviceId(deviceId ?? "default")}
            />
          </div>
        </div>
      )}
      {visibleControls.screenShare && browserSupportsScreenSharing && (
        <TrackToggle
          source={Track.Source.ScreenShare}
          captureOptions={{ audio: true, selfBrowserSurface: "include" }}
          showIcon={showIcon}
          onChange={onScreenShareChange}
        >
          {showText && (isScreenShareEnabled ? stopShareLabel : shareLabel)}
        </TrackToggle>
      )}
      {visibleControls.chat && (
        <ChatToggle>{showText && chatLabel}</ChatToggle>
      )}
      {visibleControls.leave && (
        <button
          type="button"
          onClick={onLeave}
          className="lk-button lk-disconnect-button"
        >
          {showText && leaveLabel}
        </button>
      )}
      <StartMediaButton />
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
    roomShareScreen: string;
    roomStopShareScreen: string;
    roomChat: string;
    roomLeave: string;
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

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

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
                  <ParticipantTile />
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper">
                <FocusLayoutContainer>
                  <CarouselLayout tracks={carouselTracks}>
                    <ParticipantTile />
                  </CarouselLayout>
                  {focusTrack && <FocusLayout trackRef={focusTrack} />}
                </FocusLayoutContainer>
              </div>
            )}
            <TranslatedControlBar
              micLabel={m.roomMicrophone}
              camLabel={m.roomCamera}
              shareLabel={m.roomShareScreen}
              stopShareLabel={m.roomStopShareScreen}
              chatLabel={m.roomChat}
              leaveLabel={m.roomLeave}
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
    if (leavingRef.current) return;
    setState("loading");
    setError(null);
    try {
      const result = await liveMeeting.join(meetingId);
      if (leavingRef.current) return;
      if (result) {
        setState("connected");
      } else {
        setState("error");
        setError(m.roomError);
      }
    } catch (err) {
      if (leavingRef.current) return;
      setState("error");
      setError(err instanceof Error ? err.message : m.roomError);
    }
  }, [meetingId, m.roomError, liveMeeting]);

  useEffect(() => {
    if (leavingRef.current) return;
    void fetchToken();
  }, [fetchToken]);

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
    leavingRef.current = true;
    try {
      await api.completeMeeting(meetingId);
    } catch {
      /* even if the API call fails we still leave locally */
    } finally {
      setEnding(false);
      setEndDialogOpen(false);
      liveMeeting.leave();
      router.push("/meetings");
    }
  }, [meetingId, liveMeeting, router]);

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
        <p className="text-sm text-[var(--muted)]">{m.roomLoading}</p>
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
        <p className="max-w-sm text-center text-sm text-[var(--muted)]">{error ?? m.roomError}</p>
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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-secondary)]">
          <PhoneOff className="size-8 text-[var(--muted)]" />
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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--surface)]" data-lk-theme="default">
      {/* Top-right action buttons */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-2">
        {isOrganizer && (
          <button
            type="button"
            onClick={handleEndRequest}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-colors hover:bg-amber-600"
          >
            <PhoneOff className="size-3.5" />
            {m.endMeeting}
          </button>
        )}
        <button
          type="button"
          onClick={handleLeaveRequest}
          className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-colors hover:bg-red-600"
        >
          <PhoneOff className="size-3.5" />
          {m.roomLeave}
        </button>
      </div>

      <div style={{ height: "100%", minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}>
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
