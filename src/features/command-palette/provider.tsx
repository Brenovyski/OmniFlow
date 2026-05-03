import {
  ArrowDownUp,
  LayoutGrid,
  LogOut,
  Moon,
  PanelLeft,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Tags,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";
import { useModalStore } from "@/stores/modal-store";
import { useUIStore } from "@/stores/ui-store";

import { useRegisterCommands } from "./hooks";
import { CommandPaletteDialog } from "./palette-dialog";
import type { CommandItem } from "./registry";

/**
 * Mounts the palette dialog and registers built-in commands shared by every
 * authenticated route. Feature pages register their own page-specific
 * commands via `useRegisterCommands(...)`.
 */
export function CommandPaletteProvider() {
  const navigate = useNavigate();
  const openNewTx = useModalStore((s) => s.openNewTx);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const theme = useUIStore((s) => s.theme);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: "nav.dashboard",
        group: "Navigate",
        label: "Dashboard",
        icon: LayoutGrid,
        keywords: ["home", "overview"],
        run: () => navigate("/"),
      },
      {
        id: "nav.transactions",
        group: "Navigate",
        label: "Transactions",
        icon: ArrowDownUp,
        keywords: ["expenses", "earnings"],
        run: () => navigate("/transactions"),
      },
      {
        id: "nav.insights",
        group: "Navigate",
        label: "Insights",
        icon: Sparkles,
        keywords: ["analytics"],
        run: () => navigate("/insights"),
      },
      {
        id: "nav.investments",
        group: "Navigate",
        label: "Investments",
        icon: TrendingUp,
        keywords: ["portfolio", "holdings"],
        run: () => navigate("/investments"),
      },
      {
        id: "nav.categories",
        group: "Navigate",
        label: "Categories",
        icon: Tags,
        run: () => navigate("/categories"),
      },
      {
        id: "nav.settings",
        group: "Navigate",
        label: "Settings",
        icon: Settings,
        keywords: ["sources", "accounts", "preferences"],
        run: () => navigate("/settings"),
      },
      {
        id: "action.new-transaction",
        group: "Actions",
        label: "New transaction",
        icon: Plus,
        hint: "N",
        keywords: ["add", "expense", "earning", "create"],
        run: () => openNewTx(),
      },
      {
        id: "action.toggle-theme",
        group: "Actions",
        label: theme === "light" ? "Switch to dark mode" : "Switch to light mode",
        icon: theme === "light" ? Moon : Sun,
        keywords: ["theme", "dark", "light"],
        run: () => toggleTheme(),
      },
      {
        id: "action.toggle-sidebar",
        group: "Actions",
        label: "Toggle sidebar",
        icon: PanelLeft,
        keywords: ["collapse", "expand"],
        run: () => toggleSidebar(),
      },
      {
        id: "account.sign-out",
        group: "Account",
        label: "Sign out",
        icon: LogOut,
        run: () => {
          void supabase.auth.signOut();
        },
      },
    ],
    [navigate, openNewTx, toggleTheme, toggleSidebar, theme],
  );

  useRegisterCommands(commands);

  return <CommandPaletteDialog />;
}
