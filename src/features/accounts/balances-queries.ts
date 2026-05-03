import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

const BalanceRowSchema = z.object({
  account_id: z.string(),
  user_id: z.string(),
  balance_cents: z.union([z.number(), z.string()]).transform((v) =>
    typeof v === "string" ? Number(v) : v,
  ),
});

export interface AccountBalance {
  accountId: string;
  balanceCents: number;
}

/**
 * Live derived balance per account, sourced from the `account_balances_v`
 * Postgres view. RLS on the underlying tables gates visibility — the view
 * runs with `security_invoker` so each row is the caller's own.
 */
export function useAccountBalances() {
  const { user } = useAuth();
  return useQuery<Map<string, number>>({
    queryKey: ["account-balances", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_balances_v")
        .select("account_id, user_id, balance_cents");
      if (error) throw error;
      const rows = BalanceRowSchema.array().parse(data);
      return new Map(rows.map((r) => [r.account_id, r.balance_cents]));
    },
  });
}
