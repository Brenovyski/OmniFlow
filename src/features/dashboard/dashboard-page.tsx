import { Plus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTransactions } from "@/features/transactions/queries";
import { fmtDate, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/modal-store";

const TYPE_COLOR: Record<string, string> = {
  expense: "text-expense",
  earning: "text-income",
  investment: "text-invest",
};

export function DashboardPage() {
  const transactions = useTransactions();
  const openNewTx = useModalStore((s) => s.openNewTx);
  const recent = (transactions.data ?? []).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Cash flow, balances, and the month at a glance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Your last 5 entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.isLoading ? (
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

      <p className="text-xs text-text-faint">
        Coming next: KPI cards, cash flow chart, top categories, accounts panel.
      </p>
    </div>
  );
}
