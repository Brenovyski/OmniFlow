import { useMemo } from "react";
import { Plus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccountBalances } from "@/features/accounts/balances-queries";
import { useAuth } from "@/features/auth/auth-context";
import { useTransactions } from "@/features/transactions/queries";
import { fmtDate, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/modal-store";

import { KpiCard } from "./kpi-card";
import { computeRangeStats } from "./stats";
import { TimeRangeChips, useTimeRange } from "./time-range-chips";

const TYPE_COLOR: Record<string, string> = {
  expense: "text-expense",
  earning: "text-income",
  investment: "text-invest",
  transfer: "text-text-faint",
};

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function nameFromEmail(email: string | null | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function DashboardPage() {
  const { user } = useAuth();
  const transactionsQ = useTransactions();
  const balancesQ = useAccountBalances();
  const openNewTx = useModalStore((s) => s.openNewTx);
  const [range] = useTimeRange();

  const transactions = transactionsQ.data ?? [];
  const recent = transactions.slice(0, 5);

  const currentTotal = useMemo(() => {
    if (!balancesQ.data) return 0;
    let sum = 0;
    for (const v of balancesQ.data.values()) sum += v;
    return sum;
  }, [balancesQ.data]);

  const stats = useMemo(
    () => computeRangeStats(range, transactions, currentTotal),
    [range, transactions, currentTotal],
  );

  const loading = transactionsQ.isLoading || balancesQ.isLoading;
  const greeting = greetingFor(new Date().getHours());
  const userName = nameFromEmail(user?.email);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-tight">
          {greeting}, {userName}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Cash flow, balances, and the month at a glance.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
          Range
        </span>
        <TimeRangeChips />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Net worth"
          cents={stats.netWorth}
          series={stats.netWorthSeries}
          priorCents={stats.prior.netWorth}
          tone="text"
          loading={loading}
        />
        <KpiCard
          label="Income"
          cents={stats.income}
          series={stats.incomeSeries}
          priorCents={stats.prior.income}
          tone="income"
          loading={loading}
        />
        <KpiCard
          label="Spending"
          cents={stats.expense}
          series={stats.expenseSeries}
          priorCents={stats.prior.expense}
          tone="expense"
          invertDeltaPolarity
          loading={loading}
        />
        <KpiCard
          label="Invested"
          cents={stats.invested}
          series={stats.investedSeries}
          priorCents={stats.prior.invested}
          tone="invest"
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Your last 5 entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsQ.isLoading ? (
            <div className="text-sm text-text-muted">Loading…</div>
          ) : recent.length === 0 ? (
            <button
              type="button"
              onClick={openNewTx}
              className="flex w-full flex-col items-center gap-2 rounded-input border border-dashed border-border bg-surface-2/40 p-8 text-center transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <Plus className="size-5 text-text-faint" />
              <span className="text-sm font-medium text-text">
                Add your first transaction
              </span>
              <span className="text-xs text-text-muted">
                Click here, the FAB, or press the Quick add shortcut.
              </span>
            </button>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((tx) => {
                const signed =
                  tx.type === "expense" ? -tx.amount_cents : tx.amount_cents;
                return (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {tx.description}
                      </div>
                      <div className="num text-xs text-text-faint">
                        {fmtDate(tx.date)}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "num shrink-0 font-semibold",
                        TYPE_COLOR[tx.type],
                      )}
                    >
                      {fmtMoney(signed, { sign: tx.type === "earning" })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
