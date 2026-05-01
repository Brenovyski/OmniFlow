import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

import { AccountSchema, type Account } from "./schemas";

export function useAccounts() {
  const { user } = useAuth();
  return useQuery<Account[]>({
    queryKey: ["accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return AccountSchema.array().parse(data);
    },
  });
}
