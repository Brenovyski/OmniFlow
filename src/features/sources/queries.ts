import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

import {
  SourcePaymentMethodSchema,
  SourceSchema,
  type PaymentMethod,
  type Source,
  type SourcePaymentMethod,
} from "./schemas";

export function useSources() {
  const { user } = useAuth();
  return useQuery<Source[]>({
    queryKey: ["sources", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return SourceSchema.array().parse(data);
    },
  });
}

export function useSourcePaymentMethods() {
  const { user } = useAuth();
  return useQuery<SourcePaymentMethod[]>({
    queryKey: ["source-payment-methods", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_payment_methods")
        .select("source_id, method");
      if (error) throw error;
      return SourcePaymentMethodSchema.array().parse(data);
    },
  });
}

/**
 * Convenience: returns a Map<source_id, methods[]> grouped from the flat row
 * list. Empty array when a source has no methods.
 */
export function methodsBySourceId(
  rows: SourcePaymentMethod[],
): Map<string, PaymentMethod[]> {
  const out = new Map<string, PaymentMethod[]>();
  for (const r of rows) {
    const list = out.get(r.source_id) ?? [];
    list.push(r.method);
    out.set(r.source_id, list);
  }
  return out;
}
