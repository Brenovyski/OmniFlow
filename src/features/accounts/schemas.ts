import { z } from "zod";

export const ACCOUNT_TYPES = [
  "credit_card",
  "debit",
  "voucher",
  "brokerage",
  "cash",
  "savings",
] as const;

export const AccountSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  short_name: z.string().nullable(),
  last4: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  opening_balance_cents: z.number().int(),
  currency: z.string(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Account = z.infer<typeof AccountSchema>;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
