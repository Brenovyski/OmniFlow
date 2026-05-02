import { create } from "zustand";

interface ModalState {
  newTxOpen: boolean;
  openNewTx: () => void;
  closeNewTx: () => void;
  setNewTxOpen: (open: boolean) => void;
}

export const useModalStore = create<ModalState>()((set) => ({
  newTxOpen: false,
  openNewTx: () => set({ newTxOpen: true }),
  closeNewTx: () => set({ newTxOpen: false }),
  setNewTxOpen: (newTxOpen) => set({ newTxOpen }),
}));
