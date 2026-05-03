import { Outlet } from "react-router-dom";

import { Fab } from "@/components/layout/fab";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { CommandPaletteProvider } from "@/features/command-palette/provider";
import { TransactionDialog } from "@/features/transactions/transaction-dialog";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

export function AdminLayout() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  return (
    <div
      className={cn(
        "grid min-h-screen transition-[grid-template-columns] duration-200",
        collapsed ? "grid-cols-[64px_1fr]" : "grid-cols-[248px_1fr]",
      )}
    >
      <Sidebar />
      <main className="flex min-w-0 flex-col">
        <Topbar />
        <div className="mx-auto w-full max-w-[1480px] flex-1 p-7">
          <Outlet />
        </div>
      </main>
      <TransactionDialog />
      <CommandPaletteProvider />
      <Fab />
      <KeyboardShortcuts />
    </div>
  );
}
