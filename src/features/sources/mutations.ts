import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

import { SourceSchema, type Source } from "./schemas";
import type { PaymentMethod, SourceKind } from "./schemas";

export interface NewAccountInSource {
  name: string;
  type: "checking" | "savings" | "brokerage";
  opening_balance_cents: number;
  credit_limit_cents?: number | null;
  color?: string | null;
  icon?: string | null;
  currency?: string;
  short_name?: string | null;
}

export interface NewSourceInput {
  name: string;
  short_name?: string | null;
  kind: SourceKind;
  color?: string | null;
  icon?: string | null;
  methods: PaymentMethod[];
  accounts: NewAccountInSource[];
}

export interface UpdateSourceInput {
  id: string;
  patch: {
    name?: string;
    short_name?: string | null;
    kind?: SourceKind;
    color?: string | null;
    icon?: string | null;
  };
  methods?: PaymentMethod[];
}

const SOURCES_KEY = (uid?: string) => ["sources", uid];
const METHODS_KEY = (uid?: string) => ["source-payment-methods", uid];
const ACCOUNTS_KEY = (uid?: string) => ["accounts", uid];
const BALANCES_KEY = (uid?: string) => ["account-balances", uid];

export function useCreateSource() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (input: NewSourceInput) => {
      if (!userId) throw new Error("Not authenticated");

      const { data: srcRow, error: srcErr } = await supabase
        .from("sources")
        .insert({
          user_id: userId,
          name: input.name,
          short_name: input.short_name ?? null,
          kind: input.kind,
          color: input.color ?? null,
          icon: input.icon ?? null,
        })
        .select("*")
        .single();
      if (srcErr) throw srcErr;
      const source = SourceSchema.parse(srcRow);

      if (input.methods.length > 0) {
        const { error: mErr } = await supabase
          .from("source_payment_methods")
          .insert(input.methods.map((m) => ({ source_id: source.id, method: m })));
        if (mErr) throw mErr;
      }

      if (input.accounts.length > 0) {
        const { error: aErr } = await supabase.from("accounts").insert(
          input.accounts.map((a) => ({
            user_id: userId,
            source_id: source.id,
            name: a.name,
            type: a.type,
            short_name: a.short_name ?? a.name,
            color: a.color ?? input.color ?? null,
            icon: a.icon ?? null,
            currency: a.currency ?? "BRL",
            opening_balance_cents: a.opening_balance_cents,
            credit_limit_cents: a.credit_limit_cents ?? null,
          })),
        );
        if (aErr) throw aErr;
      }

      return source;
    },
    onSuccess: (src) => {
      toast.success(`Added "${src.name}"`);
    },
    onError: (err) => {
      toast.error("Couldn't create source", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SOURCES_KEY(userId) });
      qc.invalidateQueries({ queryKey: METHODS_KEY(userId) });
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY(userId) });
      qc.invalidateQueries({ queryKey: BALANCES_KEY(userId) });
    },
  });
}

export function useUpdateSource() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async ({ id, patch, methods }: UpdateSourceInput) => {
      const { data, error } = await supabase
        .from("sources")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      const source = SourceSchema.parse(data);

      if (methods) {
        const { error: dErr } = await supabase
          .from("source_payment_methods")
          .delete()
          .eq("source_id", id);
        if (dErr) throw dErr;
        if (methods.length > 0) {
          const { error: iErr } = await supabase
            .from("source_payment_methods")
            .insert(methods.map((m) => ({ source_id: id, method: m })));
          if (iErr) throw iErr;
        }
      }

      return source;
    },
    onMutate: async ({ id, patch }) => {
      const key = SOURCES_KEY(userId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Source[]>(key);
      qc.setQueryData<Source[]>(key, (old) =>
        (old ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("Source updated");
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(SOURCES_KEY(userId), ctx.prev);
      }
      toast.error("Couldn't update source", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SOURCES_KEY(userId) });
      qc.invalidateQueries({ queryKey: METHODS_KEY(userId) });
    },
  });
}

export function useArchiveSource() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sources")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      toast.success("Source archived");
    },
    onError: (err) => {
      toast.error("Couldn't archive source", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SOURCES_KEY(userId) });
    },
  });
}
