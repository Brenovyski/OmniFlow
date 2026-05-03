import type { LucideIcon } from "lucide-react";
import { create } from "zustand";

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  hint?: string;
  keywords?: string[];
  run: () => void;
}

interface CommandStore {
  open: boolean;
  // Map<id, CommandItem> so re-registration overwrites instead of duplicating.
  commands: Map<string, CommandItem>;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setOpen: (open: boolean) => void;
  register: (commands: CommandItem[]) => void;
  unregister: (ids: string[]) => void;
}

export const useCommandStore = create<CommandStore>()((set) => ({
  open: false,
  commands: new Map(),
  openPalette: () => set({ open: true }),
  closePalette: () => set({ open: false }),
  togglePalette: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
  register: (commands) =>
    set((s) => {
      const next = new Map(s.commands);
      for (const c of commands) next.set(c.id, c);
      return { commands: next };
    }),
  unregister: (ids) =>
    set((s) => {
      const next = new Map(s.commands);
      for (const id of ids) next.delete(id);
      return { commands: next };
    }),
}));
