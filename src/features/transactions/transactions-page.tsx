import { Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAccounts } from "@/features/accounts/queries";
import { useCategories } from "@/features/categories/queries";
import {
  FilterChips,
  useFilterState,
} from "@/features/transactions/filter-chips";
import { useTransactions } from "@/features/transactions/queries";
import { TransactionsTable } from "@/features/transactions/transactions-table";
import { downloadCsv, txToCsv } from "@/lib/csv";
import { toISODate } from "@/lib/format";
import { useModalStore } from "@/stores/modal-store";

export function TransactionsPage() {
  const transactions = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();
  const openNewTx = useModalStore((s) => s.openNewTx);
  const [filter] = useFilterState();

  const all = transactions.data ?? [];
  const filtered = all.filter((tx) => {
    if (filter.type !== "all" && tx.type !== filter.type) return false;
    if (filter.accountId !== "all" && tx.account_id !== filter.accountId)
      return false;
    return true;
  });

  const handleExport = () => {
    const csv = txToCsv(
      filtered,
      accounts.data ?? [],
      categories.data ?? [],
    );
    downloadCsv(`omniflow-transactions-${toISODate(new Date())}.csv`, csv);
  };

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
              : `${all.length} entr${all.length === 1 ? "y" : "ies"} — every flow in, out, and around.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button onClick={openNewTx}>
            <Plus className="size-3.5" />
            New transaction
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
          <FilterChips />
          <div className="ml-auto text-xs text-text-faint">
            Showing{" "}
            <strong className="text-text-muted">{filtered.length}</strong> of{" "}
            {all.length}
          </div>
        </div>

        {transactions.isLoading ? (
          <div className="px-5 py-16 text-center text-sm text-text-muted">
            Loading transactions…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-text-faint">
              {all.length === 0 ? "Empty" : "No matches"}
            </span>
            <div className="font-display text-base font-semibold">
              {all.length === 0
                ? "No transactions yet"
                : "Nothing matches these filters"}
            </div>
            <p className="max-w-sm text-sm text-text-muted">
              {all.length === 0
                ? "Create your first transaction with the button above, the sidebar Quick add, or by pressing N."
                : "Adjust the chips above or clear them to see all entries."}
            </p>
          </div>
        ) : (
          <TransactionsTable
            rows={filtered}
            accounts={accounts.data ?? []}
            categories={categories.data ?? []}
          />
        )}
      </Card>
    </div>
  );
}
