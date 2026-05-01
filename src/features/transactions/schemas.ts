import { z } from "zod";

export const TRANSACTION_TYPES = ["expense", "earning", "investment"] as const;

export const TransactionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type: z.enum(TRANSACTION_TYPES),
  amount_cents: z.number().int().nonnegative(),
  currency: z.string(),
  account_id: z.string(),
  category_id: z.string().nullable(),
  date: z.string(),
  description: z.string(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
