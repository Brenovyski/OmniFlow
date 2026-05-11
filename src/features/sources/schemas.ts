import { z } from "zod";

export const SOURCE_KINDS = [
  "bank",
  "benefits",
  "broker",
  "cash",
  "custom",
] as const;

export const PAYMENT_METHODS = [
  "pix",
  "debit_card",
  "credit_card",
  "transfer",
  "wire",
  "cash",
  "voucher",
] as const;

export const PLUGGY_SOURCE_STATUSES = [
  "active",
  "login_error",
  "updating",
  "outdated",
  "disconnected",
] as const;

export const SourceSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  short_name: z.string().nullable(),
  kind: z.enum(SOURCE_KINDS),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  pluggy_item_id: z.string().nullable().default(null),
  pluggy_connector_id: z.number().int().nullable().default(null),
  pluggy_status: z.enum(PLUGGY_SOURCE_STATUSES).nullable().default(null),
  pluggy_last_synced_at: z.string().nullable().default(null),
  pluggy_last_error: z.unknown().nullable().default(null),
});

export const SourcePaymentMethodSchema = z.object({
  source_id: z.string(),
  method: z.enum(PAYMENT_METHODS),
});

export type Source = z.infer<typeof SourceSchema>;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export type PluggySourceStatus = (typeof PLUGGY_SOURCE_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type SourcePaymentMethod = z.infer<typeof SourcePaymentMethodSchema>;

export function isPluggyManaged(source: Pick<Source, "pluggy_item_id">): boolean {
  return source.pluggy_item_id !== null;
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  debit_card: "Debit card",
  credit_card: "Credit card",
  transfer: "Transfer",
  wire: "Wire",
  cash: "Cash",
  voucher: "Voucher",
};

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  bank: "Bank",
  benefits: "Benefits",
  broker: "Broker",
  cash: "Cash",
  custom: "Custom",
};
