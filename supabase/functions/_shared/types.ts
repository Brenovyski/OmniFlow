// Shared types for the Pluggy integration Edge Functions.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface MergeContext {
  userId: string;
  /** OmniFlow source row id (uuid) — set on every per-source merge call. */
  sourceId: string;
  /** Service-role Supabase client — bypasses RLS, used by Edge Functions only. */
  sb: SupabaseClient;
}

export type MergeResult =
  | { kind: "inserted"; id: string }
  | { kind: "updated"; id: string }
  | { kind: "skipped_user_deleted" }
  | { kind: "skipped_no_account" };

/** Mergeable fields on transactions — overwritten by Pluggy only when user hasn't touched. */
export const TX_MERGEABLE = [
  "description",
  "category_id",
  "type",
  "payment_method",
  "account_id",
] as const;

/** Mergeable fields on accounts. */
export const ACCOUNT_MERGEABLE = ["type", "name", "currency"] as const;

/** Mergeable fields on holdings. */
export const HOLDING_MERGEABLE = [
  "ticker",
  "name",
  "current_price_cents",
  "currency",
  "notes",
] as const;

/**
 * Bank-truth fields on transactions — always overwritten on every sync.
 * Includes the OmniFlow-canonical numeric fields plus all `pluggy_*` columns
 * we promote from the API payload.
 */
export const TX_BANK_TRUTH = [
  "amount_cents",
  "date",
  "currency",
  "pluggy_status",
  "pluggy_category",
  "pluggy_description_raw",
  "pluggy_provider_code",
  "pluggy_balance_after_cents",
  "pluggy_merchant_name",
  "pluggy_merchant_category",
  "pluggy_cc_installment",
  "pluggy_cc_total_installments",
  "pluggy_cc_bill_id",
] as const;
