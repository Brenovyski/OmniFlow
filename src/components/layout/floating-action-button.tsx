import { Plus } from "lucide-react";

import { useModalStore } from "@/stores/modal-store";

export function FloatingActionButton() {
  const openNewTx = useModalStore((s) => s.openNewTx);
  return (
    <button
      type="button"
      onClick={openNewTx}
      title="New transaction"
      className="fixed bottom-7 right-7 z-20 grid h-[52px] w-[52px] place-items-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-brand-press hover:text-white"
    >
      <Plus className="size-5" />
    </button>
  );
}
