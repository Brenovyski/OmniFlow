import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

const RowSchema = z.object({
  account_id: z.string(),
  user_id: z.string(),
  outstanding_cents: z.union([z.number(), z.string()]).transform((v) =>
    typeof v === "string" ? Number(v) : v,
  ),
});

/**
 * Per-checking-account sum of unsettled credit-card charges, sourced from the
 * `credit_card_outstanding_v` view. The dashboard "Credit cards" card reads
 * this to show outstanding/used per account.
 */
export function useCreditCardOutstanding() {
  const { user } = useAuth();
  return useQuery<Map<string, number>>({
    queryKey: ["credit-card-outstanding", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_card_outstanding_v")
        .select("account_id, user_id, outstanding_cents");
      if (error) throw error;
      const rows = RowSchema.array().parse(data);
      return new Map(rows.map((r) => [r.account_id, r.outstanding_cents]));
    },
  });
}
