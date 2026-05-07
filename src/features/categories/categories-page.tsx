import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

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
import { useTransactions } from "@/features/transactions/queries";

import { CategoryCard } from "./category-card";
import { CategoryForm } from "./category-form";
import {
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "./mutations";
import { useCategories } from "./queries";
import {
  CATEGORY_TYPES,
  type Category,
  type CategoryType,
} from "./schemas";

const TYPE_LABEL: Record<CategoryType, string> = {
  expense: "Expenses",
  earning: "Earnings",
  investment: "Investments",
};

export function CategoriesPage() {
  const categoriesQ = useCategories();
  const transactionsQ = useTransactions();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const categories = categoriesQ.data ?? [];
  const transactions = transactionsQ.data ?? [];
  const submitting = create.isPending || update.isPending;

  // Active count per category id (excludes soft-deleted via the query layer
  // already, but be defensive).
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.deleted_at) continue;
      if (!tx.category_id) continue;
      map.set(tx.category_id, (map.get(tx.category_id) ?? 0) + 1);
    }
    return map;
  }, [transactions]);

  const grouped = useMemo(() => {
    const sorted = [...categories].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    const out: Record<CategoryType, Category[]> = {
      expense: [],
      earning: [],
      investment: [],
    };
    for (const c of sorted) out[c.type].push(c);
    return out;
  }, [categories]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const total = categories.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            Categories
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {categoriesQ.isLoading
              ? "Loading…"
              : `${total} categor${total === 1 ? "y" : "ies"} — how you label every flow.`}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          New category
        </Button>
      </div>

      {categoriesQ.isLoading ? (
        <div className="rounded-card border border-border bg-surface px-4 py-16 text-center text-sm text-text-muted">
          Loading categories…
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-5 py-16 text-center">
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-text-faint">
            Empty
          </span>
          <div className="font-display text-base font-semibold">
            No categories yet
          </div>
          <p className="max-w-sm text-sm text-text-muted">
            Create your first category to start labeling transactions.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {CATEGORY_TYPES.map((type) => {
            const list = grouped[type];
            if (list.length === 0) return null;
            return (
              <section key={type} className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-text-muted">
                    {TYPE_LABEL[type]}
                  </h2>
                  <span className="num text-xs text-text-faint">
                    {list.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {list.map((c) => (
                    <CategoryCard
                      key={c.id}
                      category={c}
                      count={counts.get(c.id) ?? 0}
                      onEdit={() => {
                        setEditing(c);
                        setDialogOpen(true);
                      }}
                      onDelete={() => setDeleteTarget(c)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

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
              {editing ? "Edit category" : "New category"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details below."
                : "Categories label transactions so charts and budgets group them."}
            </DialogDescription>
          </DialogHeader>
          <CategoryForm
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
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  &ldquo;{deleteTarget.name}&rdquo; will be removed permanently.
                  This can't be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  remove.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
