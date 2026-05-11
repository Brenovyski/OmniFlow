// pluggy-sync — JWT-authenticated. Iterates the user's known Pluggy-managed
// sources, walks each through fetchItem → fetchAccounts → fetchInvestments
// → fetchAllTransactions(per account), upserting via the shared merge module.
// Logs every run to pluggy_sync_log.
//
// Pluggy's REST API does NOT expose a "list all items shared with the app"
// endpoint (only GET /items/{id}), so items must first be REGISTERED in
// OmniFlow via the Connect Pluggy item dialog. The sync function accepts a
// `connectItemId` body param to register-and-sync in one call.
//
// SDK signatures (verified against pluggy-node@master src/client.ts):
//   fetchItem(id)                                  → Item
//   fetchAccounts(itemId)                          → PageResponse<Account>
//   fetchInvestments(itemId)                       → PageResponse<Investment>
//   fetchAllTransactions(ACCOUNT_ID, { from, ... })→ Transaction[]
//                                                    ^^^ takes accountId,
//                                                    not itemId — so we
//                                                    iterate each Pluggy
//                                                    account.
//
// Body: { sourceId?: string, connectItemId?: string }
//   • sourceId given      → sync just that one source
//   • connectItemId given → register the item (insert source) then sync it
//   • neither             → sync all known Pluggy-managed sources

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
  try {
    return await handleRequest(req);
  } catch (err) {
    // Top-level safety net so any uncaught throw surfaces in the body
    // instead of an opaque EDGE_FUNCTION_ERROR.
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("pluggy-sync uncaught:", message, stack);
    return new Response(
      JSON.stringify({ error: "uncaught", detail: message, stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleRequest(req: Request): Promise<Response> {
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

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = (await req.json().catch(() => ({}))) as {
    sourceId?: string;
    connectItemId?: string;
  };

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

  // 1. Build the list of (sourceRow, pluggyItemId) to walk.
  type Target = {
    id: string;
    pluggy_item_id: string;
    pluggy_last_synced_at: string | null;
    isNew: boolean;
  };
  const targets: Target[] = [];

  if (body.connectItemId) {
    // Register-and-sync flow: validate the item exists at Pluggy first.
    let pluggyItem;
    try {
      pluggyItem = await pluggy.fetchItem(body.connectItemId);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "invalid_item",
          detail: `Pluggy could not find item ${body.connectItemId}: ${(err as Error).message}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert (or refresh) the source via the merge module.
    await mergeSource(pluggyItem as Parameters<typeof mergeSource>[0], user.id, sb);
    counts.sourcesUpserted++;

    const { data: srcRow } = await sb
      .from("sources")
      .select("id, pluggy_item_id, pluggy_last_synced_at")
      .eq("user_id", user.id)
      .eq("pluggy_item_id", body.connectItemId)
      .single();

    if (srcRow) {
      targets.push({
        id: srcRow.id as string,
        pluggy_item_id: srcRow.pluggy_item_id as string,
        pluggy_last_synced_at: srcRow.pluggy_last_synced_at as string | null,
        isNew: true,
      });
    }
  } else {
    let q = sb
      .from("sources")
      .select("id, pluggy_item_id, pluggy_last_synced_at")
      .eq("user_id", user.id)
      .not("pluggy_item_id", "is", null)
      .is("archived_at", null);
    if (body.sourceId) q = q.eq("id", body.sourceId);
    const { data: known, error: knownErr } = await q;
    if (knownErr) {
      return new Response(
        JSON.stringify({ error: "db_error", detail: knownErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    for (const src of known ?? []) {
      targets.push({
        id: src.id as string,
        pluggy_item_id: src.pluggy_item_id as string,
        pluggy_last_synced_at: src.pluggy_last_synced_at as string | null,
        isNew: false,
      });
    }
  }

  if (targets.length === 0) {
    return new Response(
      JSON.stringify({
        counts,
        errors,
        note: "no Pluggy-managed sources registered yet — use Connect Pluggy item to add one",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Walk each target.
  for (const target of targets) {
    const itemId = target.pluggy_item_id;
    try {
      // Refresh source connector + status.
      if (!target.isNew) {
        const item = await pluggy.fetchItem(itemId);
        await mergeSource(item as Parameters<typeof mergeSource>[0], user.id, sb);
        counts.sourcesUpserted++;
      }

      const ctx = { userId: user.id, sourceId: target.id, sb };

      // Accounts (CC-link logic lives in mergeAccount).
      let pluggyAccounts: Array<{ id: string; type?: string; subtype?: string }> = [];
      try {
        const accResp = (await pluggy.fetchAccounts(itemId)) as {
          results: typeof pluggyAccounts;
        };
        pluggyAccounts = accResp.results ?? [];
        for (const acc of pluggyAccounts) {
          await mergeAccount(acc as Parameters<typeof mergeAccount>[0], ctx);
          counts.accountsUpserted++;
        }
      } catch (err) {
        errors.push({ itemId, message: `accounts: ${(err as Error).message}` });
      }

      // Investments → holdings.
      try {
        const invResp = (await pluggy.fetchInvestments(itemId)) as { results: unknown[] };
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
          itemId,
          message: `investments: ${(err as Error).message}`,
        });
      }

      // Transactions: per-Pluggy-account. fetchTransactions takes accountId
      // (not itemId) and is the page-based variant that accepts `from`.
      // fetchAllTransactions exists too but uses the cursor variant which
      // rejects `from`. Initial pull = last 90d, resync = last_synced - 1d.
      const fromDate = computeFromDate(target.pluggy_last_synced_at);
      for (const acc of pluggyAccounts) {
        let page = 1;
        const pageSize = 500;
        while (true) {
          try {
            const resp = (await pluggy.fetchTransactions(acc.id, {
              from: fromDate,
              page,
              pageSize,
            })) as { results?: unknown[]; total?: number };
            const results = resp.results ?? [];
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
            if (results.length < pageSize) break;
            page++;
          } catch (err) {
            errors.push({
              itemId,
              message: `transactions for account ${acc.id} (page ${page}): ${(err as Error).message}`,
            });
            break;
          }
        }
      }

      await sb
        .from("sources")
        .update({
          pluggy_status: "active",
          pluggy_last_synced_at: new Date().toISOString(),
          pluggy_last_error: null,
        })
        .eq("id", target.id);
    } catch (err) {
      errors.push({ itemId, message: (err as Error).message });
    }
  }

  // 3. Audit log.
  await sb.from("pluggy_sync_log").insert({
    user_id: user.id,
    source_id: body.sourceId ?? null,
    trigger: body.connectItemId ? "initial" : body.sourceId ? "manual" : "manual",
    status: errors.length > 0 ? "error" : "ok",
    completed_at: new Date().toISOString(),
    counts: counts as unknown as Record<string, unknown>,
    error_message: errors.length > 0 ? JSON.stringify(errors) : null,
  });

  return new Response(JSON.stringify({ counts, errors }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function computeFromDate(lastSyncedAt: string | null): string {
  if (lastSyncedAt) {
    const d = new Date(lastSyncedAt);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0];
}
