import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/features/accounts/queries";
import { useCategories } from "@/features/categories/queries";
import {
  TRANSACTION_TYPES,
  type Transaction,
} from "@/features/transactions/schemas";
import {
  parseAmountToCents,
  parseISODate,
  toISODate,
} from "@/lib/format";

import type { NewTransactionInput } from "./mutations";

const TYPE_LABEL: Record<(typeof TRANSACTION_TYPES)[number], string> = {
  expense: "Expense",
  earning: "Earning",
  investment: "Investment",
  transfer: "Transfer",
};

const NONE_CATEGORY = "__none__";

const FormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amount: z.string().min(1, "Required"),
    account_id: z.string().min(1, "Pick a source"),
    transfer_account_id: z.string(),
    category_id: z.string(),
    date: z.date({ message: "Pick a date" }),
    description: z.string().min(1, "Required").max(140, "Too long"),
  })
  .superRefine((v, ctx) => {
    if (v.type === "transfer") {
      if (!v.transfer_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transfer_account_id"],
          message: "Pick a destination",
        });
      } else if (v.transfer_account_id === v.account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transfer_account_id"],
          message: "Destination must differ from source",
        });
      }
    }
  });

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  initial?: Transaction | null;
  onSubmit: (input: NewTransactionInput) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TransactionForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: Props) {
  const accountsQ = useAccounts();
  const categoriesQ = useCategories();

  const allAccounts = accountsQ.data ?? [];
  // Active accounts (non-archived) for source/destination pickers.
  // Existing transactions can still reference an archived account, so when
  // editing we surface that account too.
  const activeAccounts = useMemo(() => {
    const active = allAccounts.filter((a) => !a.archived_at);
    if (initial) {
      const ensure = (id: string | null | undefined) => {
        if (!id) return;
        if (active.some((a) => a.id === id)) return;
        const archived = allAccounts.find((a) => a.id === id);
        if (archived) active.push(archived);
      };
      ensure(initial.account_id);
      ensure(initial.transfer_account_id);
    }
    return active;
  }, [allAccounts, initial]);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial
      ? {
          type: initial.type,
          amount: centsToInput(initial.amount_cents),
          account_id: initial.account_id,
          transfer_account_id: initial.transfer_account_id ?? "",
          category_id: initial.category_id ?? NONE_CATEGORY,
          date: parseISODate(initial.date),
          description: initial.description,
        }
      : {
          type: "expense",
          amount: "",
          account_id: "",
          transfer_account_id: "",
          category_id: NONE_CATEGORY,
          date: new Date(),
          description: "",
        },
  });

  // Auto-pick first active account on create when accounts load.
  useEffect(() => {
    if (initial) return;
    if (!form.getValues("account_id") && activeAccounts.length > 0) {
      form.setValue("account_id", activeAccounts[0]!.id);
    }
  }, [activeAccounts, form, initial]);

  const selectedType = form.watch("type");
  const sourceId = form.watch("account_id");

  const isTransfer = selectedType === "transfer";

  // Filter the category dropdown to the current transaction type.
  const categoriesForType = useMemo(
    () => (categoriesQ.data ?? []).filter((c) => c.type === selectedType),
    [categoriesQ.data, selectedType],
  );

  // When the type changes, drop a category that doesn't belong to the new type.
  useEffect(() => {
    const currentId = form.getValues("category_id");
    if (currentId === NONE_CATEGORY) return;
    const cat = (categoriesQ.data ?? []).find((c) => c.id === currentId);
    if (cat && cat.type !== selectedType) {
      form.setValue("category_id", NONE_CATEGORY);
    }
  }, [selectedType, categoriesQ.data, form]);

  // Switching away from transfer clears the destination so it can't sneak
  // through stale.
  useEffect(() => {
    if (!isTransfer && form.getValues("transfer_account_id")) {
      form.setValue("transfer_account_id", "");
    }
  }, [isTransfer, form]);

  // Switching to transfer auto-picks a different account as destination.
  useEffect(() => {
    if (!isTransfer) return;
    const dest = form.getValues("transfer_account_id");
    if (dest && dest !== sourceId) return;
    const candidate = activeAccounts.find((a) => a.id !== sourceId);
    if (candidate) form.setValue("transfer_account_id", candidate.id);
  }, [isTransfer, sourceId, activeAccounts, form]);

  const handleSubmit = form.handleSubmit((values) => {
    const cents = parseAmountToCents(values.amount);
    if (cents === null) {
      form.setError("amount", { message: "Enter a valid amount" });
      return;
    }
    onSubmit({
      type: values.type,
      amount_cents: cents,
      account_id: values.account_id,
      transfer_account_id:
        values.type === "transfer" ? values.transfer_account_id : null,
      category_id:
        values.type === "transfer"
          ? null
          : values.category_id === NONE_CATEGORY
            ? null
            : values.category_id,
      date: toISODate(values.date),
      description: values.description.trim(),
    });
  });

  const errors = form.formState.errors;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-type">Type</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="tx-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-amount">Amount (R$)</Label>
          <Input
            id="tx-amount"
            inputMode="decimal"
            placeholder="0.00"
            {...form.register("amount")}
          />
          {errors.amount && (
            <span className="text-xs text-expense">{errors.amount.message}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-description">Description</Label>
        <Input
          id="tx-description"
          placeholder={
            isTransfer
              ? "Move to brokerage, Pay credit card, …"
              : "Whole Foods, Salary, …"
          }
          {...form.register("description")}
        />
        {errors.description && (
          <span className="text-xs text-expense">
            {errors.description.message}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-account">{isTransfer ? "From" : "Source"}</Label>
          <Controller
            control={form.control}
            name="account_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="tx-account">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.account_id && (
            <span className="text-xs text-expense">
              {errors.account_id.message}
            </span>
          )}
        </div>

        {isTransfer ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-dest">To</Label>
            <Controller
              control={form.control}
              name="transfer_account_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tx-dest">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts
                      .filter((a) => a.id !== sourceId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.transfer_account_id && (
              <span className="text-xs text-expense">
                {errors.transfer_account_id.message}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-category">Category</Label>
            <Controller
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tx-category">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_CATEGORY}>No category</SelectItem>
                    {categoriesForType.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Date</Label>
        <Controller
          control={form.control}
          name="date"
          render={({ field }) => (
            <DatePicker value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.date && (
          <span className="text-xs text-expense">{errors.date.message}</span>
        )}
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Saving…"
            : (submitLabel ?? (initial ? "Save changes" : "Add transaction"))}
        </Button>
      </div>
    </form>
  );
}
