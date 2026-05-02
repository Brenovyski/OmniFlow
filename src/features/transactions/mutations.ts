import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

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
  date: string;
  description: string;
  currency?: string;
}

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
      const key = ["transactions", userId];
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
    onError: (_err, _input, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(["transactions", userId], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["transactions", userId] });
    },
  });
}
