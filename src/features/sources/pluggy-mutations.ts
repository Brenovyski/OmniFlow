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

async function callSync(body: {
  sourceId?: string;
  connectItemId?: string;
}): Promise<SyncResult & { note?: string }> {
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
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sync failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as SyncResult & { note?: string };
}

function invalidatePluggyQueries(qc: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  qc.invalidateQueries({ queryKey: ["sources", userId] });
  qc.invalidateQueries({ queryKey: ["accounts", userId] });
  qc.invalidateQueries({ queryKey: ["transactions", userId] });
  qc.invalidateQueries({ queryKey: ["holdings", userId] });
  qc.invalidateQueries({ queryKey: ["account-balances", userId] });
  qc.invalidateQueries({ queryKey: ["credit-card-outstanding", userId] });
  qc.invalidateQueries({ queryKey: ["pluggy-sync-log", userId] });
}

/**
 * Triggers the pluggy-sync Edge Function. Pass a sourceId to sync just that
 * one source; omit to sync every known Pluggy-managed source.
 *
 * Note: Pluggy's API has no "list all items" endpoint, so a brand-new
 * meu.pluggy connection won't appear here until you register it via
 * useConnectPluggyItem (the "Connect Pluggy item" dialog).
 */
export function useSyncFromPluggy() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (sourceId?: string) =>
      callSync(sourceId ? { sourceId } : {}),
    onSuccess: (result) => {
      invalidatePluggyQueries(qc, userId);
      const c = result.counts;
      const summary = `Synced ${c.transactionsUpserted} transactions, ${c.accountsUpserted} accounts, ${c.holdingsUpserted} holdings`;
      if (result.note) {
        toast.info(result.note);
      } else if (result.errors.length > 0) {
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

/**
 * Registers a Pluggy item by its ID (copy from meu.pluggy → My Connections).
 * Validates with Pluggy, inserts the source row, and runs the initial sync
 * in one round-trip. After this lands, useSyncFromPluggy keeps it fresh.
 */
export function useConnectPluggyItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (itemId: string) => callSync({ connectItemId: itemId.trim() }),
    onSuccess: (result) => {
      invalidatePluggyQueries(qc, userId);
      const c = result.counts;
      toast.success(
        `Connected. Pulled ${c.transactionsUpserted} transactions, ${c.accountsUpserted} accounts, ${c.holdingsUpserted} holdings`,
      );
    },
    onError: (err) => {
      toast.error("Couldn't connect Pluggy item", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
