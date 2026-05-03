import { useMemo } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCategories } from "@/features/categories/queries";
import { useTransactions } from "@/features/transactions/queries";
import { fmtMoney, parseISODate } from "@/lib/format";

const TOP_N = 5;

interface Row {
  id: string;
  name: string;
  color: string | null;
  cents: number;
}

export function TopSpending() {
  const txQ = useTransactions();
  const catsQ = useCategories();

  const rows = useMemo<Row[]>(() => {
    const transactions = txQ.data ?? [];
    const categories = catsQ.data ?? [];
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totals = new Map<string, number>();
    let uncategorized = 0;

    for (const t of transactions) {
      if (t.deleted_at) continue;
      if (t.type !== "expense") continue;
      const d = parseISODate(t.date);
      if (d < monthStart || d > now) continue;
      if (!t.category_id) {
        uncategorized += t.amount_cents;
        continue;
      }
      totals.set(
        t.category_id,
        (totals.get(t.category_id) ?? 0) + t.amount_cents,
      );
    }

    const list: Row[] = [];
    for (const [id, cents] of totals.entries()) {
      const cat = catMap.get(id);
      list.push({
        id,
        name: cat?.name ?? "Unknown",
        color: cat?.color ?? null,
        cents,
      });
    }
    if (uncategorized > 0) {
      list.push({
        id: "__uncategorized",
        name: "Uncategorized",
        color: null,
        cents: uncategorized,
      });
    }

    list.sort((a, b) => b.cents - a.cents);
    return list.slice(0, TOP_N);
  }, [txQ.data, catsQ.data]);

  const max = rows[0]?.cents ?? 0;
  const loading = txQ.isLoading || catsQ.isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top spending</CardTitle>
        <CardDescription>Top categories this month.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-text-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-center text-sm text-text-muted">
            No spending recorded this month yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const pct = max > 0 ? (r.cents / max) * 100 : 0;
              return (
                <li key={r.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{
                          background:
                            r.color ?? "hsl(var(--text-faint) / 0.5)",
                        }}
                      />
                      <span className="truncate font-medium text-text">
                        {r.name}
                      </span>
                    </div>
                    <span className="num shrink-0 font-semibold text-expense">
                      {fmtMoney(r.cents)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-expense/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
