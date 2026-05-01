import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

const THEMES = ["light", "dark"] as const;

export function SettingsPage() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

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
    </div>
  );
}
