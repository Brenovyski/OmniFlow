// Pluggy merge module — pure-logic upserts that respect user_edited_fields[]
// and never resurrect soft-deleted rows. Used identically by pluggy-sync
// (initial + manual sync) and pluggy-webhook (event-driven updates).
//
// Key rules:
//   1. Bank-truth fields (amount_cents, date, currency, pluggy_*) are ALWAYS
//      overwritten on every sync. user_edited_fields cannot claim these.
//   2. Mergeable fields (description, category_id, type, payment_method,
//      account_id) are applied only if the user hasn't touched them.
//   3. Soft-deleted rows (deleted_at not null) are NEVER resurrected.
//   4. Merge is keyed by `(user_id, pluggy_*_id)` unique indexes — re-running
//      sync produces zero duplicates.

import {
  ACCOUNT_MERGEABLE,
  HOLDING_MERGEABLE,
  TX_MERGEABLE,
  type MergeContext,
  type MergeResult,
} from "./types.ts";

// ─────────────────────────────────────────────────────────────────────────
// Helpers

/** Pluggy returns amounts as floats (e.g. 42.50 BRL). OmniFlow stores cents. */
function toCents(amount: number | null | undefined): number | null {
  if (amount == null) return null;
  return Math.round(amount * 100);
}

/** Pluggy emits ISO timestamps; OmniFlow's `transactions.date` is a SQL date. */
function toIsoDate(input: string): string {
  return input.split("T")[0];
}

/**
 * Classify a Pluggy DEBIT/CREDIT into the OmniFlow type enum based on the
 * resolved OmniFlow account.
 *   - brokerage account → 'investment'
 *   - other accounts:
 *       DEBIT  → 'expense'
 *       CREDIT → 'earning'
 *
 * Cross-bank transfers are intentionally NOT auto-detected here; the user
 * can re-classify one side as `type='transfer'` and the edit sticks.
 */
function classifyType(
  account: { type: string },
  pluggyType: "DEBIT" | "CREDIT",
): string {
  if (account.type === "brokerage") return "investment";
  return pluggyType === "DEBIT" ? "expense" : "earning";
}

/** Map Pluggy item status → OmniFlow source pluggy_status. */
function mapItemStatus(pluggyStatus: string | undefined): string {
  switch (pluggyStatus) {
    case "UPDATED":
    case "OK":
      return "active";
    case "LOGIN_ERROR":
    case "WAITING_USER_INPUT":
    case "WAITING_USER_ACTION":
      return "login_error";
    case "UPDATING":
      return "updating";
    case "OUTDATED":
      return "outdated";
    default:
      return "active";
  }
}

interface ResolvedAccount {
  id: string;
  type: string;
  /** True if the Pluggy accountId arrived via the CC-link path (sibling checking). */
  is_cc_link: boolean;
}

async function resolveAccount(
  pluggyAccountId: string,
  ctx: MergeContext,
): Promise<ResolvedAccount | null> {
  const { data: matches } = await ctx.sb
    .from("accounts")
    .select("id, type, pluggy_account_id, pluggy_cc_account_id")
    .eq("user_id", ctx.userId)
    .or(
      `pluggy_account_id.eq.${pluggyAccountId},pluggy_cc_account_id.eq.${pluggyAccountId}`,
    );
  if (!matches?.length) return null;
  const acc = matches[0];
  return {
    id: acc.id as string,
    type: acc.type as string,
    is_cc_link: acc.pluggy_cc_account_id === pluggyAccountId,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// mergeSource

export async function mergeSource(
  pluggyItem: {
    id: string;
    connector?: { id?: number; name?: string; primaryColor?: string } | null;
    status?: string;
  },
  userId: string,
  sb: MergeContext["sb"],
): Promise<MergeResult> {
  if (!pluggyItem || typeof pluggyItem.id !== "string") {
    throw new Error(
      `mergeSource: invalid pluggyItem (got ${JSON.stringify(pluggyItem).slice(0, 200)})`,
    );
  }

  // Sources don't have user_edited_fields by design — there are no mergeable
  // fields here that the user can override (pluggy_status / connector_id /
  // last_synced_at are all bank-truth, and the source name/color the user
  // edits in the dialog don't get re-set from Pluggy after first insert).
  const { data: existing } = await sb
    .from("sources")
    .select("id")
    .match({ user_id: userId, pluggy_item_id: pluggyItem.id })
    .maybeSingle();

  const status = mapItemStatus(pluggyItem.status);
  const connectorId = pluggyItem.connector?.id ?? null;
  const connectorName = pluggyItem.connector?.name ?? "Pluggy item";
  const connectorColor =
    (pluggyItem.connector?.primaryColor &&
      `#${pluggyItem.connector.primaryColor.replace(/^#/, "")}`) ||
    "#FACC15";

  if (existing) {
    await sb
      .from("sources")
      .update({
        pluggy_connector_id: connectorId,
        pluggy_status: status,
        pluggy_last_synced_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return { kind: "updated", id: existing.id as string };
  }

  const { data: inserted, error } = await sb
    .from("sources")
    .insert({
      user_id: userId,
      name: connectorName,
      kind: "bank",
      color: connectorColor,
      pluggy_item_id: pluggyItem.id,
      pluggy_connector_id: connectorId,
      pluggy_status: status,
      pluggy_last_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`mergeSource insert failed: ${error.message}`);
  return { kind: "inserted", id: inserted!.id as string };
}

// ─────────────────────────────────────────────────────────────────────────
// mergeAccount — dispatches on Pluggy account type. Credit cards auto-link
// to the sibling checking under the same source; bank accounts are upserted
// with sticky-edit on type/name/currency.

export async function mergeAccount(
  pluggyAcc: {
    id: string;
    type: "BANK" | "CREDIT";
    subtype?: string;
    name?: string;
    marketingName?: string;
    owner?: string;
    balance?: number;
    currencyCode?: string;
    creditData?: {
      creditLimit?: number;
      availableCreditLimit?: number;
      brand?: string;
      balanceDueDate?: string;
      balanceCloseDate?: string;
    };
  },
  ctx: MergeContext,
): Promise<MergeResult> {
  if (pluggyAcc.type === "CREDIT" && pluggyAcc.subtype === "CREDIT_CARD") {
    return await mergeCreditCard(pluggyAcc, ctx);
  }
  return await mergeBankAccount(pluggyAcc, ctx);
}

async function mergeBankAccount(
  pluggyAcc: {
    id: string;
    subtype?: string;
    name?: string;
    marketingName?: string;
    owner?: string;
    balance?: number;
    currencyCode?: string;
  },
  ctx: MergeContext,
): Promise<MergeResult> {
  const { data: existing } = await ctx.sb
    .from("accounts")
    .select("id, user_edited_fields")
    .match({ user_id: ctx.userId, pluggy_account_id: pluggyAcc.id })
    .maybeSingle();

  const subtypeMap: Record<string, string> = {
    CHECKING_ACCOUNT: "checking",
    SAVINGS_ACCOUNT: "savings",
  };
  const inferredType =
    subtypeMap[pluggyAcc.subtype ?? ""] ??
    (pluggyAcc.subtype?.includes("INVESTMENT") ? "brokerage" : "checking");

  const patch: Record<string, unknown> = {
    pluggy_subtype: pluggyAcc.subtype ?? null,
    pluggy_owner: pluggyAcc.owner ?? null,
    pluggy_marketing_name: pluggyAcc.marketingName ?? null,
  };

  // Mergeable fields — apply only if user hasn't touched.
  const edited = (existing?.user_edited_fields as string[] | undefined) ?? [];
  for (const f of ACCOUNT_MERGEABLE) {
    if (edited.includes(f)) continue;
    if (f === "type") patch[f] = inferredType;
    else if (f === "name")
      patch[f] = pluggyAcc.marketingName ?? pluggyAcc.name ?? "Account";
    else if (f === "currency") patch[f] = pluggyAcc.currencyCode ?? "BRL";
  }

  if (existing) {
    // For existing accounts: don't touch opening_balance_cents.
    // Once we have transactions imported, opening + sum(tx) = current balance,
    // so rewriting opening would corrupt history.
    await ctx.sb.from("accounts").update(patch).eq("id", existing.id);
    return { kind: "updated", id: existing.id as string };
  }

  // For brand-new accounts: opening_balance_cents seeded from Pluggy's current
  // balance. Subsequent transaction imports don't shift it.
  const { data: inserted, error } = await ctx.sb
    .from("accounts")
    .insert({
      ...patch,
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      pluggy_account_id: pluggyAcc.id,
      opening_balance_cents: toCents(pluggyAcc.balance) ?? 0,
      user_edited_fields: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return { kind: "inserted", id: inserted!.id as string };
}

async function mergeCreditCard(
  pluggyAcc: {
    id: string;
    name?: string;
    currencyCode?: string;
    creditData?: {
      creditLimit?: number;
      availableCreditLimit?: number;
      brand?: string;
      balanceDueDate?: string;
      balanceCloseDate?: string;
    };
  },
  ctx: MergeContext,
): Promise<MergeResult> {
  // Find existing checkings under this source.
  const { data: checkings } = await ctx.sb
    .from("accounts")
    .select("id, user_edited_fields, pluggy_cc_account_id, created_at")
    .eq("user_id", ctx.userId)
    .eq("source_id", ctx.sourceId)
    .eq("type", "checking")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const ccPatch = {
    credit_limit_cents: toCents(pluggyAcc.creditData?.creditLimit) ?? 0,
    pluggy_cc_account_id: pluggyAcc.id,
    pluggy_cc_brand: pluggyAcc.creditData?.brand ?? null,
    pluggy_balance_due_date: pluggyAcc.creditData?.balanceDueDate ?? null,
    pluggy_balance_close_date: pluggyAcc.creditData?.balanceCloseDate ?? null,
    pluggy_available_credit_cents: toCents(
      pluggyAcc.creditData?.availableCreditLimit,
    ),
  };

  if (checkings && checkings.length > 0) {
    // Prefer: already-linked → unlinked → first checking.
    const alreadyLinked = checkings.find(
      (c) => c.pluggy_cc_account_id === pluggyAcc.id,
    );
    const target =
      alreadyLinked ?? checkings.find((c) => !c.pluggy_cc_account_id) ?? checkings[0];
    await ctx.sb.from("accounts").update(ccPatch).eq("id", target.id);
    return { kind: "updated", id: target.id as string };
  }

  // No checking under this source → shadow checking carries the credit limit.
  const { data: shadow, error } = await ctx.sb
    .from("accounts")
    .insert({
      ...ccPatch,
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      type: "checking",
      name: `${pluggyAcc.name ?? "Card"} (carrier)`,
      currency: pluggyAcc.currencyCode ?? "BRL",
      opening_balance_cents: 0,
      user_edited_fields: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return { kind: "inserted", id: shadow!.id as string };
}

// ─────────────────────────────────────────────────────────────────────────
// mergeTransaction

export async function mergeTransaction(
  pluggyTx: {
    id: string;
    accountId: string;
    amount: number;
    date: string;
    description: string;
    descriptionRaw?: string;
    currencyCode: string;
    type: "DEBIT" | "CREDIT";
    status?: "PENDING" | "POSTED";
    category?: string;
    providerCode?: string;
    balance?: number;
    merchant?: { name?: string; category?: string };
    creditCardMetadata?: {
      installmentNumber?: number;
      totalInstallments?: number;
      billId?: string;
    };
  },
  ctx: MergeContext,
): Promise<MergeResult> {
  const { data: existing } = await ctx.sb
    .from("transactions")
    .select("id, user_edited_fields, deleted_at, account_id")
    .match({ user_id: ctx.userId, pluggy_transaction_id: pluggyTx.id })
    .maybeSingle();

  // Never resurrect soft-deleted rows.
  if (existing?.deleted_at) return { kind: "skipped_user_deleted" };

  const account = await resolveAccount(pluggyTx.accountId, ctx);
  if (!account) return { kind: "skipped_no_account" };

  // Bank-truth: always overwrite. Note OmniFlow's `amount_cents` is
  // nonnegative (sign carried by `type`), so we abs() the Pluggy amount.
  const patch: Record<string, unknown> = {
    amount_cents: Math.abs(toCents(pluggyTx.amount) ?? 0),
    date: toIsoDate(pluggyTx.date),
    currency: pluggyTx.currencyCode,
    pluggy_status: pluggyTx.status ?? "POSTED",
    pluggy_category: pluggyTx.category ?? null,
    pluggy_description_raw: pluggyTx.descriptionRaw ?? null,
    pluggy_provider_code: pluggyTx.providerCode ?? null,
    pluggy_balance_after_cents: toCents(pluggyTx.balance),
    pluggy_merchant_name: pluggyTx.merchant?.name ?? null,
    pluggy_merchant_category: pluggyTx.merchant?.category ?? null,
    pluggy_cc_installment: pluggyTx.creditCardMetadata?.installmentNumber ?? null,
    pluggy_cc_total_installments:
      pluggyTx.creditCardMetadata?.totalInstallments ?? null,
    pluggy_cc_bill_id: pluggyTx.creditCardMetadata?.billId ?? null,
  };

  // Mergeable: skip fields the user has already touched.
  const edited = (existing?.user_edited_fields as string[] | undefined) ?? [];
  for (const f of TX_MERGEABLE) {
    if (edited.includes(f)) continue;
    if (f === "description") patch[f] = pluggyTx.description;
    else if (f === "type") patch[f] = classifyType(account, pluggyTx.type);
    else if (f === "account_id") patch[f] = account.id;
    else if (f === "payment_method")
      patch[f] = account.is_cc_link ? "credit_card" : null;
    else if (f === "category_id") patch[f] = null; // never auto-categorize
  }

  if (existing) {
    await ctx.sb.from("transactions").update(patch).eq("id", existing.id);
    return { kind: "updated", id: existing.id as string };
  }
  const { data: inserted, error } = await ctx.sb
    .from("transactions")
    .insert({
      ...patch,
      user_id: ctx.userId,
      pluggy_transaction_id: pluggyTx.id,
      user_edited_fields: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return { kind: "inserted", id: inserted!.id as string };
}

// ─────────────────────────────────────────────────────────────────────────
// mergeHolding

export async function mergeHolding(
  pluggyInv: {
    id: string;
    name: string;
    code?: string;
    isin?: string;
    issuer?: string;
    type?: string;
    balance?: number;
    quantity?: number | null;
    amount?: number;
    amountProfit?: number;
    taxes?: number;
    rate?: number;
    rateType?: string;
    lastTwelveMonthsRate?: number;
    dueDate?: string;
    status?: "ACTIVE" | "PENDING" | "TOTAL_WITHDRAWAL";
    currencyCode?: string;
  },
  ctx: MergeContext,
): Promise<MergeResult> {
  // Find a brokerage account under this source (Pluggy investments live there).
  const { data: brokerages } = await ctx.sb
    .from("accounts")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("source_id", ctx.sourceId)
    .eq("type", "brokerage")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (!brokerages?.length) return { kind: "skipped_no_account" };
  const accountId = brokerages[0].id as string;

  const { data: existing } = await ctx.sb
    .from("holdings")
    .select("id, user_edited_fields")
    .match({ user_id: ctx.userId, pluggy_investment_id: pluggyInv.id })
    .maybeSingle();

  const patch: Record<string, unknown> = {
    pluggy_status: pluggyInv.status ?? null,
    pluggy_isin: pluggyInv.isin ?? null,
    pluggy_issuer: pluggyInv.issuer ?? null,
    pluggy_amount_profit_cents: toCents(pluggyInv.amountProfit),
    pluggy_taxes_cents: toCents(pluggyInv.taxes),
    pluggy_rate: pluggyInv.rate ?? null,
    pluggy_rate_type: pluggyInv.rateType ?? null,
    pluggy_last_12m_rate: pluggyInv.lastTwelveMonthsRate ?? null,
    pluggy_due_date: pluggyInv.dueDate ?? null,
  };

  const edited = (existing?.user_edited_fields as string[] | undefined) ?? [];
  for (const f of HOLDING_MERGEABLE) {
    if (edited.includes(f)) continue;
    if (f === "name") patch[f] = pluggyInv.name;
    else if (f === "ticker") patch[f] = pluggyInv.code ?? null;
    else if (f === "current_price_cents")
      patch[f] = toCents(pluggyInv.balance) ?? 0;
    else if (f === "currency") patch[f] = pluggyInv.currencyCode ?? "BRL";
    else if (f === "notes") patch[f] = null;
  }

  if (existing) {
    await ctx.sb.from("holdings").update(patch).eq("id", existing.id);
    return { kind: "updated", id: existing.id as string };
  }
  const { data: inserted, error } = await ctx.sb
    .from("holdings")
    .insert({
      ...patch,
      user_id: ctx.userId,
      account_id: accountId,
      pluggy_investment_id: pluggyInv.id,
      // Fixed-income often has no `quantity`; default to 1 share so the
      // current_price_cents alone reflects the position value.
      shares: pluggyInv.quantity ?? 1,
      avg_cost_cents: toCents(pluggyInv.amount) ?? 0,
      user_edited_fields: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return { kind: "inserted", id: inserted!.id as string };
}
