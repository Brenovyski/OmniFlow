interface FmtMoneyOpts {
  sign?: boolean;
  abbrev?: boolean;
  currency?: string;
}

export function fmtMoney(
  cents: number,
  { sign = false, abbrev = false, currency = "BRL" }: FmtMoneyOpts = {},
): string {
  const symbol = currency === "BRL" ? "R$" : currency;
  const v = Math.abs(cents) / 100;
  let body: string;
  if (abbrev && v >= 1000) {
    if (v >= 1_000_000) {
      body = (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    } else {
      body = (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
  } else {
    body = v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const prefix = cents < 0 ? "−" : sign ? "+" : "";
  return `${prefix}${symbol} ${body}`;
}

/** Parse a YYYY-MM-DD ISO date string to a Date in local time. */
export function parseISODate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

/** Format a YYYY-MM-DD ISO date as "Apr 30". */
export function fmtDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
  });
}

/** Convert a Date to YYYY-MM-DD in local time (no timezone shift). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse a user-typed amount into bigint cents.
 *
 * Accepts both en-US ("12.50", "1,234.56") and pt-BR ("12,50", "1.234,56")
 * formats so users can type whichever feels natural. Disambiguates by
 * looking at which separator is rightmost: that one is treated as the
 * decimal point.
 */
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    // pt-BR: "1.234,56" — dots are thousand separators, comma is decimal.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // en-US: "1,234.56" — commas are thousand separators, dot is decimal.
    normalized = cleaned.replace(/,/g, "");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}
