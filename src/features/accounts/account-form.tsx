import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseAmountToCents } from "@/lib/format";

import type { NewAccountInput } from "./mutations";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABEL,
  type Account,
} from "./schemas";

const CURRENCIES = ["BRL", "USD", "EUR"] as const;

const FormSchema = z.object({
  type: z.enum(ACCOUNT_TYPES),
  opening_balance: z.string(),
  credit_limit: z.string().optional(),
  currency: z.enum(CURRENCIES),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  initial?: Account | null;
  /** Source id this account belongs to (or will belong to on create). */
  sourceId: string;
  onSubmit: (input: NewAccountInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AccountForm({
  initial,
  sourceId,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial
      ? {
          type: initial.type,
          opening_balance: centsToInput(initial.opening_balance_cents),
          credit_limit:
            initial.credit_limit_cents != null
              ? centsToInput(initial.credit_limit_cents)
              : "",
          currency: (CURRENCIES as readonly string[]).includes(initial.currency)
            ? (initial.currency as (typeof CURRENCIES)[number])
            : "BRL",
        }
      : {
          type: "checking",
          opening_balance: "",
          credit_limit: "",
          currency: "BRL",
        },
  });

  const selectedType = form.watch("type");
  const isChecking = selectedType === "checking";

  const handleSubmit = form.handleSubmit((values) => {
    const cents = values.opening_balance.trim()
      ? parseAmountToCents(values.opening_balance)
      : 0;
    if (cents === null) {
      form.setError("opening_balance", { message: "Enter a valid amount" });
      return;
    }
    let creditLimit: number | null = null;
    if (isChecking && values.credit_limit && values.credit_limit.trim()) {
      const ll = parseAmountToCents(values.credit_limit);
      if (ll === null) {
        form.setError("credit_limit", { message: "Enter a valid amount" });
        return;
      }
      creditLimit = ll;
    }
    onSubmit({
      source_id: sourceId,
      // Account name is derived from the type label; the user no longer
      // names accounts (the parent source is what carries identity).
      name: ACCOUNT_TYPE_LABEL[values.type],
      type: values.type,
      short_name: null,
      last4: null,
      // Account color is inherited from the parent source — see dashboard
      // surfaces, which read source.color via the display helpers.
      color: null,
      icon: null,
      opening_balance_cents: cents,
      credit_limit_cents: creditLimit,
      currency: values.currency,
    });
  });

  const errors = form.formState.errors;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-type">Type</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="acc-type">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCOUNT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-currency">Currency</Label>
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="acc-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acc-opening">Opening balance</Label>
        <Input
          id="acc-opening"
          inputMode="decimal"
          placeholder="0.00"
          {...form.register("opening_balance")}
        />
        <span className="text-[11.5px] text-text-faint">
          Balance before the first transaction. Leave blank for zero.
        </span>
        {errors.opening_balance && (
          <span className="text-xs text-expense">
            {errors.opening_balance.message}
          </span>
        )}
      </div>

      {isChecking && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-limit">Credit card limit</Label>
          <Input
            id="acc-limit"
            inputMode="decimal"
            placeholder="0.00"
            {...form.register("credit_limit")}
          />
          <span className="text-[11.5px] text-text-faint">
            Total credit card spending cap attached to this checking. Leave
            blank if no card is linked.
          </span>
          {errors.credit_limit && (
            <span className="text-xs text-expense">
              {errors.credit_limit.message}
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Saving…"
            : initial
              ? "Save changes"
              : "Add account"}
        </Button>
      </div>
    </form>
  );
}
