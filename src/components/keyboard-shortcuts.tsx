import { useEffect } from "react";

import { isCmdKey } from "@/lib/platform";
import { useModalStore } from "@/stores/modal-store";

export function KeyboardShortcuts() {
  const openNewTx = useModalStore((s) => s.openNewTx);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isCmdKey(e) && e.key.toLowerCase() === "n") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName.toLowerCase();
        // Don't hijack typing inside text inputs.
        if (
          tag === "input" ||
          tag === "textarea" ||
          target?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        openNewTx();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openNewTx]);

  return null;
}
