import { Plus } from "lucide-react";

import { useModalStore } from "@/stores/modal-store";

/**
 * Brand-yellow floating action button. Anchored bottom-right of the
 * viewport on every authenticated route; opens the new-transaction
 * dialog. Hidden when the dialog is open so it doesn't sit on top of
 * the modal backdrop.
 */
export function Fab() {
  const openNewTx = useModalStore((s) => s.openNewTx);
  const txDialogOpen = useModalStore((s) => s.txDialogOpen);

  if (txDialogOpen) return null;

  return (
    <button
      type="button"
      onClick={openNewTx}
      aria-label="New transaction"
      title="New transaction (N)"
      className="fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform duration-150 ease-out hover:scale-105 hover:bg-brand-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Plus className="size-6" strokeWidth={2.25} />
    </button>
  );
}
