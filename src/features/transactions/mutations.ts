import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

import type { PaymentMethod } from "@/features/sources/schemas";

import {
  TransactionSchema,
  type Transaction,
  type TransactionType,
} from "./schemas";

export interface NewTransactionInput {
  type: TransactionType;
  amount_cents: number;
  account_id: string;
  category_id: string | null;
  transfer_account_id?: string | null;
  payment_method?: PaymentMethod | null;
  date: string;
  description: string;
  currency?: string;
}

export interface UpdateTransactionInput {
  id: string;
  patch: Partial<NewTransactionInput>;
}

const TX_KEY = (userId: string | undefined) => ["transactions", userId];
const BAL_KEY = (userId: string | undefined) => ["account-balances", userId];
const CC_KEY = (userId: string | undefined) => [
  "credit-card-outstanding",
  userId,
];

export function useCreateTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (input: NewTransactionInput) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: input.type,
          amount_cents: input.amount_cents,
          account_id: input.account_id,
          category_id: input.category_id,
          transfer_account_id: input.transfer_account_id ?? null,
          payment_method: input.payment_method ?? null,
          date: input.date,
          description: input.description,
          currency: input.currency ?? "BRL",
        })
        .select("*")
        .single();
      if (error) throw error;
      return TransactionSchema.parse(data);
    },
    onMutate: async (input) => {
      const key = TX_KEY(userId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Transaction[]>(key);
      const now = new Date().toISOString();
      const optimistic: Transaction = {
        id: `optimistic-${Date.now()}`,
        user_id: userId ?? "",
        type: input.type,
        amount_cents: input.amount_cents,
        currency: input.currency ?? "BRL",
        account_id: input.account_id,
        category_id: input.category_id,
        transfer_account_id: input.transfer_account_id ?? null,
        payment_method: input.payment_method ?? null,
        settled_at: null,
        date: input.date,
        description: input.description,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      };
      qc.setQueryData<Transaction[]>(key, (old) => [
        optimistic,
        ...(old ?? []),
      ]);
      return { prev };
    },
    onSuccess: (tx) => {
      toast.success(
        tx.type === "transfer" ? "Transfer added" : "Transaction added",
      );
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(TX_KEY(userId), ctx.prev);
      }
      toast.error("Couldn't save transaction", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: TX_KEY(userId) });
      qc.invalidateQueries({ queryKey: BAL_KEY(userId) });
      qc.invalidateQueries({ queryKey: CC_KEY(userId) });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateTransactionInput) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return TransactionSchema.parse(data);
    },
    onMutate: async ({ id, patch }) => {
      const key = TX_KEY(userId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Transaction[]>(key);
      qc.setQueryData<Transaction[]>(key, (old) =>
        (old ?? []).map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)),
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("Transaction updated");
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(TX_KEY(userId), ctx.prev);
      }
      toast.error("Couldn't update transaction", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: TX_KEY(userId) });
      qc.invalidateQueries({ queryKey: BAL_KEY(userId) });
      qc.invalidateQueries({ queryKey: CC_KEY(userId) });
    },
  });
}

/**
 * Settle outstanding credit-card charges on a checking account by stamping
 * `settled_at = now()` on every unsettled `payment_method='credit_card'` row
 * for that account. Once settled, the rows become real expenses against the
 * checking balance via `account_balances_v`.
 */
export function useSettleCreditCardBill() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (accountId: string) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("transactions")
        .update({ settled_at: now })
        .eq("account_id", accountId)
        .eq("payment_method", "credit_card")
        .is("settled_at", null)
        .is("deleted_at", null)
        .select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: (count) => {
      if (count > 0) {
        toast.success(`Settled ${count} credit card charge${count === 1 ? "" : "s"}`);
      } else {
        toast.info("Nothing to settle");
      }
    },
    onError: (err) => {
      toast.error("Couldn't settle bill", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: TX_KEY(userId) });
      qc.invalidateQueries({ queryKey: BAL_KEY(userId) });
      qc.invalidateQueries({ queryKey: CC_KEY(userId) });
    },
  });
}

export function useSoftDeleteTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      const key = TX_KEY(userId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Transaction[]>(key);
      qc.setQueryData<Transaction[]>(key, (old) =>
        (old ?? []).filter((tx) => tx.id !== id),
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("Transaction deleted");
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(TX_KEY(userId), ctx.prev);
      }
      toast.error("Couldn't delete transaction", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: TX_KEY(userId) });
      qc.invalidateQueries({ queryKey: BAL_KEY(userId) });
      qc.invalidateQueries({ queryKey: CC_KEY(userId) });
    },
  });
}
