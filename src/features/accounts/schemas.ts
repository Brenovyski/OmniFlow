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
});

export type Account = z.infer<typeof AccountSchema>;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  brokerage: "Investments",
};
