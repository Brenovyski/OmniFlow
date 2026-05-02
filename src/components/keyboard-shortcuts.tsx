import { useEffect } from "react";

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore modifier-key combos — those are reserved by the browser/OS.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isTypingTarget(e.target)) return;
      if (dialogOpen) return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        openNewTx();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openNewTx, dialogOpen]);

  return null;
}
