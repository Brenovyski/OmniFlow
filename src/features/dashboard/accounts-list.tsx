import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  ACCOUNT_TYPE_LABEL,
  type Account,
} from "@/features/accounts/schemas";
import { useSources } from "@/features/sources/queries";
import type { Source } from "@/features/sources/schemas";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface InnerAccount {
  account: Account;
  balance: number;
}

interface SourceRow {
  source: Source;
  total: number;
  accounts: InnerAccount[];
}

export function AccountsList() {
  const accountsQ = useAccounts();
  const sourcesQ = useSources();
  const balancesQ = useAccountBalances();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo<SourceRow[]>(() => {
    const sources = (sourcesQ.data ?? []).filter((s) => !s.archived_at);
    const accounts = (accountsQ.data ?? []).filter((a) => !a.archived_at);
    const balances = balancesQ.data;

    return sources
      .map<SourceRow>((source) => {
        const inner = accounts
          .filter((a) => a.source_id === source.id)
          .map<InnerAccount>((a) => ({
            account: a,
            balance: balances?.get(a.id) ?? 0,
          }));
        const total = inner.reduce((s, r) => s + r.balance, 0);
        return { source, total, accounts: inner };
      })
      .filter((r) => r.accounts.length > 0);
  }, [sourcesQ.data, accountsQ.data, balancesQ.data]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);
  const loading = accountsQ.isLoading || balancesQ.isLoading || sourcesQ.isLoading;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Live derived balances by source.</CardDescription>
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
            {rows.map((r) => {
              const isOpen = expanded.has(r.source.id);
              const Chevron = isOpen ? ChevronDown : ChevronRight;
              return (
                <li key={r.source.id} className="first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => toggle(r.source.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Chevron className="size-3.5 shrink-0 text-text-faint" />
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: r.source.color ?? "#A8A29E" }}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-text">
                          {r.source.name}
                        </div>
                        <div className="text-xs text-text-faint">
                          {r.accounts.length}{" "}
                          {r.accounts.length === 1 ? "account" : "accounts"}
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "num shrink-0 font-semibold tabular-nums",
                        r.total < 0 ? "text-expense" : "text-text",
                      )}
                    >
                      {fmtMoney(r.total)}
                    </div>
                  </button>

                  {isOpen && (
                    <ul className="mb-2 ml-7 flex flex-col border-l border-border pl-3">
                      {r.accounts.map((inner) => (
                        <li
                          key={inner.account.id}
                          className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
                        >
                          <span className="truncate text-text">
                            {ACCOUNT_TYPE_LABEL[inner.account.type]}
                          </span>
                          <div
                            className={cn(
                              "num shrink-0 tabular-nums",
                              inner.balance < 0
                                ? "text-expense"
                                : "text-text-muted",
                            )}
                          >
                            {fmtMoney(inner.balance, {
                              currency: inner.account.currency,
                            })}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
