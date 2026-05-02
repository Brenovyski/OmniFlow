import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateTransaction } from "@/features/transactions/mutations";
import { TransactionForm } from "@/features/transactions/transaction-form";
import { useModalStore } from "@/stores/modal-store";

export function TransactionDialog() {
  const open = useModalStore((s) => s.newTxOpen);
  const setOpen = useModalStore((s) => s.setNewTxOpen);
  const closeNewTx = useModalStore((s) => s.closeNewTx);
  const create = useCreateTransaction();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New transaction</DialogTitle>
          <DialogDescription>
            Log money flowing in, out, or around.
          </DialogDescription>
        </DialogHeader>
        <TransactionForm
          submitting={create.isPending}
          onCancel={closeNewTx}
          onSubmit={(input) => {
            setError(null);
            create.mutate(input, {
              onSuccess: () => closeNewTx(),
              onError: (err) =>
                setError(err instanceof Error ? err.message : "Failed to save"),
            });
          }}
        />
        {error && (
          <p className="text-center text-xs text-expense">{error}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
