"use client";

import {
  useLocalParticipant,
  useIsSpeaking,
  useSpeakingParticipants,
  useParticipants,
} from "@livekit/components-react";
import {
  Mic01Icon,
  MicOff01Icon,
  Video01Icon,
  VideoOffIcon,
  Maximize01Icon,
  Cancel01Icon,
} from "hugeicons-react";
import { motion, AnimatePresence } from "motion/react";
import * as React from "react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveMeeting } from "@/components/live-meeting-context";
import { useI18n } from "@/i18n/context";
import { Button } from "@heroui/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

/* ── spring presets ───────────────────────────────────────────── */
const SPRING_SNAPPY = { type: "spring" as const, stiffness: 500, damping: 35 };
const SPRING_FAST = { type: "spring" as const, stiffness: 600, damping: 32 };

/* ── Compact toolbar content (uses LiveKitRoom from provider) ── */

function PipToolbar({ onExpand, onClose }: { onExpand: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const m = t.meetings;
  const participants = useParticipants();
  const activeSpeakers = useSpeakingParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const localIsSpeaking = useIsSpeaking(localParticipant);

  const speakerName = activeSpeakers[0]?.name ?? activeSpeakers[0]?.identity ?? "";
  const pCount = participants.length;
  const isSpeaking = activeSpeakers.length > 0;

  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };

  const toggleMic = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      /* may fail if no device permission */
    }
  }, [localParticipant, isMicrophoneEnabled]);

  const toggleCam = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {
      /* may fail if no device permission */
    }
  }, [localParticipant, isCameraEnabled]);

  const showMicRing = isMicrophoneEnabled && localIsSpeaking;

  return (
    <motion.div layout transition={SPRING_SNAPPY} className="flex h-full items-center gap-2 px-3">
      {/* ── Speaking indicator dot (single dot, glow when active) ── */}
      <motion.span
        layout
        className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-200 ${
          isSpeaking
            ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
            : "bg-white/20"
        }`}
      />

      {/* ── Status text – expands/contracts with speaker info ── */}
      <AnimatePresence mode="wait">
        <motion.span
          key={isSpeaking ? `speak-${speakerName}` : "idle"}
          initial={{ opacity: 0, width: 0, x: -4 }}
          animate={{ opacity: 1, width: "auto", x: 0 }}
          exit={{ opacity: 0, width: 0, x: -4 }}
          transition={SPRING_FAST}
          className="inline-flex min-w-0 shrink-0 overflow-hidden whitespace-nowrap text-xs font-medium text-white/80"
        >
          {isSpeaking
            ? `${speakerName} · ${m.pipSpeaking}`
            : `${pCount} ${m.pipInCall}`}
        </motion.span>
      </AnimatePresence>

      {/* Divider */}
      <motion.div layout className="h-5 w-px shrink-0 bg-white/10" />

      {/* Mic toggle */}
      <motion.button
        layout
        type="button"
        onPointerDown={stop}
        onClick={toggleMic}
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
          isMicrophoneEnabled
            ? "text-white/80 hover:bg-white/10 hover:text-white"
            : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
        }`}
        title={m.roomMicrophone}
      >
        <AnimatePresence>
          {showMicRing && (
            <motion.span
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={SPRING_SNAPPY}
              className="pointer-events-none absolute -inset-0.5 rounded-full ring-2 ring-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
            />
          )}
        </AnimatePresence>
        {isMicrophoneEnabled ? <Mic01Icon size={16} /> : <MicOff01Icon size={16} />}
      </motion.button>

      {/* Cam toggle */}
      <motion.button
        layout
        type="button"
        onPointerDown={stop}
        onClick={toggleCam}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
          isCameraEnabled
            ? "text-white/80 hover:bg-white/10 hover:text-white"
            : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
        }`}
        title={m.roomCamera}
      >
        {isCameraEnabled ? <Video01Icon size={16} /> : <VideoOffIcon size={16} />}
      </motion.button>

      {/* Divider */}
      <motion.div layout className="h-5 w-px shrink-0 bg-white/10" />

      {/* Expand (back to meeting) */}
      <motion.button
        layout
        type="button"
        onPointerDown={stop}
        onClick={(e) => { e.stopPropagation(); onExpand(); }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        title={m.pipReturn}
      >
        <Maximize01Icon size={16} />
      </motion.button>

      {/* Leave */}
      <motion.button
        layout
        type="button"
        onPointerDown={stop}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
        title={m.roomLeave}
      >
        <Cancel01Icon size={16} />
      </motion.button>
    </motion.div>
  );
}

/* ── Draggable floating PiP bar ───────────────────────────────── */

export function MeetingPip() {
  const { meetingId, token, isFullScreen, leave } = useLiveMeeting();
  const { t } = useI18n();
  const m = t.meetings;
  const router = useRouter();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const visible = Boolean(meetingId && token && !isFullScreen);

  const handleExpand = useCallback(() => {
    if (meetingId) router.push(`/meetings/${meetingId}/room`);
  }, [meetingId, router]);

  const handleCloseRequest = useCallback(() => {
    setLeaveDialogOpen(true);
  }, []);

  const handleLeaveConfirm = useCallback(() => {
    setLeaveDialogOpen(false);
    leave();
    router.push("/meetings");
  }, [leave, router]);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="meeting-pip"
            layout
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={SPRING_SNAPPY}
            drag
            dragMomentum={false}
            className="fixed bottom-5 right-5 z-[9999] h-12 cursor-grab select-none overflow-hidden rounded-full border border-neutral-700/60 bg-neutral-900/95 shadow-2xl ring-1 ring-white/5 backdrop-blur-md active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            <PipToolbar onExpand={handleExpand} onClose={handleCloseRequest} />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{m.roomLeave}</DialogTitle>
            <DialogDescription>{m.leaveConfirmDesc}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <DialogClose asChild>
              <Button variant="secondary" size="sm">{m.leaveCancel}</Button>
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white"
              onPress={handleLeaveConfirm}
            >
              {m.roomLeave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
