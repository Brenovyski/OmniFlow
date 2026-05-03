import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Sparkline } from "./sparkline";

type Tone = "income" | "expense" | "invest" | "text";

interface KpiCardProps {
  label: string;
  cents: number;
  /** spark series for the active range; ~7 points */
  series: number[];
  /** prior-window total in cents, used to compute % delta */
  priorCents?: number;
  tone?: Tone;
  /** for expense, "up" is bad; flip the polarity of the delta indicator */
  invertDeltaPolarity?: boolean;
  loading?: boolean;
}

const TONE_TEXT: Record<Tone, string> = {
  income: "text-income",
  expense: "text-expense",
  invest: "text-invest",
  text: "text-text",
};

function formatDelta(cents: number, priorCents: number | undefined) {
  if (priorCents === undefined) return null;
  if (priorCents === 0) {
    if (cents === 0) return { pct: 0, dir: "flat" as const };
    return { pct: null, dir: cents > 0 ? "up" : ("down" as const) };
  }
  const pct = ((cents - priorCents) / Math.abs(priorCents)) * 100;
  const dir = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return { pct, dir } as { pct: number | null; dir: "up" | "down" | "flat" };
}

export function KpiCard({
  label,
  cents,
  series,
  priorCents,
  tone = "text",
  invertDeltaPolarity = false,
  loading = false,
}: KpiCardProps) {
  const delta = formatDelta(cents, priorCents);
  const goodDirection = invertDeltaPolarity ? "down" : "up";
  const deltaToneClass =
    delta?.dir === "flat"
      ? "text-text-faint"
      : delta?.dir === goodDirection
        ? "text-income"
        : "text-expense";
  const Arrow =
    delta?.dir === "up"
      ? ArrowUpRight
      : delta?.dir === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5 pt-5">
        <div className="text-xs font-medium uppercase tracking-wider text-text-faint">
          {label}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div
            className={cn(
              "num font-display text-2xl font-semibold tracking-tight",
              TONE_TEXT[tone],
            )}
          >
            {loading ? (
              <span className="text-text-faint">—</span>
            ) : (
              fmtMoney(cents)
            )}
          </div>
          <Sparkline values={series} tone={tone} className="w-24" />
        </div>
        <div className="flex items-center gap-1 text-xs">
          {delta ? (
            <>
              <Arrow className={cn("size-3.5", deltaToneClass)} />
              <span className={cn("num font-medium", deltaToneClass)}>
                {delta.pct === null
                  ? "—"
                  : `${delta.pct >= 0 ? "+" : ""}${delta.pct.toFixed(1)}%`}
              </span>
              <span className="text-text-faint">vs prior period</span>
            </>
          ) : (
            <span className="text-text-faint">No prior data</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
