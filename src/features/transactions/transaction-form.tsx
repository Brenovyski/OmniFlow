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
import type { Account } from "@/features/accounts/schemas";
import { useCategories } from "@/features/categories/queries";
import {
  methodsBySourceId,
  useSourcePaymentMethods,
  useSources,
} from "@/features/sources/queries";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  isPluggyManaged,
  type PaymentMethod,
} from "@/features/sources/schemas";
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
    source_id: z.string().min(1, "Pick a source"),
    account_id: z.string().min(1, "Pick an account"),
    payment_method: z.enum(PAYMENT_METHODS).optional(),
    transfer_source_id: z.string(),
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

function defaultMethodForAccount(
  account: Account | undefined,
): PaymentMethod | undefined {
  if (!account) return undefined;
  switch (account.type) {
    case "checking":
      return "pix";
    case "savings":
    case "brokerage":
      return "transfer";
    default:
      return undefined;
  }
}

export function TransactionForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: Props) {
  const accountsQ = useAccounts();
  const sourcesQ = useSources();
  const methodsQ = useSourcePaymentMethods();
  const categoriesQ = useCategories();

  const allAccounts = accountsQ.data ?? [];
  const allSources = sourcesQ.data ?? [];
  const methodsBySource = useMemo(
    () => methodsBySourceId(methodsQ.data ?? []),
    [methodsQ.data],
  );

  const activeSources = useMemo(
    () => allSources.filter((s) => !s.archived_at),
    [allSources],
  );

  // Resolve the source for an account id (used to back-fill the form on edit
  // and to keep the source picker in sync when an account is changed).
  const accountById = useMemo(() => {
    const m = new Map<string, Account>();
    for (const a of allAccounts) m.set(a.id, a);
    return m;
  }, [allAccounts]);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial
      ? {
          type: initial.type,
          amount: centsToInput(initial.amount_cents),
          source_id: accountById.get(initial.account_id)?.source_id ?? "",
          account_id: initial.account_id,
          payment_method: initial.payment_method ?? undefined,
          transfer_source_id: initial.transfer_account_id
            ? (accountById.get(initial.transfer_account_id)?.source_id ?? "")
            : "",
          transfer_account_id: initial.transfer_account_id ?? "",
          category_id: initial.category_id ?? NONE_CATEGORY,
          date: parseISODate(initial.date),
          description: initial.description,
        }
      : {
          type: "expense",
          amount: "",
          source_id: "",
          account_id: "",
          payment_method: undefined,
          transfer_source_id: "",
          transfer_account_id: "",
          category_id: NONE_CATEGORY,
          date: new Date(),
          description: "",
        },
  });

  const selectedType = form.watch("type");
  const sourceId = form.watch("source_id");
  const accountId = form.watch("account_id");
  const transferSourceId = form.watch("transfer_source_id");

  const isTransfer = selectedType === "transfer";

  // Accounts inside the chosen source, with a small filter by tx type so the
  // picker doesn't suggest a brokerage for an expense, etc. Keeps an archived
  // account visible if we're editing a tx that already references it.
  const accountsForSource = useMemo(() => {
    const inSource = allAccounts.filter(
      (a) => a.source_id === sourceId && !a.archived_at,
    );
    if (initial && initial.account_id) {
      const ensure = accountById.get(initial.account_id);
      if (ensure && ensure.source_id === sourceId && !inSource.some((a) => a.id === ensure.id)) {
        inSource.push(ensure);
      }
    }
    return filterAccountsByType(inSource, selectedType);
  }, [allAccounts, sourceId, selectedType, initial, accountById]);

  const accountsForTransferSource = useMemo(() => {
    const inSource = allAccounts.filter(
      (a) => a.source_id === transferSourceId && !a.archived_at,
    );
    return inSource.filter((a) => a.id !== accountId);
  }, [allAccounts, transferSourceId, accountId]);

  // Source's enabled methods. Empty list = nothing configured.
  const methodsForSource = useMemo(
    () => methodsBySource.get(sourceId) ?? [],
    [methodsBySource, sourceId],
  );

  // Auto-pick first MANUAL source on create. Pluggy-managed sources are
  // sync-only — never default to one.
  useEffect(() => {
    if (initial) return;
    const manual = activeSources.filter((s) => !isPluggyManaged(s));
    if (!form.getValues("source_id") && manual.length > 0) {
      form.setValue("source_id", manual[0]!.id);
    }
  }, [activeSources, form, initial]);

  // When source changes, reset account if it no longer belongs to the source.
  useEffect(() => {
    if (!sourceId) return;
    const current = form.getValues("account_id");
    if (current && accountById.get(current)?.source_id !== sourceId) {
      form.setValue("account_id", "");
    }
  }, [sourceId, form, accountById]);

  // Auto-pick first matching account when none is set.
  useEffect(() => {
    if (initial) return;
    const current = form.getValues("account_id");
    if (current) return;
    if (accountsForSource.length === 0) return;
    form.setValue("account_id", accountsForSource[0]!.id);
  }, [accountsForSource, form, initial]);

  // Default payment method when the account changes (only on create).
  useEffect(() => {
    if (initial) return;
    if (!accountId) return;
    const acc = accountById.get(accountId);
    const def = defaultMethodForAccount(acc);
    if (!def) return;
    // Only set if currently unset or invalid for the new source.
    const currentMethod = form.getValues("payment_method");
    if (!currentMethod || !methodsForSource.includes(currentMethod)) {
      if (methodsForSource.includes(def)) {
        form.setValue("payment_method", def);
      } else if (methodsForSource.length > 0) {
        form.setValue("payment_method", methodsForSource[0]);
      }
    }
  }, [accountId, methodsForSource, form, initial, accountById]);

  // Reset transfer-source when leaving transfer.
  useEffect(() => {
    if (!isTransfer) {
      if (form.getValues("transfer_source_id")) {
        form.setValue("transfer_source_id", "");
      }
      if (form.getValues("transfer_account_id")) {
        form.setValue("transfer_account_id", "");
      }
    } else if (!form.getValues("transfer_source_id")) {
      // default destination = same source
      form.setValue("transfer_source_id", sourceId);
    }
  }, [isTransfer, sourceId, form]);

  // Reset transfer-account if its source no longer matches.
  useEffect(() => {
    if (!isTransfer) return;
    const dest = form.getValues("transfer_account_id");
    if (dest && accountById.get(dest)?.source_id !== transferSourceId) {
      form.setValue("transfer_account_id", "");
    }
  }, [transferSourceId, isTransfer, form, accountById]);

  // Pick first valid destination automatically.
  useEffect(() => {
    if (!isTransfer) return;
    const dest = form.getValues("transfer_account_id");
    if (dest) return;
    if (accountsForTransferSource.length === 0) return;
    form.setValue("transfer_account_id", accountsForTransferSource[0]!.id);
  }, [accountsForTransferSource, isTransfer, form]);

  // Filter category dropdown by type (unchanged).
  const categoriesForType = useMemo(
    () => (categoriesQ.data ?? []).filter((c) => c.type === selectedType),
    [categoriesQ.data, selectedType],
  );

  useEffect(() => {
    const currentId = form.getValues("category_id");
    if (currentId === NONE_CATEGORY) return;
    const cat = (categoriesQ.data ?? []).find((c) => c.id === currentId);
    if (cat && cat.type !== selectedType) {
      form.setValue("category_id", NONE_CATEGORY);
    }
  }, [selectedType, categoriesQ.data, form]);

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
      payment_method:
        values.type === "transfer"
          ? "transfer"
          : (values.payment_method ?? null),
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
  const editingPluggyRow = !!initial?.pluggy_transaction_id;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {editingPluggyRow && (
        <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-text-muted">
          <strong className="text-text">Synced from Pluggy.</strong> Bank-truth
          fields (amount, date) cannot be edited. Your edits to other fields
          will not be overwritten by future syncs.
        </div>
      )}
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
            disabled={editingPluggyRow}
            title={
              editingPluggyRow
                ? "Bank-truth field — cannot be edited"
                : undefined
            }
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
          <Label htmlFor="tx-source">{isTransfer ? "From source" : "Source"}</Label>
          <Controller
            control={form.control}
            name="source_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="tx-source">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {activeSources.map((s) => {
                    // On CREATE, Pluggy-managed sources are sync-only.
                    // On EDIT, allow changes (still respects sticky-edit).
                    const lockForCreate = !initial && isPluggyManaged(s);
                    return (
                      <SelectItem
                        key={s.id}
                        value={s.id}
                        disabled={lockForCreate}
                      >
                        {s.name}
                        {lockForCreate && (
                          <span className="ml-2 text-text-faint">(sync only)</span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-account">{isTransfer ? "From account" : "Account"}</Label>
          <Controller
            control={form.control}
            name="account_id"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={accountsForSource.length === 0}
              >
                <SelectTrigger id="tx-account">
                  <SelectValue
                    placeholder={
                      accountsForSource.length === 0
                        ? "No accounts here"
                        : "Choose…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {accountsForSource.map((a) => (
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
      </div>

      {isTransfer ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-tsource">To source</Label>
            <Controller
              control={form.control}
              name="transfer_source_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tx-tsource">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-dest">To account</Label>
            <Controller
              control={form.control}
              name="transfer_account_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={accountsForTransferSource.length === 0}
                >
                  <SelectTrigger id="tx-dest">
                    <SelectValue
                      placeholder={
                        accountsForTransferSource.length === 0
                          ? "No accounts here"
                          : "Choose…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsForTransferSource.map((a) => (
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
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-method">Payment method</Label>
            <Controller
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) =>
                    field.onChange(v ? (v as PaymentMethod) : undefined)
                  }
                  disabled={methodsForSource.length === 0}
                >
                  <SelectTrigger id="tx-method">
                    <SelectValue
                      placeholder={
                        methodsForSource.length === 0
                          ? "Source has no methods"
                          : "Choose…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {methodsForSource.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
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
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Date</Label>
        <Controller
          control={form.control}
          name="date"
          render={({ field }) => (
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              disabled={editingPluggyRow}
            />
          )}
        />
        {editingPluggyRow && (
          <span className="text-[11px] text-text-faint">
            Bank-truth field — cannot be edited.
          </span>
        )}
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

function filterAccountsByType(
  accounts: Account[],
  txType: (typeof TRANSACTION_TYPES)[number],
): Account[] {
  switch (txType) {
    case "investment":
      // Investment inflows land in a brokerage account.
      return accounts.filter((a) => a.type === "brokerage");
    case "expense":
      // Don't expense from a brokerage; everything else is fair game.
      return accounts.filter((a) => a.type !== "brokerage");
    default:
      return accounts;
  }
}
