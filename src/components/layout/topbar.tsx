import {
  Bell,
  ChevronRight,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useCommandStore } from "@/features/command-palette/registry";
import { useModalStore } from "@/stores/modal-store";
import { useUIStore } from "@/stores/ui-store";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/transactions": "Transactions",
  "/insights": "Insights",
  "/investments": "Investments",
  "/categories": "Categories",
  "/settings": "Settings",
};

export function Topbar() {
  const { pathname } = useLocation();
  const theme = useUIStore((s) => s.theme);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const openNewTx = useModalStore((s) => s.openNewTx);
  const openPalette = useCommandStore((s) => s.openPalette);
  const title = TITLES[pathname] ?? "OmniFlow";
  // Mac shows ⌘K, everyone else gets Ctrl K. navigator.platform is
  // soft-deprecated but still the cheapest reliable signal for this.
  const isMac =
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad/i.test(navigator.platform);

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/70 px-7 py-3.5 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        title="Toggle sidebar"
      >
        <Menu className="size-[18px]" />
      </Button>

      <div className="flex items-center gap-1.5 text-[13px] text-text-faint">
        <span>OmniFlow</span>
        <ChevronRight className="size-3" />
        <span className="font-medium text-text">{title}</span>
      </div>

      <button
        type="button"
        onClick={openPalette}
        className="ml-6 flex max-w-[480px] flex-1 items-center gap-2 rounded-input border border-border bg-surface px-3 py-1.5 text-text-muted transition-colors hover:border-border-strong hover:text-text"
      >
        <Search className="size-3.5" />
        <span className="text-[13px]">Search or run a command…</span>
        <span className="ml-auto rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-faint">
          {isMac ? "⌘K" : "Ctrl K"}
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title="Toggle theme"
        >
          {theme === "light" ? (
            <Moon className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon" title="Notifications">
          <Bell className="size-4" />
        </Button>
        <Button onClick={openNewTx}>
          <Plus className="size-3.5" />
          New
        </Button>
      </div>
    </div>
  );
}
