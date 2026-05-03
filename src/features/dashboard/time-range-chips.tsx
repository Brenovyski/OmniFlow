import { useSearchParams } from "react-router-dom";

import { cn } from "@/lib/utils";

export const TIME_RANGES = ["7d", "30d", "mtd", "ytd"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

const DEFAULT_RANGE: TimeRange = "30d";

const RANGE_LABEL: Record<TimeRange, string> = {
  "7d": "7d",
  "30d": "30d",
  mtd: "MTD",
  ytd: "YTD",
};

function isTimeRange(value: string | null): value is TimeRange {
  return !!value && (TIME_RANGES as readonly string[]).includes(value);
}

export function useTimeRange(): [TimeRange, (next: TimeRange) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("range");
  const range = isTimeRange(raw) ? raw : DEFAULT_RANGE;

  const set = (next: TimeRange) => {
    const np = new URLSearchParams(params);
    if (next === DEFAULT_RANGE) np.delete("range");
    else np.set("range", next);
    setParams(np, { replace: true });
  };

  return [range, set];
}

export function TimeRangeChips() {
  const [range, setRange] = useTimeRange();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TIME_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRange(r)}
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            range === r
              ? "border-text bg-text text-background"
              : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
          )}
        >
          {RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

interface RangeWindow {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  /** number of bucket points the sparkline should render */
  buckets: number;
}

/**
 * Compute the start/end window for a given range, plus the equivalent prior
 * window used for MoM-style deltas. All dates are local-time, end of day on
 * `end`, midnight on `start`.
 */
export function rangeWindow(range: TimeRange, now = new Date()): RangeWindow {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start: Date;
  if (range === "7d") {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    start = new Date(now);
    start.setDate(start.getDate() - 29);
  } else if (range === "mtd") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
  }
  start.setHours(0, 0, 0, 0);

  const spanMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanMs);

  return { start, end, prevStart, prevEnd, buckets: 7 };
}
