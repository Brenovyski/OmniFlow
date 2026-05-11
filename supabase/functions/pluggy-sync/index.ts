// pluggy-sync — JWT-authenticated. Discovers Pluggy items associated with
// our Demo App (via Data Passport / meu.pluggy connections), then walks
// each item's accounts, investments, and transactions through the shared
// merge module. Logs every run to pluggy_sync_log.
//
// Body: { sourceId?: string }  — omit to sync all sources.
//
// Returns: { counts, errors }.

import { createClient } from "@supabase/supabase-js";
import { PluggyClient } from "pluggy-sdk";

import {
  mergeAccount,
  mergeHolding,
  mergeSource,
  mergeTransaction,
} from "../_shared/pluggy-merge.ts";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // User-bound client (validates the JWT).
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service-role client for the merge module (bypasses RLS — we constrain
  // every write by the derived user_id).
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = (await req.json().catch(() => ({}))) as { sourceId?: string };

  const pluggy = new PluggyClient({
    clientId: Deno.env.get("PLUGGY_CLIENT_ID")!,
    clientSecret: Deno.env.get("PLUGGY_CLIENT_SECRET")!,
  });

  const counts: SyncCounts = {
    sourcesUpserted: 0,
    accountsUpserted: 0,
    transactionsUpserted: 0,
    holdingsUpserted: 0,
    transactionsSkipped: 0,
  };
  const errors: SyncError[] = [];

  // 1. Discover items shared with this Demo App via Data Passport.
  let allItems: Array<{ id: string; connector: { id: number; name: string; primaryColor?: string }; status?: string }>;
  try {
    const itemsResp = await pluggy.fetchItems();
    allItems = (itemsResp as { results: typeof allItems }).results ?? [];
  } catch (err) {
    await sb.from("pluggy_sync_log").insert({
      user_id: user.id,
      source_id: body.sourceId ?? null,
      trigger: body.sourceId ? "manual" : "initial",
      status: "error",
      completed_at: new Date().toISOString(),
      error_message: `pluggy.fetchItems failed: ${(err as Error).message}`,
    });
    return new Response(
      JSON.stringify({ error: "pluggy_unreachable", detail: (err as Error).message }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. If sourceId given, narrow to that single item.
  let targetItems = allItems;
  if (body.sourceId) {
    const { data: src } = await sb
      .from("sources")
      .select("pluggy_item_id")
      .eq("id", body.sourceId)
      .eq("user_id", user.id)
      .maybeSingle();
    targetItems = allItems.filter((i) => i.id === src?.pluggy_item_id);
  }

  // 3. Walk each item.
  for (const item of targetItems) {
    try {
      // Source first — establishes the OmniFlow source row.
      await mergeSource(item, user.id, sb);
      counts.sourcesUpserted++;

      const { data: srcRow } = await sb
        .from("sources")
        .select("id, pluggy_last_synced_at, archived_at")
        .eq("user_id", user.id)
        .eq("pluggy_item_id", item.id)
        .single();

      // Archived sources pause syncing (existing data stays).
      if (srcRow?.archived_at) continue;

      const ctx = { userId: user.id, sourceId: srcRow!.id as string, sb };

      // Accounts (CC-link logic lives in mergeAccount).
      try {
        const accResp = (await pluggy.fetchAccounts(item.id)) as { results: unknown[] };
        for (const acc of accResp.results ?? []) {
          await mergeAccount(acc as Parameters<typeof mergeAccount>[0], ctx);
          counts.accountsUpserted++;
        }
      } catch (err) {
        errors.push({ itemId: item.id, message: `accounts: ${(err as Error).message}` });
      }

      // Investments → holdings.
      try {
        const invResp = (await pluggy.fetchInvestments(item.id)) as { results: unknown[] };
        for (const inv of invResp.results ?? []) {
          const result = await mergeHolding(
            inv as Parameters<typeof mergeHolding>[0],
            ctx,
          );
          if (result.kind === "inserted" || result.kind === "updated") {
            counts.holdingsUpserted++;
          }
        }
      } catch (err) {
        errors.push({
          itemId: item.id,
          message: `investments: ${(err as Error).message}`,
        });
      }

      // Transactions: paginated. Initial = last 90d, resync = last_synced - 1d
      // overlap to catch PENDING → POSTED promotions.
      const fromDate = computeFromDate(srcRow?.pluggy_last_synced_at as string | null);
      let page = 1;
      while (true) {
        try {
          const txResp = (await pluggy.fetchTransactions(item.id, {
            from: fromDate,
            page,
            pageSize: 500,
          })) as { results: unknown[]; total?: number };
          const results = txResp.results ?? [];
          for (const tx of results) {
            const result = await mergeTransaction(
              tx as Parameters<typeof mergeTransaction>[0],
              ctx,
            );
            if (result.kind === "inserted" || result.kind === "updated") {
              counts.transactionsUpserted++;
            } else {
              counts.transactionsSkipped++;
            }
          }
          if (results.length < 500) break;
          page++;
        } catch (err) {
          errors.push({
            itemId: item.id,
            message: `transactions page ${page}: ${(err as Error).message}`,
          });
          break;
        }
      }

      await sb
        .from("sources")
        .update({
          pluggy_status: "active",
          pluggy_last_synced_at: new Date().toISOString(),
          pluggy_last_error: null,
        })
        .eq("id", srcRow!.id);
    } catch (err) {
      errors.push({ itemId: item.id, message: (err as Error).message });
    }
  }

  // 4. Audit-log this run.
  await sb.from("pluggy_sync_log").insert({
    user_id: user.id,
    source_id: body.sourceId ?? null,
    trigger: body.sourceId ? "manual" : "initial",
    status: errors.length > 0 ? "error" : "ok",
    completed_at: new Date().toISOString(),
    counts: counts as unknown as Record<string, unknown>,
    error_message: errors.length > 0 ? JSON.stringify(errors) : null,
  });

  return new Response(JSON.stringify({ counts, errors }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function computeFromDate(lastSyncedAt: string | null): string {
  if (lastSyncedAt) {
    const d = new Date(lastSyncedAt);
    d.setDate(d.getDate() - 1); // 1d overlap
    return d.toISOString().split("T")[0];
  }
  // Initial: last 90 days.
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0];
}
