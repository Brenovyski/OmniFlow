import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Account } from "@/features/accounts/schemas";
import type { Category } from "@/features/categories/schemas";
import { useSoftDeleteTransaction } from "@/features/transactions/mutations";
import type { Transaction } from "@/features/transactions/schemas";
import { fmtDate, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/modal-store";

const TYPE_DOT: Record<Transaction["type"], string> = {
  earning: "bg-income",
  expense: "bg-expense",
  investment: "bg-invest",
};

const TYPE_COLOR: Record<Transaction["type"], string> = {
  earning: "text-income",
  expense: "text-expense",
  investment: "text-invest",
};

const TYPE_LABEL: Record<Transaction["type"], string> = {
  earning: "Earning",
  expense: "Expense",
  investment: "Investment",
};

interface Props {
  rows: Transaction[];
  accounts: Account[];
  categories: Category[];
}

export function TransactionsTable({ rows, accounts, categories }: Props) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const openEdit = useModalStore((s) => s.openEditTx);
  const softDelete = useSoftDeleteTransaction();
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th className="w-[88px]">Date</Th>
              <Th>Description</Th>
              <Th>Category</Th>
              <Th>Source</Th>
              <Th>Type</Th>
              <Th className="text-right">Amount</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => {
              const cat = tx.category_id
                ? categoryById.get(tx.category_id)
                : null;
              const acc = accountById.get(tx.account_id);
              const signedCents =
                tx.type === "expense" ? -tx.amount_cents : tx.amount_cents;
              return (
                <tr
                  key={tx.id}
                  className="group border-b border-border transition-colors last:border-b-0 hover:bg-surface-2/60"
                >
                  <Td className="num text-text-muted">{fmtDate(tx.date)}</Td>
                  <Td>
                    <div className="font-medium text-text">{tx.description}</div>
                    {acc && (
                      <div className="text-[11.5px] text-text-faint">
                        {acc.name}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {cat ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-text-muted">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: cat.color ?? "#A8A29E" }}
                        />
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-xs italic text-text-faint">
                        Uncategorized
                      </span>
                    )}
                  </Td>
                  <Td>
                    {acc ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-text"
                        title={`${acc.name} · ${acc.type}`}
                      >
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ background: acc.color ?? "#A8A29E" }}
                        />
                        {acc.short_name ?? acc.name}
                      </span>
                    ) : (
                      <span className="text-xs text-text-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-sm",
                          TYPE_DOT[tx.type],
                        )}
                      />
                      {TYPE_LABEL[tx.type]}
                    </span>
                  </Td>
                  <Td
                    className={cn(
                      "num text-right font-semibold",
                      TYPE_COLOR[tx.type],
                    )}
                  >
                    {fmtMoney(signedCents, { sign: tx.type === "earning" })}
                  </Td>
                  <Td className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded-md p-1 text-text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-text group-hover:opacity-100 data-[state=open]:opacity-100"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openEdit(tx)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setPendingDelete(tx)}
                          className="text-expense focus:text-expense"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  &ldquo;{pendingDelete.description}&rdquo; will be removed from
                  your active list. It stays in the database (soft delete) and
                  can be recovered later.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  softDelete.mutate(pendingDelete.id);
                  setPendingDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border-b border-border px-2 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-text-faint",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-2 py-3.5 text-[13.5px] align-middle", className)}>
      {children}
    </td>
  );
}
