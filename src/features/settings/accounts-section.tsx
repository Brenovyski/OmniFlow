import { Archive, Pencil, Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountForm } from "@/features/accounts/account-form";
import { useAccountBalances } from "@/features/accounts/balances-queries";
import {
  useArchiveAccount,
  useCreateAccount,
  useUpdateAccount,
} from "@/features/accounts/mutations";
import { useAccounts } from "@/features/accounts/queries";
import type { Account } from "@/features/accounts/schemas";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<Account["type"], string> = {
  debit: "Debit",
  credit_card: "Credit card",
  voucher: "Voucher",
  brokerage: "Brokerage",
  cash: "Cash",
  savings: "Savings",
};

export function AccountsSection() {
  const accountsQ = useAccounts();
  const balancesQ = useAccountBalances();
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const archive = useArchiveAccount();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const accounts = accountsQ.data ?? [];
  const balances = balancesQ.data;
  const visible = showArchived
    ? accounts
    : accounts.filter((a) => !a.archived_at);
  const submitting = create.isPending || update.isPending;

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Sources</h2>
          <p className="text-sm text-text-muted">
            Where your money lives — credit cards, debit accounts, vouchers,
            brokerages.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          Add source
        </Button>
      </div>

      {accountsQ.isLoading ? (
        <div className="rounded-card border border-border bg-surface-2 px-4 py-8 text-center text-sm text-text-muted">
          Loading sources…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-2 px-4 py-8 text-center text-sm text-text-muted">
          No sources yet. Add one above.
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Currency</Th>
                <Th className="text-right">Balance</Th>
                <Th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {visible.map((acc) => {
                const balance = balances?.get(acc.id);
                const isArchived = !!acc.archived_at;
                return (
                  <tr
                    key={acc.id}
                    className={cn(
                      "group border-b border-border last:border-b-0 hover:bg-surface-2/60",
                      isArchived && "opacity-60",
                    )}
                  >
                    <Td>
                      <div className="flex items-center gap-2">
                        {acc.color && (
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ background: acc.color }}
                          />
                        )}
                        <div>
                          <div className="font-medium text-text">
                            {acc.name}
                            {isArchived && (
                              <span className="ml-2 text-[10.5px] font-medium uppercase tracking-wider text-text-faint">
                                archived
                              </span>
                            )}
                          </div>
                          {acc.short_name && (
                            <div className="text-[11.5px] text-text-faint">
                              {acc.short_name}
                              {acc.last4 && ` · ${acc.last4}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-text-muted">{TYPE_LABEL[acc.type]}</Td>
                    <Td className="text-text-muted">{acc.currency}</Td>
                    <Td className="num text-right font-semibold">
                      {balancesQ.isLoading ? (
                        <span className="text-text-faint">…</span>
                      ) : balance !== undefined ? (
                        fmtMoney(balance, { currency: acc.currency })
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(acc);
                            setDialogOpen(true);
                          }}
                          className="rounded-md p-1 text-text-faint hover:bg-surface-2 hover:text-text"
                          aria-label={`Edit ${acc.name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        {!isArchived && (
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(acc)}
                            className="rounded-md p-1 text-text-faint hover:bg-surface-2 hover:text-text"
                            aria-label={`Archive ${acc.name}`}
                          >
                            <Archive className="size-4" />
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowArchived((v) => !v)}
        className="self-start text-xs text-text-faint hover:text-text-muted"
      >
        {showArchived ? "Hide archived" : "Show archived"}
      </button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit source" : "New source"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details below."
                : "Add an account, card, voucher, or brokerage."}
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            initial={editing}
            submitting={submitting}
            onCancel={closeDialog}
            onSubmit={(input) => {
              if (editing) {
                update.mutate(
                  { id: editing.id, patch: input },
                  { onSuccess: closeDialog },
                );
              } else {
                create.mutate(input, { onSuccess: closeDialog });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(next) => {
          if (!next) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this source?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget && (
                <>
                  &ldquo;{archiveTarget.name}&rdquo; will be hidden from new
                  transactions and dropdowns. Existing transactions still
                  reference it. You can unarchive later from this page.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveTarget) {
                  archive.mutate(archiveTarget.id);
                  setArchiveTarget(null);
                }
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
        "px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-text-faint",
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
    <td className={cn("px-4 py-3 text-[13.5px] align-middle", className)}>
      {children}
    </td>
  );
}
