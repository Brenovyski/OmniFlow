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
import { useUIStore } from "@/stores/ui-store";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/transactions": "Transactions",
  "/investments": "Investments",
  "/categories": "Categories",
  "/settings": "Settings",
};

export function Topbar() {
  const { pathname } = useLocation();
  const theme = useUIStore((s) => s.theme);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const title = TITLES[pathname] ?? "OmniFlow";

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
        className="ml-6 flex max-w-[480px] flex-1 items-center gap-2 rounded-input border border-border bg-surface px-3 py-1.5 text-text-muted hover:border-border-strong"
      >
        <Search className="size-3.5" />
        <span className="text-[13px]">Search transactions, categories…</span>
        <span className="ml-auto rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px]">
          ⌘K
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
        <Button>
          <Plus className="size-3.5" />
          New
        </Button>
      </div>
    </div>
  );
}
