import { create } from "zustand";

import type { Transaction } from "@/features/transactions/schemas";

interface ModalState {
  txDialogOpen: boolean;
  editingTx: Transaction | null;
  openNewTx: () => void;
  openEditTx: (tx: Transaction) => void;
  closeTxDialog: () => void;
  setTxDialogOpen: (open: boolean) => void;
}

export const useModalStore = create<ModalState>()((set) => ({
  txDialogOpen: false,
  editingTx: null,
  openNewTx: () => set({ txDialogOpen: true, editingTx: null }),
  openEditTx: (tx) => set({ txDialogOpen: true, editingTx: tx }),
  closeTxDialog: () => set({ txDialogOpen: false, editingTx: null }),
  setTxDialogOpen: (open) =>
    set((s) => ({
      txDialogOpen: open,
      editingTx: open ? s.editingTx : null,
    })),
}));
