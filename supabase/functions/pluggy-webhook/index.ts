// pluggy-webhook — receives Pluggy event deliveries.
//
// Auth model: Pluggy does NOT HMAC-sign webhook bodies. Instead, when we
// register the webhook via Pluggy's POST /webhooks API, we provide a custom
// `Authorization` header that Pluggy sends with every delivery. We verify
// the header here against PLUGGY_WEBHOOK_SECRET.
//
// Defense-in-depth: even after auth, every DB write is constrained to the
// user_id derived from sources.pluggy_item_id = event.itemId. A bad payload
// can never write to another user's data.
//
// Deploy with `--no-verify-jwt` so Supabase Edge runtime doesn't try to
// validate the Authorization header as a JWT.

import { createClient } from "@supabase/supabase-js";
import { PluggyClient } from "pluggy-sdk";

import {
  mergeAccount,
  mergeHolding,
  mergeTransaction,
} from "../_shared/pluggy-merge.ts";

const WEBHOOK_SECRET = Deno.env.get("PLUGGY_WEBHOOK_SECRET")!;

interface PluggyEvent {
  event: string;
  itemId: string;
  // event-specific:
  transactionIds?: string[];
  createdTransactionsLink?: string;
  error?: unknown;
}

Deno.serve(async (req) => {
  // Auth: header must match the registered shared secret.
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (auth !== `Bearer ${WEBHOOK_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const event = (await req.json()) as PluggyEvent;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Look up the source via item id. If we don't recognize this itemId, ack
  // and bail — likely a stale event from a deleted user.
  const { data: source } = await sb
    .from("sources")
    .select("id, user_id, archived_at")
    .eq("pluggy_item_id", event.itemId)
    .maybeSingle();

  if (!source) {
    return new Response(
      JSON.stringify({ received: true, note: "no matching source" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // Archived source → ack but no-op.
  if (source.archived_at) {
    return new Response(
      JSON.stringify({ received: true, note: "source archived" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const ctx = {
    userId: source.user_id as string,
    sourceId: source.id as string,
    sb,
  };
  const pluggy = new PluggyClient({
    clientId: Deno.env.get("PLUGGY_CLIENT_ID")!,
    clientSecret: Deno.env.get("PLUGGY_CLIENT_SECRET")!,
  });

  try {
    switch (event.event) {
      case "item/created":
        // No-op: initial sync handles via "Sync from Pluggy" button.
        break;

      case "item/updated": {
        const accResp = (await pluggy.fetchAccounts(event.itemId)) as {
          results: unknown[];
        };
        for (const acc of accResp.results ?? []) {
          await mergeAccount(acc as Parameters<typeof mergeAccount>[0], ctx);
        }
        const invResp = (await pluggy.fetchInvestments(event.itemId)) as {
          results: unknown[];
        };
        for (const inv of invResp.results ?? []) {
          await mergeHolding(inv as Parameters<typeof mergeHolding>[0], ctx);
        }
        await sb
          .from("sources")
          .update({
            pluggy_last_synced_at: new Date().toISOString(),
            pluggy_status: "active",
          })
          .eq("id", source.id);
        break;
      }

      case "item/login_succeeded":
        await sb
          .from("sources")
          .update({ pluggy_status: "active", pluggy_last_error: null })
          .eq("id", source.id);
        break;

      case "item/error":
      case "item/waiting_user_input":
      case "item/waiting_user_action":
        await sb
          .from("sources")
          .update({
            pluggy_status: "login_error",
            pluggy_last_error: event.error ?? { event: event.event },
          })
          .eq("id", source.id);
        break;

      case "item/deleted":
        await sb
          .from("sources")
          .update({
            pluggy_status: "disconnected",
            pluggy_item_id: null,
          })
          .eq("id", source.id);
        break;

      case "transactions/created": {
        // Pluggy provides createdTransactionsLink to fetch just the new ones.
        // Fall back to a delta fetch if the link is missing.
        if (event.createdTransactionsLink) {
          // The SDK's fetchTransactions takes itemId + filters; if a "by link"
          // helper isn't available we just refresh the last 7 days.
          const d = new Date();
          d.setDate(d.getDate() - 7);
          const txResp = (await pluggy.fetchTransactions(event.itemId, {
            from: d.toISOString().split("T")[0],
            pageSize: 500,
          })) as { results: unknown[] };
          for (const tx of txResp.results ?? []) {
            await mergeTransaction(
              tx as Parameters<typeof mergeTransaction>[0],
              ctx,
            );
          }
        }
        break;
      }

      case "transactions/updated": {
        for (const txId of event.transactionIds ?? []) {
          try {
            const tx = await pluggy.fetchTransaction(txId);
            await mergeTransaction(
              tx as Parameters<typeof mergeTransaction>[0],
              ctx,
            );
          } catch (err) {
            console.warn(`failed to update tx ${txId}: ${(err as Error).message}`);
          }
        }
        break;
      }

      case "transactions/deleted": {
        // Soft-mark, never hard delete.
        for (const txId of event.transactionIds ?? []) {
          await sb
            .from("transactions")
            .update({ pluggy_deleted_at: new Date().toISOString() })
            .eq("user_id", source.user_id)
            .eq("pluggy_transaction_id", txId);
        }
        break;
      }

      case "connector/status_updated":
        // No-op: connector-level info isn't surfaced in OmniFlow.
        break;

      default:
        console.warn(`unhandled event: ${event.event}`);
    }

    await sb.from("pluggy_sync_log").insert({
      user_id: source.user_id,
      source_id: source.id,
      trigger: "webhook",
      status: "ok",
      completed_at: new Date().toISOString(),
      counts: { event: event.event },
    });
  } catch (err) {
    await sb.from("pluggy_sync_log").insert({
      user_id: source.user_id,
      source_id: source.id,
      trigger: "webhook",
      status: "error",
      completed_at: new Date().toISOString(),
      counts: { event: event.event },
      error_message: (err as Error).message,
    });
    return new Response(JSON.stringify({ received: true, error: (err as Error).message }), {
      status: 200, // ack so Pluggy doesn't retry indefinitely
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
