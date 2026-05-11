import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

interface SyncCounts {
  sourcesUpserted: number;
  accountsUpserted: number;
  transactionsUpserted: number;
  holdingsUpserted: number;
  transactionsSkipped: number;
}

interface SyncError {
  itemId: string;
  message: string;
}

interface SyncResult {
  counts: SyncCounts;
  errors: SyncError[];
}

/**
 * Triggers the pluggy-sync Edge Function. Pass a sourceId to sync just that
 * one source; omit to sync everything connected at meu.pluggy.
 *
 * Invalidates every query whose data could have changed: sources, accounts,
 * transactions, holdings, derived balances, sync log.
 */
export function useSyncFromPluggy() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (sourceId?: string): Promise<SyncResult> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pluggy-sync`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Sync failed (${res.status}): ${body || res.statusText}`);
      }
      return (await res.json()) as SyncResult;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["sources", userId] });
      qc.invalidateQueries({ queryKey: ["accounts", userId] });
      qc.invalidateQueries({ queryKey: ["transactions", userId] });
      qc.invalidateQueries({ queryKey: ["holdings", userId] });
      qc.invalidateQueries({ queryKey: ["account-balances", userId] });
      qc.invalidateQueries({ queryKey: ["credit-card-outstanding", userId] });
      qc.invalidateQueries({ queryKey: ["pluggy-sync-log", userId] });

      const c = result.counts;
      const summary = `Synced ${c.transactionsUpserted} transactions, ${c.accountsUpserted} accounts, ${c.holdingsUpserted} holdings`;
      if (result.errors.length > 0) {
        toast.warning(`${summary} (${result.errors.length} errors)`);
      } else {
        toast.success(summary);
      }
    },
    onError: (err) => {
      toast.error("Sync failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
