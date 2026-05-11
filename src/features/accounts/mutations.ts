import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

import { AccountSchema, type Account, type AccountType } from "./schemas";

export interface NewAccountInput {
  name: string;
  type: AccountType;
  source_id: string;
  short_name?: string | null;
  last4?: string | null;
  color?: string | null;
  icon?: string | null;
  opening_balance_cents: number;
  credit_limit_cents?: number | null;
  currency?: string;
}

export interface UpdateAccountInput {
  id: string;
  patch: Partial<NewAccountInput>;
}

const ACCOUNTS_KEY = (userId: string | undefined) => ["accounts", userId];
const BALANCES_KEY = (userId: string | undefined) => [
  "account-balances",
  userId,
];

export function useCreateAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (input: NewAccountInput) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          user_id: userId,
          source_id: input.source_id,
          name: input.name,
          type: input.type,
          short_name: input.short_name ?? null,
          last4: input.last4 ?? null,
          color: input.color ?? null,
          icon: input.icon ?? null,
          opening_balance_cents: input.opening_balance_cents,
          credit_limit_cents: input.credit_limit_cents ?? null,
          currency: input.currency ?? "BRL",
        })
        .select("*")
        .single();
      if (error) throw error;
      return AccountSchema.parse(data);
    },
    onSuccess: (acc) => {
      toast.success(`Added "${acc.name}"`);
    },
    onError: (err) => {
      toast.error("Couldn't create account", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY(userId) });
      qc.invalidateQueries({ queryKey: BALANCES_KEY(userId) });
    },
  });
}

/**
 * Mergeable fields tracked for sticky-edit on Pluggy-managed accounts.
 * Mirrors ACCOUNT_MERGEABLE in supabase/functions/_shared/types.ts.
 */
const ACCOUNT_TRACKABLE_FIELDS = [
  "type",
  "name",
  "currency",
] as const satisfies ReadonlyArray<keyof NewAccountInput>;

export function useUpdateAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateAccountInput) => {
      // Sticky-edit: only relevant when the account is Pluggy-managed.
      const { data: existing } = await supabase
        .from("accounts")
        .select("type, name, currency, user_edited_fields, pluggy_account_id")
        .eq("id", id)
        .single();

      const updates: Record<string, unknown> = { ...patch };
      if (existing?.pluggy_account_id) {
        const edited = new Set<string>(
          (existing.user_edited_fields as string[] | null) ?? [],
        );
        for (const f of ACCOUNT_TRACKABLE_FIELDS) {
          const next = patch[f];
          const prev = existing[f as keyof typeof existing];
          if (next !== undefined && next !== prev) {
            edited.add(f);
          }
        }
        updates.user_edited_fields = Array.from(edited);
      }

      const { data, error } = await supabase
        .from("accounts")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return AccountSchema.parse(data);
    },
    onMutate: async ({ id, patch }) => {
      const key = ACCOUNTS_KEY(userId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Account[]>(key);
      qc.setQueryData<Account[]>(key, (old) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("Account updated");
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(ACCOUNTS_KEY(userId), ctx.prev);
      }
      toast.error("Couldn't update account", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY(userId) });
      qc.invalidateQueries({ queryKey: BALANCES_KEY(userId) });
    },
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("accounts")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      const key = ACCOUNTS_KEY(userId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Account[]>(key);
      const archived_at = new Date().toISOString();
      qc.setQueryData<Account[]>(key, (old) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, archived_at } : a)),
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("Account archived");
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(ACCOUNTS_KEY(userId), ctx.prev);
      }
      toast.error("Couldn't archive account", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY(userId) });
      qc.invalidateQueries({ queryKey: BALANCES_KEY(userId) });
    },
  });
}
