import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateTransaction,
  useUpdateTransaction,
} from "@/features/transactions/mutations";
import { TransactionForm } from "@/features/transactions/transaction-form";
import { useModalStore } from "@/stores/modal-store";

export function TransactionDialog() {
  const open = useModalStore((s) => s.txDialogOpen);
  const setOpen = useModalStore((s) => s.setTxDialogOpen);
  const close = useModalStore((s) => s.closeTxDialog);
  const editing = useModalStore((s) => s.editingTx);
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const [error, setError] = useState<string | null>(null);

  const isEdit = editing !== null;
  const submitting = create.isPending || update.isPending;

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
          <DialogTitle>
            {isEdit ? "Edit transaction" : "New transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details below."
              : "Log money flowing in, out, or around."}
          </DialogDescription>
        </DialogHeader>
        <TransactionForm
          initial={editing}
          submitting={submitting}
          onCancel={close}
          onSubmit={(input) => {
            setError(null);
            const onSuccess = () => close();
            const onError = (err: unknown) =>
              setError(err instanceof Error ? err.message : "Failed to save");

            if (editing) {
              update.mutate(
                { id: editing.id, patch: input },
                { onSuccess, onError },
              );
            } else {
              create.mutate(input, { onSuccess, onError });
            }
          }}
        />
        {error && <p className="text-center text-xs text-expense">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
