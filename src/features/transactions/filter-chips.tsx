import { useSearchParams } from "react-router-dom";

import { sourceLabel } from "@/features/sources/display";
import { useSources } from "@/features/sources/queries";
import { TRANSACTION_TYPES } from "@/features/transactions/schemas";
import { cn } from "@/lib/utils";

const TYPE_LABEL = {
  earning: "Earnings",
  expense: "Expenses",
  investment: "Investments",
  transfer: "Transfers",
} as const;

const TYPE_DOT = {
  earning: "bg-income",
  expense: "bg-expense",
  investment: "bg-invest",
  transfer: "bg-text-faint",
} as const;

export interface FilterState {
  type: "all" | (typeof TRANSACTION_TYPES)[number];
  sourceId: "all" | string;
}

export function useFilterState(): [
  FilterState,
  (next: Partial<FilterState>) => void,
] {
  const [params, setParams] = useSearchParams();
  const type = (params.get("type") ?? "all") as FilterState["type"];
  const sourceId = params.get("source") ?? "all";

  const set = (next: Partial<FilterState>) => {
    const merged: FilterState = { type, sourceId, ...next };
    const np = new URLSearchParams(params);
    if (merged.type === "all") np.delete("type");
    else np.set("type", merged.type);
    if (merged.sourceId === "all") np.delete("source");
    else np.set("source", merged.sourceId);
    setParams(np, { replace: true });
  };

  return [{ type, sourceId }, set];
}

export function FilterChips() {
  const [filter, setFilter] = useFilterState();
  const sourcesQ = useSources();
  const sources = (sourcesQ.data ?? []).filter((s) => !s.archived_at);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          active={filter.type === "all"}
          onClick={() => setFilter({ type: "all" })}
        >
          All
        </Chip>
        {TRANSACTION_TYPES.map((t) => (
          <Chip
            key={t}
            active={filter.type === t}
            onClick={() => setFilter({ type: t })}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOT[t])} />
            {TYPE_LABEL[t]}
          </Chip>
        ))}
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            Source
          </span>
          <Chip
            active={filter.sourceId === "all"}
            onClick={() => setFilter({ sourceId: "all" })}
          >
            All sources
          </Chip>
          {sources.map((s) => (
            <Chip
              key={s.id}
              active={filter.sourceId === s.id}
              onClick={() => setFilter({ sourceId: s.id })}
            >
              {s.color && (
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: s.color }}
                />
              )}
              {sourceLabel(s)}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-text bg-text text-background"
          : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
