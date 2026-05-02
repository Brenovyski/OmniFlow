import type { Account } from "@/features/accounts/schemas";
import type { Category } from "@/features/categories/schemas";
import type { Transaction } from "@/features/transactions/schemas";

const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function txToCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
): string {
  const accountById = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const header = ["Date", "Description", "Category", "Account", "Type", "Amount"];
  const rows = transactions.map((tx) => [
    tx.date,
    tx.description,
    tx.category_id ? (categoryById.get(tx.category_id) ?? "") : "",
    accountById.get(tx.account_id) ?? "",
    tx.type,
    (tx.amount_cents / 100).toFixed(2).replace(".", ","),
  ]);
  return [header, ...rows]
    .map((r) => r.map((cell) => escape(String(cell))).join(","))
    .join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
