"use client";

/**
 * Animated Dialog — animate-ui/components-radix-dialog (MIT)
 * Spring-powered flip entrance with blur overlay.
 * Source: https://animate-ui.com/docs/components/radix/dialog
 */

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { X } from "lucide-react";

/* ── Internal open-state context ── */
type DialogCtx = { isOpen: boolean; setIsOpen: (v: boolean) => void };
const Ctx = React.createContext<DialogCtx>({ isOpen: false, setIsOpen: () => {} });

/* ── Root ── */
type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root>;

function Dialog({ open, defaultOpen, onOpenChange, ...props }: DialogProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen ?? open ?? false);

  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const handleChange = (v: boolean) => {
    setIsOpen(v);
    onOpenChange?.(v);
  };

  return (
    <Ctx.Provider value={{ isOpen, setIsOpen: handleChange }}>
      <DialogPrimitive.Root open={isOpen} onOpenChange={handleChange} {...props} />
    </Ctx.Provider>
  );
}

/* ── Trigger ── */
type DialogTriggerProps = React.ComponentProps<typeof DialogPrimitive.Trigger>;
function DialogTrigger(props: DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/* ── Close ── */
type DialogCloseProps = React.ComponentProps<typeof DialogPrimitive.Close>;
function DialogClose(props: DialogCloseProps) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/* ── Portal (AnimatePresence-aware) ── */
function DialogPortal({ children }: { children: React.ReactNode }) {
  const { isOpen } = React.useContext(Ctx);
  return (
    <AnimatePresence>
      {isOpen && (
        <DialogPrimitive.Portal forceMount>
          {children}
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

/* ── Overlay ── */
type DialogOverlayProps = Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, "asChild"> &
  HTMLMotionProps<"div">;

function DialogOverlay({ className = "", ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay asChild forceMount>
      <motion.div
        key="dialog-overlay"
        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
        animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={`fixed inset-0 z-50 bg-black/40 ${className}`.trim()}
        {...props}
      />
    </DialogPrimitive.Overlay>
  );
}

/* ── Content ── */
type DialogFlipDir = "top" | "bottom" | "left" | "right";

type DialogContentProps = Omit<React.ComponentProps<typeof DialogPrimitive.Content>, "asChild"> &
  HTMLMotionProps<"div"> & {
    showClose?: boolean;
    from?: DialogFlipDir;
  };

function DialogContent({
  children,
  className = "",
  showClose = true,
  from = "top",
  transition = { type: "spring", stiffness: 160, damping: 26 },
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  ...motionProps
}: DialogContentProps) {
  const rotSign = from === "bottom" || from === "left" ? "20deg" : "-20deg";
  const isVert = from === "top" || from === "bottom";
  const rotAxis = isVert ? "rotateX" : "rotateY";

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        asChild
        forceMount
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={onEscapeKeyDown}
        onPointerDownOutside={onPointerDownOutside}
        onInteractOutside={onInteractOutside}
      >
        <motion.div
          key="dialog-content"
          data-slot="dialog-content"
          initial={{
            opacity: 0,
            filter: "blur(4px)",
            transform: `perspective(600px) ${rotAxis}(${rotSign}) scale(0.82)`,
          }}
          animate={{
            opacity: 1,
            filter: "blur(0px)",
            transform: `perspective(600px) ${rotAxis}(0deg) scale(1)`,
          }}
          exit={{
            opacity: 0,
            filter: "blur(4px)",
            transform: `perspective(600px) ${rotAxis}(${rotSign}) scale(0.82)`,
          }}
          transition={transition}
          className={`fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-6 shadow-2xl ${className}`.trim()}
          {...motionProps}
        >
          {children}
          {showClose && (
            <DialogPrimitive.Close className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] opacity-70 transition-all hover:bg-[var(--surface-secondary)] hover:opacity-100 focus:outline-none">
              <X size={15} strokeWidth={2} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/* ── Sub-parts ── */
function DialogHeader({ className = "", ...props }: React.ComponentProps<"div">) {
  return <div className={`flex flex-col gap-1.5 ${className}`.trim()} {...props} />;
}

function DialogFooter({ className = "", ...props }: React.ComponentProps<"div">) {
  return <div className={`flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${className}`.trim()} {...props} />;
}

function DialogTitle({ className = "", ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={`text-base font-semibold leading-tight ${className}`.trim()} {...props} />;
}

function DialogDescription({ className = "", ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={`text-sm text-[var(--muted)] ${className}`.trim()} {...props} />;
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
