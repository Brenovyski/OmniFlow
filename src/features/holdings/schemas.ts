import { z } from "zod";

export const PLUGGY_HOLDING_STATUSES = [
  "ACTIVE",
  "PENDING",
  "TOTAL_WITHDRAWAL",
] as const;

export const HoldingSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  account_id: z.string(),
  ticker: z.string().nullable(),
  name: z.string(),
  shares: z.number(),
  avg_cost_cents: z.number().int(),
  current_price_cents: z.number().int(),
  currency: z.string(),
  notes: z.string().nullable(),
  pluggy_investment_id: z.string().nullable().default(null),
  pluggy_status: z.enum(PLUGGY_HOLDING_STATUSES).nullable().default(null),
  pluggy_isin: z.string().nullable().default(null),
  pluggy_issuer: z.string().nullable().default(null),
  pluggy_amount_profit_cents: z.number().int().nullable().default(null),
  pluggy_taxes_cents: z.number().int().nullable().default(null),
  pluggy_rate: z.number().nullable().default(null),
  pluggy_rate_type: z.string().nullable().default(null),
  pluggy_last_12m_rate: z.number().nullable().default(null),
  pluggy_due_date: z.string().nullable().default(null),
  user_edited_fields: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Holding = z.infer<typeof HoldingSchema>;
export type PluggyHoldingStatus = (typeof PLUGGY_HOLDING_STATUSES)[number];
