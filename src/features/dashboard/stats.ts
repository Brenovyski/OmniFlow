import type { Transaction } from "@/features/transactions/schemas";
import { parseISODate } from "@/lib/format";

import { rangeWindow, type TimeRange } from "./time-range-chips";

const BUCKETS = 7;

export interface RangeKpiStats {
  income: number;
  expense: number;
  invested: number;
  netWorth: number;
  incomeSeries: number[];
  expenseSeries: number[];
  investedSeries: number[];
  netWorthSeries: number[];
  prior: {
    income: number;
    expense: number;
    invested: number;
    netWorth: number;
  };
}

/**
 * Net-worth delta contribution of a single non-deleted transaction.
 * Transfers net to zero across all accounts; investments and earnings add;
 * expenses subtract.
 */
function netDelta(t: Transaction): number {
  if (t.deleted_at) return 0;
  if (t.type === "earning" || t.type === "investment") return t.amount_cents;
  if (t.type === "expense") return -t.amount_cents;
  return 0;
}

/**
 * Compute KPI totals + 7-bucket sparkline series for the given range, plus
 * comparable totals for the previous window (for MoM-style deltas).
 *
 * Net worth at any historic date d is reconstructed from the live total:
 *   netWorth(d) = currentTotal − Σ netDelta(tx where date > d)
 */
export function computeRangeStats(
  range: TimeRange,
  transactions: Transaction[],
  currentTotal: number,
  now: Date = new Date(),
): RangeKpiStats {
  const { start, end, prevStart, prevEnd } = rangeWindow(range, now);

  const totalMs = end.getTime() - start.getTime();
  const bucketMs = totalMs / BUCKETS;

  const incomeSeries = new Array(BUCKETS).fill(0);
  const expenseSeries = new Array(BUCKETS).fill(0);
  const investedSeries = new Array(BUCKETS).fill(0);

  let income = 0;
  let expense = 0;
  let invested = 0;
  let prevIncome = 0;
  let prevExpense = 0;
  let prevInvested = 0;

  // Net worth snapshots at each bucket boundary + current/prior range ends.
  // Compute by walking *all* transactions and subtracting future contribution
  // from currentTotal — single pass per snapshot.
  const bucketEnds: Date[] = [];
  for (let i = 0; i < BUCKETS; i++) {
    bucketEnds.push(new Date(start.getTime() + bucketMs * (i + 1)));
  }
  const futureDeltas = new Array(BUCKETS).fill(0);
  let endFutureDelta = 0;
  let prevEndFutureDelta = 0;

  for (const t of transactions) {
    if (t.deleted_at) continue;
    const d = parseISODate(t.date);
    const ts = d.getTime();
    const delta = netDelta(t);

    // Per-bucket "future" delta accumulators: a tx counts toward bucket i's
    // future-from-bucket-end if date > bucketEnds[i].
    for (let i = 0; i < BUCKETS; i++) {
      if (ts > bucketEnds[i].getTime()) futureDeltas[i] += delta;
    }
    if (ts > end.getTime()) endFutureDelta += delta;
    if (ts > prevEnd.getTime()) prevEndFutureDelta += delta;

    // Range / prior-range flat totals + per-bucket attribution.
    if (ts >= start.getTime() && ts <= end.getTime()) {
      if (t.type === "earning") income += t.amount_cents;
      else if (t.type === "expense") expense += t.amount_cents;
      else if (t.type === "investment") invested += t.amount_cents;

      let idx = Math.floor((ts - start.getTime()) / bucketMs);
      if (idx >= BUCKETS) idx = BUCKETS - 1;
      if (idx >= 0) {
        if (t.type === "earning") incomeSeries[idx] += t.amount_cents;
        else if (t.type === "expense") expenseSeries[idx] += t.amount_cents;
        else if (t.type === "investment")
          investedSeries[idx] += t.amount_cents;
      }
    } else if (ts >= prevStart.getTime() && ts <= prevEnd.getTime()) {
      if (t.type === "earning") prevIncome += t.amount_cents;
      else if (t.type === "expense") prevExpense += t.amount_cents;
      else if (t.type === "investment") prevInvested += t.amount_cents;
    }
  }

  const netWorth = currentTotal - endFutureDelta;
  const priorNetWorth = currentTotal - prevEndFutureDelta;
  const netWorthSeries = futureDeltas.map((d) => currentTotal - d);

  return {
    income,
    expense,
    invested,
    netWorth,
    incomeSeries,
    expenseSeries,
    investedSeries,
    netWorthSeries,
    prior: {
      income: prevIncome,
      expense: prevExpense,
      invested: prevInvested,
      netWorth: priorNetWorth,
    },
  };
}
