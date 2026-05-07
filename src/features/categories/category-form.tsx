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
import { cn } from "@/lib/utils";

import {
  CATEGORY_ICON_NAMES,
  DEFAULT_ICON,
  iconFromName,
} from "./icons";
import type { NewCategoryInput } from "./mutations";
import { CATEGORY_TYPES, type Category } from "./schemas";

const TYPE_LABEL: Record<(typeof CATEGORY_TYPES)[number], string> = {
  expense: "Expense",
  earning: "Earning",
  investment: "Investment",
};

const COLOR_PRESETS = [
  "#FACC15",
  "#15803D",
  "#0EA5E9",
  "#6D28D9",
  "#B91C1C",
  "#EA580C",
  "#DB2777",
  "#0891B2",
  "#A16207",
  "#0F172A",
];

const FormSchema = z.object({
  name: z.string().min(1, "Required").max(60, "Too long"),
  type: z.enum(CATEGORY_TYPES),
  color: z.string(),
  icon: z.string(),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  initial?: Category | null;
  onSubmit: (input: NewCategoryInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function CategoryForm({ initial, onSubmit, onCancel, submitting }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          type: initial.type,
          color: initial.color ?? COLOR_PRESETS[0]!,
          icon: initial.icon ?? DEFAULT_ICON,
        }
      : {
          name: "",
          type: "expense",
          color: COLOR_PRESETS[0]!,
          icon: DEFAULT_ICON,
        },
  });

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit({
      name: values.name.trim(),
      type: values.type,
      color: values.color,
      icon: values.icon,
    });
  });

  const errors = form.formState.errors;
  const selectedColor = form.watch("color");
  const selectedIcon = form.watch("icon");
  const PreviewIcon = iconFromName(selectedIcon);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-card"
          style={{ background: `${selectedColor}1F`, color: selectedColor }}
        >
          <PreviewIcon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor="cat-name">Name</Label>
          <Input
            id="cat-name"
            placeholder="Groceries, Salary, Stocks, …"
            className="mt-1.5"
            {...form.register("name")}
          />
          {errors.name && (
            <span className="text-xs text-expense">{errors.name.message}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-type">Type</Label>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="cat-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <span className="text-[11.5px] text-text-faint">
          The transaction type this category belongs to. Existing transactions
          aren't reassigned if you change this later.
        </span>
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
        <Label>Icon</Label>
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => (
            <div className="grid grid-cols-7 gap-1.5 rounded-card border border-border bg-surface-2 p-2 sm:grid-cols-10">
              {CATEGORY_ICON_NAMES.map((name) => {
                const Icon = iconFromName(name);
                const active = field.value === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => field.onChange(name)}
                    aria-label={name}
                    title={name}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-md border transition-colors",
                      active
                        ? "border-brand bg-brand/15 text-text"
                        : "border-transparent text-text-muted hover:bg-surface hover:text-text",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
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
              : "Add category"}
        </Button>
      </div>
    </form>
  );
}
