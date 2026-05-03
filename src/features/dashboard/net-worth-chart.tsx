import { useMemo } from "react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
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
import { useAccountBalances } from "@/features/accounts/balances-queries";
import { useTransactions } from "@/features/transactions/queries";
import type { Transaction } from "@/features/transactions/schemas";
import { fmtMoney, parseISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

const NW_RANGES = ["3m", "6m", "1y", "all"] as const;
type NwRange = (typeof NW_RANGES)[number];
const DEFAULT_NW: NwRange = "1y";

const RANGE_LABEL: Record<NwRange, string> = {
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  all: "All",
};

function isNwRange(v: string | null): v is NwRange {
  return !!v && (NW_RANGES as readonly string[]).includes(v);
}

function useNwRange(): [NwRange, (next: NwRange) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("nw");
  const nw = isNwRange(raw) ? raw : DEFAULT_NW;
  const set = (next: NwRange) => {
    const np = new URLSearchParams(params);
    if (next === DEFAULT_NW) np.delete("nw");
    else np.set("nw", next);
    setParams(np, { replace: true });
  };
  return [nw, set];
}

function netDelta(t: Transaction): number {
  if (t.deleted_at) return 0;
  if (t.type === "earning" || t.type === "investment") return t.amount_cents;
  if (t.type === "expense") return -t.amount_cents;
  return 0;
}

/**
 * Build N month-end snapshots ending at the current month, walking backward
 * from the live total: net(d) = currentTotal − Σ netDelta(tx where date > d).
 * `months = null` means "all" — bound by the earliest transaction.
 */
function buildSeries(
  transactions: Transaction[],
  currentTotal: number,
  months: number | null,
  now: Date,
) {
  const cleanTx = transactions.filter((t) => !t.deleted_at);

  let startMonth: Date;
  if (months === null) {
    if (cleanTx.length === 0) {
      startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      const oldest = cleanTx.reduce((min, t) => {
        const d = parseISODate(t.date);
        return d < min ? d : min;
      }, parseISODate(cleanTx[0].date));
      startMonth = new Date(oldest.getFullYear(), oldest.getMonth(), 1);
    }
  } else {
    startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  }

  const points: { iso: string; label: string; net: number; ts: number }[] = [];
  const cursor = new Date(startMonth);
  while (cursor <= now) {
    const monthEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const cap = monthEnd > now ? now : monthEnd;
    let future = 0;
    for (const t of cleanTx) {
      const d = parseISODate(t.date);
      if (d > cap) future += netDelta(t);
    }
    points.push({
      iso: format(cap, "yyyy-MM-dd"),
      label: format(cap, "MMM yy"),
      net: currentTotal - future,
      ts: cap.getTime(),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}

interface TooltipPayload {
  value: number;
  payload: { label: string };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-input border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-text">{p.payload.label}</div>
      <div className="num mt-0.5 text-sm font-semibold text-text">
        {fmtMoney(p.value)}
      </div>
    </div>
  );
}

export function NetWorthChart() {
  const txQ = useTransactions();
  const balancesQ = useAccountBalances();
  const [nw, setNw] = useNwRange();

  const currentTotal = useMemo(() => {
    if (!balancesQ.data) return 0;
    let s = 0;
    for (const v of balancesQ.data.values()) s += v;
    return s;
  }, [balancesQ.data]);

  const data = useMemo(() => {
    const months = nw === "3m" ? 3 : nw === "6m" ? 6 : nw === "1y" ? 12 : null;
    return buildSeries(txQ.data ?? [], currentTotal, months, new Date());
  }, [txQ.data, currentTotal, nw]);

  const loading = txQ.isLoading || balancesQ.isLoading;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Net worth</CardTitle>
          <CardDescription>Month-end totals across all sources.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {NW_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setNw(r)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                nw === r
                  ? "border-text bg-text text-background"
                  : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
              )}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-text-muted">Loading…</div>
        ) : data.length < 2 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">
            Add a few months of activity to see net worth trend.
          </div>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <AreaChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="nwfill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--text-muted))", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: "hsl(var(--text-muted))", fontSize: 11 }}
                  tickFormatter={(v: number) =>
                    fmtMoney(v, { abbrev: true }).replace(/\s/g, "")
                  }
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--border-strong))" }}
                  content={<ChartTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="hsl(var(--brand))"
                  strokeWidth={2}
                  fill="url(#nwfill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
