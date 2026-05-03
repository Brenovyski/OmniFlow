import { useMemo } from "react";
import { Link } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccountBalances } from "@/features/accounts/balances-queries";
import { useAccounts } from "@/features/accounts/queries";
import type { AccountType } from "@/features/accounts/schemas";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<AccountType, string> = {
  credit_card: "Credit card",
  debit: "Debit",
  voucher: "Voucher",
  brokerage: "Brokerage",
  cash: "Cash",
  savings: "Savings",
};

export function AccountsList() {
  const accountsQ = useAccounts();
  const balancesQ = useAccountBalances();

  const rows = useMemo(() => {
    const accounts = accountsQ.data ?? [];
    return accounts
      .filter((a) => !a.archived_at)
      .map((a) => ({
        ...a,
        balance: balancesQ.data?.get(a.id) ?? 0,
      }));
  }, [accountsQ.data, balancesQ.data]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + r.balance, 0),
    [rows],
  );

  const loading = accountsQ.isLoading || balancesQ.isLoading;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Live derived balances.</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            Total
          </div>
          <div className="num font-display text-lg font-semibold tracking-tight">
            {fmtMoney(total)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-text-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-input border border-dashed border-border bg-surface-2/40 p-6 text-center">
            <span className="text-sm font-medium text-text">
              No active sources yet
            </span>
            <Link
              to="/settings"
              className="text-xs font-medium text-brand hover:underline"
            >
              Open settings to add one →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{
                      background:
                        a.color ?? "hsl(var(--text-faint) / 0.5)",
                    }}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-text">
                      {a.short_name ?? a.name}
                    </div>
                    <div className="text-xs text-text-faint">
                      {TYPE_LABEL[a.type]}
                      {a.last4 ? ` •••• ${a.last4}` : ""}
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "num shrink-0 font-semibold tabular-nums",
                    a.balance < 0 ? "text-expense" : "text-text",
                  )}
                >
                  {fmtMoney(a.balance, { currency: a.currency })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
