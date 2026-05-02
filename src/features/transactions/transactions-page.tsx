import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { useTransactions } from "@/features/transactions/queries";
import { useModalStore } from "@/stores/modal-store";

export function TransactionsPage() {
  const transactions = useTransactions();
  const openNewTx = useModalStore((s) => s.openNewTx);
  const total = transactions.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {transactions.isLoading
              ? "Loading…"
              : `${total} entr${total === 1 ? "y" : "ies"} — every flow in, out, and around.`}
          </p>
        </div>
        <Button onClick={openNewTx}>
          <Plus className="size-3.5" />
          New transaction
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-text-faint">
            Coming in 3b
          </span>
          <CardTitle className="text-base">Filterable table is next</CardTitle>
          <CardDescription>
            Type / account / date filter chips, sortable columns, inline cell
            edit, soft-delete from a row menu. For now, use the button above
            (or the sidebar Quick add, or press <span className="font-mono">N</span>) to log a
            transaction. Recent entries show on the Dashboard.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
