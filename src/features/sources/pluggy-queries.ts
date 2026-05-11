import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

export interface PluggySyncLogEntry {
  id: string;
  user_id: string;
  source_id: string | null;
  trigger: "manual" | "webhook" | "initial" | "reconnect";
  started_at: string;
  completed_at: string | null;
  status: "running" | "ok" | "error";
  counts: Record<string, unknown> | null;
  error_message: string | null;
  source: { name: string; pluggy_connector_id: number | null } | null;
}

export function useSyncLog(limit = 30) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery<PluggySyncLogEntry[]>({
    queryKey: ["pluggy-sync-log", userId, limit],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_sync_log")
        .select("*, source:sources(name, pluggy_connector_id)")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as PluggySyncLogEntry[];
    },
  });
}
