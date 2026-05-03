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

  const isEdit = editing !== null;
  const submitting = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            if (editing) {
              update.mutate(
                { id: editing.id, patch: input },
                { onSuccess: close },
              );
            } else {
              create.mutate(input, { onSuccess: close });
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
