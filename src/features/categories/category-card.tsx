import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { iconFromName } from "./icons";
import type { Category, CategoryType } from "./schemas";

const TYPE_LABEL: Record<CategoryType, string> = {
  expense: "Expense",
  earning: "Earning",
  investment: "Investment",
};

const TYPE_TONE: Record<CategoryType, string> = {
  expense: "text-expense bg-expense/10 border-expense/20",
  earning: "text-income bg-income/10 border-income/20",
  investment: "text-invest bg-invest/10 border-invest/20",
};

interface Props {
  category: Category;
  count: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function CategoryCard({ category, count, onEdit, onDelete }: Props) {
  const Icon = iconFromName(category.icon);
  const color = category.color ?? "#A8A29E";
  const canDelete = count === 0;

  return (
    <div className="group relative flex flex-col gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div
          className="grid h-11 w-11 place-items-center rounded-card"
          style={{ background: `${color}1F`, color }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Category actions"
              className="rounded-md p-1 text-text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-text focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onDelete}
              disabled={!canDelete}
              className={cn(
                canDelete
                  ? "text-expense focus:bg-expense/10 focus:text-expense"
                  : undefined,
              )}
            >
              <Trash2 className="size-3.5" />
              {canDelete ? "Delete" : "Has transactions"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold text-text">
          {category.name}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider",
              TYPE_TONE[category.type],
            )}
          >
            {TYPE_LABEL[category.type]}
          </span>
          <span className="num text-xs text-text-faint">
            {count} {count === 1 ? "transaction" : "transactions"}
          </span>
        </div>
      </div>
    </div>
  );
}
