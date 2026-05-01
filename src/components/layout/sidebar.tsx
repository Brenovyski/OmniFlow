import {
  ArrowDownUp,
  Home,
  Settings,
  Tags,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: NavEntry[] = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/transactions", label: "Transactions", icon: ArrowDownUp },
  { to: "/investments", label: "Investments", icon: TrendingUp },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-border bg-surface">
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-border py-[18px]",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <img src="/volt.svg" alt="" className="h-9 w-9 shrink-0" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-display text-[17px] font-bold tracking-tight">
              OmniFlow
            </div>
            <div className="text-[11px] text-text-faint">Personal finance</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "relative mb-0.5 flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                isActive
                  ? "bg-brand/15 text-text"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
                collapsed && "justify-center px-2",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !collapsed && (
                  <span className="absolute left-0 h-[18px] w-[3px] -translate-x-2.5 rounded-r bg-brand" />
                )}
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    isActive ? "text-brand-press" : "text-text-faint",
                  )}
                />
                {!collapsed && <span className="flex-1">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-2.5">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-md p-2 hover:bg-surface-2",
            collapsed && "justify-center",
          )}
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-press text-xs font-bold text-brand-foreground">
            S
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-[13px] font-semibold">Suguru</div>
              <div className="text-[11px] text-text-faint">Personal</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
