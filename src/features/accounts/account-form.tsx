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
import { ACCOUNT_TYPES, type Account } from "./schemas";

const TYPE_LABEL: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  debit: "Debit / Checking",
  credit_card: "Credit card",
  voucher: "Voucher",
  brokerage: "Brokerage",
  cash: "Cash",
  savings: "Savings",
};

const CURRENCIES = ["BRL", "USD", "EUR"] as const;

const COLOR_PRESETS = [
  "#FACC15",
  "#0EA5E9",
  "#15803D",
  "#B91C1C",
  "#6D28D9",
  "#0F172A",
  "#22C55E",
  "#EA580C",
  "#A8A29E",
];

const FormSchema = z.object({
  name: z.string().min(1, "Required").max(60, "Too long"),
  type: z.enum(ACCOUNT_TYPES),
  short_name: z.string().max(20, "Too long").optional(),
  last4: z
    .string()
    .regex(/^\d{0,4}$/, "Up to 4 digits")
    .optional(),
  color: z.string().optional(),
  opening_balance: z.string(),
  currency: z.enum(CURRENCIES),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  initial?: Account | null;
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

export function AccountForm({ initial, onSubmit, onCancel, submitting }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          type: initial.type,
          short_name: initial.short_name ?? "",
          last4: initial.last4 ?? "",
          color: initial.color ?? COLOR_PRESETS[0],
          opening_balance: centsToInput(initial.opening_balance_cents),
          currency: (CURRENCIES as readonly string[]).includes(initial.currency)
            ? (initial.currency as (typeof CURRENCIES)[number])
            : "BRL",
        }
      : {
          name: "",
          type: "debit",
          short_name: "",
          last4: "",
          color: COLOR_PRESETS[0],
          opening_balance: "",
          currency: "BRL",
        },
  });

  const handleSubmit = form.handleSubmit((values) => {
    const cents = values.opening_balance.trim()
      ? parseAmountToCents(values.opening_balance)
      : 0;
    if (cents === null) {
      form.setError("opening_balance", { message: "Enter a valid amount" });
      return;
    }
    onSubmit({
      name: values.name.trim(),
      type: values.type,
      short_name: values.short_name?.trim() || null,
      last4: values.last4?.trim() || null,
      color: values.color ?? null,
      icon: null,
      opening_balance_cents: cents,
      currency: values.currency,
    });
  });

  const errors = form.formState.errors;
  const selectedColor = form.watch("color");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acc-name">Name</Label>
        <Input
          id="acc-name"
          placeholder="Checking, Brokerage, …"
          {...form.register("name")}
        />
        {errors.name && (
          <span className="text-xs text-expense">{errors.name.message}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-type">Type</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="acc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
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

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-short">Short label</Label>
          <Input
            id="acc-short"
            placeholder="CC, VR, …"
            maxLength={20}
            {...form.register("short_name")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-last4">Last 4 digits</Label>
          <Input
            id="acc-last4"
            placeholder="1234"
            maxLength={4}
            inputMode="numeric"
            {...form.register("last4")}
          />
          {errors.last4 && (
            <span className="text-xs text-expense">{errors.last4.message}</span>
          )}
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

      <div className="flex flex-col gap-1.5">
        <Label>Color</Label>
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => field.onChange(c)}
                  aria-label={`Color ${c}`}
                  className={
                    "h-7 w-7 rounded-full border-2 transition-transform " +
                    (selectedColor === c
                      ? "border-text scale-110"
                      : "border-transparent hover:scale-105")
                  }
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        />
      </div>

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
