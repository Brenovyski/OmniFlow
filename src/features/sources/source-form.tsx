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
import { ACCOUNT_TYPE_LABEL } from "@/features/accounts/schemas";
import { parseAmountToCents } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { NewSourceInput } from "./mutations";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  SOURCE_KINDS,
  SOURCE_KIND_LABEL,
  type PaymentMethod,
  type Source,
  type SourceKind,
} from "./schemas";

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

// Account kinds we offer at source-creation time. (Account kinds are the same
// values stored in `accounts.type`. cash and voucher live as payment methods
// instead, not as accounts.)
const ACCOUNT_OPTIONS = ["checking", "savings", "brokerage"] as const;

type AccountKind = (typeof ACCOUNT_OPTIONS)[number];

const FormSchema = z.object({
  name: z.string().min(1, "Required").max(60, "Too long"),
  short_name: z.string().max(20, "Too long").optional(),
  kind: z.enum(SOURCE_KINDS),
  color: z.string(),
  methods: z.array(z.enum(PAYMENT_METHODS)).min(0),
  // create-only: per-account toggles & their balances
  accounts: z.record(
    z.enum(ACCOUNT_OPTIONS),
    z
      .object({
        enabled: z.boolean(),
        opening_balance: z.string().optional(),
        credit_limit: z.string().optional(),
      })
      .partial(),
  ),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  initial?: Source | null;
  initialMethods?: PaymentMethod[];
  /** Submit handler — for create only the form provides accounts to seed. */
  onSubmit: (input: NewSourceInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function SourceForm({
  initial,
  initialMethods,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const isEdit = !!initial;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          short_name: initial.short_name ?? "",
          kind: initial.kind,
          color: initial.color ?? COLOR_PRESETS[0]!,
          methods: initialMethods ?? [],
          accounts: emptyAccountsMap(),
        }
      : {
          name: "",
          short_name: "",
          kind: "bank",
          color: COLOR_PRESETS[0]!,
          methods: ["pix", "debit_card", "credit_card", "transfer"],
          accounts: defaultAccountsMap(),
        },
  });

  const errors = form.formState.errors;
  const selectedColor = form.watch("color");

  const handleSubmit = form.handleSubmit((values) => {
    const accounts: NewSourceInput["accounts"] = [];

    if (!isEdit) {
      for (const kind of ACCOUNT_OPTIONS) {
        const cfg = values.accounts[kind];
        if (!cfg?.enabled) continue;
        const opening = cfg.opening_balance?.trim()
          ? parseAmountToCents(cfg.opening_balance)
          : 0;
        if (opening === null) {
          form.setError(`accounts.${kind}.opening_balance` as const, {
            message: "Enter a valid amount",
          });
          return;
        }
        let credit: number | null = null;
        if (kind === "checking" && cfg.credit_limit && cfg.credit_limit.trim()) {
          const ll = parseAmountToCents(cfg.credit_limit);
          if (ll === null) {
            form.setError(`accounts.${kind}.credit_limit` as const, {
              message: "Enter a valid amount",
            });
            return;
          }
          credit = ll;
        }
        accounts.push({
          name: ACCOUNT_TYPE_LABEL[kind],
          type: kind,
          opening_balance_cents: opening,
          credit_limit_cents: credit,
        });
      }
    }

    onSubmit({
      name: values.name.trim(),
      short_name: values.short_name?.trim() || null,
      kind: values.kind,
      color: values.color,
      methods: values.methods,
      accounts,
    });
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="src-name">Name</Label>
          <Input
            id="src-name"
            placeholder="BTG Pactual, Nubank, Brex…"
            {...form.register("name")}
          />
          {errors.name && (
            <span className="text-xs text-expense">{errors.name.message}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="src-nick">Nickname</Label>
          <Input
            id="src-nick"
            placeholder="BTG, Nu, Brex…"
            maxLength={20}
            {...form.register("short_name")}
          />
          {errors.short_name && (
            <span className="text-xs text-expense">
              {errors.short_name.message}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="src-kind">Kind</Label>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="src-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {SOURCE_KIND_LABEL[k as SourceKind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
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
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    selectedColor === c
                      ? "border-text scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Payment methods at this source</Label>
        <Controller
          control={form.control}
          name="methods"
          render={({ field }) => {
            const set = new Set(field.value);
            const toggle = (m: PaymentMethod) => {
              const next = new Set(set);
              if (next.has(m)) next.delete(m);
              else next.add(m);
              field.onChange(Array.from(next));
            };
            return (
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((m) => {
                  const active = set.has(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggle(m)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-brand bg-brand/15 text-text"
                          : "border-border bg-surface text-text-muted hover:border-border-strong",
                      )}
                    >
                      {PAYMENT_METHOD_LABEL[m]}
                    </button>
                  );
                })}
              </div>
            );
          }}
        />
        <span className="text-[11.5px] text-text-faint">
          Only methods you enable here will appear in the transaction form for
          this source.
        </span>
      </div>

      {!isEdit && (
        <div className="flex flex-col gap-2">
          <Label>Accounts inside this source</Label>
          <span className="text-[11.5px] text-text-faint">
            Pick which accounts to create. You can add more later from the
            source's row.
          </span>
          <Controller
            control={form.control}
            name="accounts"
            render={({ field }) => {
              const update = (kind: AccountKind, patch: Partial<FormValues["accounts"][AccountKind]>) => {
                field.onChange({
                  ...field.value,
                  [kind]: { ...(field.value?.[kind] ?? {}), ...patch },
                });
              };
              return (
                <div className="flex flex-col gap-2">
                  {ACCOUNT_OPTIONS.map((kind) => {
                    const cfg = field.value?.[kind] ?? {};
                    const enabled = !!cfg.enabled;
                    return (
                      <div
                        key={kind}
                        className={cn(
                          "rounded-card border bg-surface-2 p-3 transition-colors",
                          enabled ? "border-border-strong" : "border-border",
                        )}
                      >
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border accent-brand"
                            checked={enabled}
                            onChange={(e) =>
                              update(kind, { enabled: e.target.checked })
                            }
                          />
                          <span className="text-sm font-medium text-text">
                            {ACCOUNT_TYPE_LABEL[kind]}
                          </span>
                        </label>
                        {enabled && (
                          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                              <Label className="text-[11px] uppercase tracking-wider text-text-faint">
                                Opening balance
                              </Label>
                              <Input
                                inputMode="decimal"
                                placeholder="0.00"
                                value={cfg.opening_balance ?? ""}
                                onChange={(e) =>
                                  update(kind, { opening_balance: e.target.value })
                                }
                              />
                            </div>
                            {kind === "checking" && (
                              <div className="flex flex-col gap-1">
                                <Label className="text-[11px] uppercase tracking-wider text-text-faint">
                                  Credit card limit
                                </Label>
                                <Input
                                  inputMode="decimal"
                                  placeholder="0.00"
                                  value={cfg.credit_limit ?? ""}
                                  onChange={(e) =>
                                    update(kind, { credit_limit: e.target.value })
                                  }
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Add source"}
        </Button>
      </div>
    </form>
  );
}

function emptyAccountsMap(): FormValues["accounts"] {
  const out = {} as FormValues["accounts"];
  for (const k of ACCOUNT_OPTIONS) out[k] = { enabled: false };
  return out;
}

function defaultAccountsMap(): FormValues["accounts"] {
  return {
    checking: { enabled: true },
    savings: { enabled: false },
    brokerage: { enabled: false },
  };
}
