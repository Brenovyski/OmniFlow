import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
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
};

const NONE_CATEGORY = "__none__";

const FormSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amount: z.string().min(1, "Required"),
  account_id: z.string().min(1, "Pick an account"),
  category_id: z.string(),
  date: z.date({ message: "Pick a date" }),
  description: z.string().min(1, "Required").max(140, "Too long"),
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
  return (cents / 100).toLocaleString("pt-BR", {
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

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial
      ? {
          type: initial.type,
          amount: centsToInput(initial.amount_cents),
          account_id: initial.account_id,
          category_id: initial.category_id ?? NONE_CATEGORY,
          date: parseISODate(initial.date),
          description: initial.description,
        }
      : {
          type: "expense",
          amount: "",
          account_id: "",
          category_id: NONE_CATEGORY,
          date: new Date(),
          description: "",
        },
  });

  // Auto-pick first account on create when accounts load.
  useEffect(() => {
    if (initial) return;
    if (
      !form.getValues("account_id") &&
      accountsQ.data &&
      accountsQ.data.length > 0
    ) {
      form.setValue("account_id", accountsQ.data[0]!.id);
    }
  }, [accountsQ.data, form, initial]);

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
      category_id:
        values.category_id === NONE_CATEGORY ? null : values.category_id,
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
            placeholder="0,00"
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
          placeholder="Pão de Açúcar, Salário, …"
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
          <Label htmlFor="tx-account">Account</Label>
          <Controller
            control={form.control}
            name="account_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="tx-account">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {(accountsQ.data ?? []).map((a) => (
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
                  {(categoriesQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
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
