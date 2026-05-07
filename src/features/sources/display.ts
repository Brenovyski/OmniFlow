import type { Account } from "@/features/accounts/schemas";

import type { Source } from "./schemas";

const FALLBACK_COLOR = "#A8A29E";

/**
 * Compact display label for a source: nickname when set, otherwise the full
 * name. Empty string if the source can't be found (caller should guard).
 */
export function sourceLabel(source: Source | undefined | null): string {
  if (!source) return "";
  return source.short_name?.trim() || source.name;
}

/**
 * Account display string used across the dashboard, transactions table, and
 * pickers: "{source nickname or name} · {account name}".
 */
export function accountDisplayLabel(
  account: Account,
  source: Source | undefined | null,
): string {
  const left = sourceLabel(source);
  return left ? `${left} · ${account.name}` : account.name;
}

/**
 * Visual color for an account dot/pill. Account color is inherited from its
 * source (the AccountForm no longer accepts a color); we still fall back to
 * any legacy `account.color` value, then to a neutral gray.
 */
export function accountDisplayColor(
  account: Account,
  source: Source | undefined | null,
): string {
  return source?.color || account.color || FALLBACK_COLOR;
}
