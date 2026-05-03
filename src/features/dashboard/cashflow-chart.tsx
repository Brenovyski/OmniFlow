import { useMemo } from "react";
import { format, startOfISOWeek, subWeeks } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTransactions } from "@/features/transactions/queries";
import { fmtMoney, parseISODate } from "@/lib/format";

const WEEKS = 12;

interface WeekRow {
  weekStartIso: string;
  label: string;
  income: number;
  expense: number;
}

function buildWeeks(now: Date): WeekRow[] {
  const currentWeekStart = startOfISOWeek(now);
  const rows: WeekRow[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = subWeeks(currentWeekStart, i);
    rows.push({
      weekStartIso: start.toISOString().slice(0, 10),
      label: format(start, "MMM d"),
      income: 0,
      expense: 0,
    });
  }
  return rows;
}

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-input border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-text">Week of {label}</div>
      <div className="mt-1 flex flex-col gap-0.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: p.color }}
            />
            <span className="text-text-muted">{p.name}</span>
            <span className="num ml-auto font-medium text-text">
              {fmtMoney(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CashflowChart() {
  const txQ = useTransactions();
  const transactions = txQ.data ?? [];

  const data = useMemo(() => {
    const weeks = buildWeeks(new Date());
    const index = new Map(weeks.map((w, i) => [w.weekStartIso, i]));
    for (const t of transactions) {
      if (t.deleted_at) continue;
      if (t.type !== "earning" && t.type !== "expense") continue;
      const weekStart = startOfISOWeek(parseISODate(t.date));
      const key = weekStart.toISOString().slice(0, 10);
      const idx = index.get(key);
      if (idx === undefined) continue;
      if (t.type === "earning") weeks[idx].income += t.amount_cents;
      else weeks[idx].expense += t.amount_cents;
    }
    return weeks;
  }, [transactions]);

  const hasAny = data.some((w) => w.income > 0 || w.expense > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash flow</CardTitle>
        <CardDescription>
          Income vs spending, last 12 ISO weeks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {txQ.isLoading ? (
          <div className="text-sm text-text-muted">Loading…</div>
        ) : !hasAny ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">
            No income or spending recorded in the last 12 weeks yet.
          </div>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: "hsl(var(--text-muted))",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{
                    fill: "hsl(var(--text-muted))",
                    fontSize: 11,
                  }}
                  tickFormatter={(v: number) =>
                    fmtMoney(v, { abbrev: true }).replace(/\s/g, "")
                  }
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--surface-2))" }}
                  content={<ChartTooltip />}
                />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="hsl(var(--income))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  name="Spending"
                  fill="hsl(var(--expense))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
