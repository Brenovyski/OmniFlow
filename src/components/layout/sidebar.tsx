import {
  ArrowDownUp,
  LayoutGrid,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  Tags,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "@/features/auth/auth-context";
import { cmdSymbol } from "@/lib/platform";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/modal-store";
import { useUIStore } from "@/stores/ui-store";

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: string | number;
}

const WORKSPACE_NAV: NavEntry[] = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/transactions", label: "Transactions", icon: ArrowDownUp },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/investments", label: "Investments", icon: TrendingUp },
  { to: "/categories", label: "Categories", icon: Tags },
];

const ACCOUNT_NAV: NavEntry[] = [
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const { user } = useAuth();
  const email = user?.email ?? "";
  const initial = email ? email[0]!.toUpperCase() : "?";
  const openNewTx = useModalStore((s) => s.openNewTx);
  const handleSignOut = () => {
    void supabase.auth.signOut();
  };

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
            <div className="text-[11px] text-text-faint">
              flows in · out · around
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <button
          type="button"
          onClick={openNewTx}
          className={cn(
            "mb-1 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text",
            collapsed && "justify-center px-2",
          )}
        >
          <Plus className="h-[18px] w-[18px] shrink-0 text-text-faint" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Quick add</span>
              <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-faint">
                {cmdSymbol} N
              </span>
            </>
          )}
        </button>

        {!collapsed && (
          <SectionHeader>Workspace</SectionHeader>
        )}
        {WORKSPACE_NAV.map((entry) => (
          <NavItem key={entry.to} entry={entry} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <SectionHeader className="mt-2">Account</SectionHeader>
        )}
        {ACCOUNT_NAV.map((entry) => (
          <NavItem key={entry.to} entry={entry} collapsed={collapsed} />
        ))}
        <button
          type="button"
          onClick={handleSignOut}
          className={cn(
            "mt-0.5 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 text-text-faint" />
          {!collapsed && <span className="flex-1 text-left">Sign out</span>}
        </button>
      </nav>

      <div className="border-t border-border p-2.5">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-md p-2 hover:bg-surface-2",
            collapsed && "justify-center",
          )}
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-press text-xs font-bold text-brand-foreground">
            {initial}
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-semibold">
                {email || "Signed out"}
              </div>
              <div className="text-[11px] text-text-faint">Personal</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function SectionHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-2.5 pb-1.5 pt-3.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint",
        className,
      )}
    >
      {children}
    </div>
  );
}

function NavItem({
  entry,
  collapsed,
}: {
  entry: NavEntry;
  collapsed: boolean;
}) {
  const { to, label, icon: Icon, end, badge } = entry;
  return (
    <NavLink
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
          {!collapsed && (
            <>
              <span className="flex-1">{label}</span>
              {badge !== undefined && (
                <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-text-muted">
                  {badge}
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}
