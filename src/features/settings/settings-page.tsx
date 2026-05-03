import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccounts } from "@/features/accounts/queries";
import { useAuth } from "@/features/auth/auth-context";
import { useCategories } from "@/features/categories/queries";
import { AccountsSection } from "@/features/settings/accounts-section";
import { useTransactions } from "@/features/transactions/queries";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

const THEMES = ["light", "dark"] as const;

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Profile, sources, preferences, and data.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="accounts">Sources</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="accounts">
          <AccountsSection />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>
        <TabsContent value="data">
          <DataTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Account email and credentials. Editing lands in step 12.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-input border border-border bg-surface-2 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
            Email
          </div>
          <div className="mt-1 text-sm">{user?.email ?? "—"}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PreferencesTab() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose how OmniFlow looks on this device. Currency and language land
          in step 12.
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
  );
}

function DataTab() {
  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useTransactions();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supabase connection</CardTitle>
        <CardDescription>
          Live counts from your project (proves RLS + queries are wired). CSV
          import / JSON export land in step 12.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3">
        <ConnCell label="Sources" query={accounts} />
        <ConnCell label="Categories" query={categories} />
        <ConnCell label="Transactions" query={transactions} />
      </CardContent>
    </Card>
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
