import { useEffect } from "react";

import { useCommandStore } from "@/features/command-palette/registry";
import { useModalStore } from "@/stores/modal-store";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export function KeyboardShortcuts() {
  const openNewTx = useModalStore((s) => s.openNewTx);
  const dialogOpen = useModalStore((s) => s.txDialogOpen);
  const togglePalette = useCommandStore((s) => s.togglePalette);
  const paletteOpen = useCommandStore((s) => s.open);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;

      // ⌘K / Ctrl+K — toggle the command palette. Works even while typing
      // (the palette has its own input) and even with the new-tx dialog
      // open, so users can jump out of it.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
        return;
      }

      // The remaining single-key shortcuts must not steal keystrokes from
      // any open input or dialog.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (dialogOpen || paletteOpen) return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        openNewTx();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openNewTx, dialogOpen, togglePalette, paletteOpen]);

  return null;
}
