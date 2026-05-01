import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

import { TransactionSchema, type Transaction } from "./schemas";

export function useTransactions() {
  const { user } = useAuth();
  return useQuery<Transaction[]>({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .is("deleted_at", null)
        .order("date", { ascending: false });
      if (error) throw error;
      return TransactionSchema.array().parse(data);
    },
  });
}
