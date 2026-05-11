import { z } from "zod";

export const ACCOUNT_TYPES = ["checking", "savings", "brokerage"] as const;

export const AccountSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  source_id: z.string(),
  name: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  short_name: z.string().nullable(),
  last4: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  opening_balance_cents: z.number().int(),
  credit_limit_cents: z.number().int().nullable(),
  currency: z.string(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  pluggy_account_id: z.string().nullable().default(null),
  pluggy_cc_account_id: z.string().nullable().default(null),
  pluggy_subtype: z.string().nullable().default(null),
  pluggy_owner: z.string().nullable().default(null),
  pluggy_marketing_name: z.string().nullable().default(null),
  pluggy_available_credit_cents: z.number().int().nullable().default(null),
  pluggy_balance_due_date: z.string().nullable().default(null),
  pluggy_balance_close_date: z.string().nullable().default(null),
  pluggy_cc_brand: z.string().nullable().default(null),
  user_edited_fields: z.array(z.string()).default([]),
});

export type Account = z.infer<typeof AccountSchema>;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  brokerage: "Investments",
};
