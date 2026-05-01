import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccounts } from "@/features/accounts/queries";
import { useCategories } from "@/features/categories/queries";
import { useTransactions } from "@/features/transactions/queries";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

const THEMES = ["light", "dark"] as const;

export function SettingsPage() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useTransactions();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Preferences and account configuration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how OmniFlow looks on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={cn(
                "rounded-input px-4 py-2 text-sm font-medium capitalize transition-colors",
                theme === t
                  ? "border border-brand bg-brand/10 text-text"
                  : "border border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
              )}
            >
              {t}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supabase connection</CardTitle>
          <CardDescription>
            Live counts from your project (proves RLS + queries are wired).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <ConnCell label="Accounts" query={accounts} />
          <ConnCell label="Categories" query={categories} />
          <ConnCell label="Transactions" query={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}

function ConnCell({
  label,
  query,
}: {
  label: string;
  query: { data?: unknown[]; isLoading: boolean; error: unknown };
}) {
  const { data, isLoading, error } = query;
  return (
    <div className="rounded-input border border-border bg-surface-2 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold tracking-tight">
        {error ? (
          <span className="text-base font-medium text-expense">error</span>
        ) : isLoading ? (
          <span className="text-base font-medium text-text-muted">…</span>
        ) : (
          (data?.length ?? 0)
        )}
      </div>
      {error instanceof Error && (
        <div className="mt-1 text-[11px] text-expense">{error.message}</div>
      )}
    </div>
  );
}
