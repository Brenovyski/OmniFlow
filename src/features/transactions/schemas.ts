import { z } from "zod";

import { PAYMENT_METHODS } from "@/features/sources/schemas";

export const TRANSACTION_TYPES = [
  "expense",
  "earning",
  "investment",
  "transfer",
] as const;

export const PLUGGY_TRANSACTION_STATUSES = ["PENDING", "POSTED"] as const;

export const TransactionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type: z.enum(TRANSACTION_TYPES),
  amount_cents: z.number().int().nonnegative(),
  currency: z.string(),
  account_id: z.string(),
  category_id: z.string().nullable(),
  transfer_account_id: z.string().nullable(),
  payment_method: z.enum(PAYMENT_METHODS).nullable(),
  settled_at: z.string().nullable(),
  date: z.string(),
  description: z.string(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  pluggy_transaction_id: z.string().nullable().default(null),
  pluggy_status: z.enum(PLUGGY_TRANSACTION_STATUSES).nullable().default(null),
  pluggy_category: z.string().nullable().default(null),
  pluggy_description_raw: z.string().nullable().default(null),
  pluggy_provider_code: z.string().nullable().default(null),
  pluggy_balance_after_cents: z.number().int().nullable().default(null),
  pluggy_merchant_name: z.string().nullable().default(null),
  pluggy_merchant_category: z.string().nullable().default(null),
  pluggy_cc_installment: z.number().int().nullable().default(null),
  pluggy_cc_total_installments: z.number().int().nullable().default(null),
  pluggy_cc_bill_id: z.string().nullable().default(null),
  pluggy_deleted_at: z.string().nullable().default(null),
  user_edited_fields: z.array(z.string()).default([]),
  holding_id: z.string().nullable().default(null),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
