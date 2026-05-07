import { useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCreditCardOutstanding } from "@/features/accounts/credit-card-queries";
import { useAccounts } from "@/features/accounts/queries";
import type { Account } from "@/features/accounts/schemas";
import {
  accountDisplayColor,
  sourceLabel,
} from "@/features/sources/display";
import { useSources } from "@/features/sources/queries";
import type { Source } from "@/features/sources/schemas";
import { useSettleCreditCardBill } from "@/features/transactions/mutations";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Row {
  account: Account;
  source: Source | undefined;
  sourceName: string;
  dotColor: string;
  used: number;
  limit: number;
}

export function CreditCards() {
  const accountsQ = useAccounts();
  const sourcesQ = useSources();
  const outstandingQ = useCreditCardOutstanding();
  const settle = useSettleCreditCardBill();
  const [confirmFor, setConfirmFor] = useState<Row | null>(null);

  const rows = useMemo<Row[]>(() => {
    const accounts = accountsQ.data ?? [];
    const sources = sourcesQ.data ?? [];
    const outstanding = outstandingQ.data ?? new Map<string, number>();
    const sourceById = new Map(sources.map((s) => [s.id, s]));

    return accounts
      .filter(
        (a) =>
          !a.archived_at &&
          a.type === "checking" &&
          a.credit_limit_cents != null &&
          a.credit_limit_cents > 0,
      )
      .map<Row>((a) => {
        const src = sourceById.get(a.source_id);
        return {
          account: a,
          source: src,
          sourceName: sourceLabel(src) || "—",
          dotColor: accountDisplayColor(a, src),
          used: outstanding.get(a.id) ?? 0,
          limit: a.credit_limit_cents ?? 0,
        };
      });
  }, [accountsQ.data, sourcesQ.data, outstandingQ.data]);

  const totalUsed = rows.reduce((s, r) => s + r.used, 0);
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalAvailable = Math.max(0, totalLimit - totalUsed);

  const loading = accountsQ.isLoading || outstandingQ.isLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Credit cards</CardTitle>
            <CardDescription>
              Outstanding charges and available credit per checking.
            </CardDescription>
          </div>
          {rows.length > 0 && (
            <div className="text-right">
              <div className="num font-display text-base font-semibold">
                {fmtMoney(totalAvailable)}{" "}
                <span className="text-xs font-normal text-text-faint">
                  / {fmtMoney(totalLimit)}
                </span>
              </div>
              <div className="text-[10.5px] uppercase tracking-wider text-text-faint">
                Available
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-text-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-input border border-dashed border-border bg-surface-2/40 px-4 py-8 text-center text-sm text-text-muted">
            No credit limits configured. Add one when creating or editing a
            checking account.
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((r) => {
              const pct = r.limit > 0 ? Math.min(100, (r.used / r.limit) * 100) : 0;
              const tone =
                pct >= 90
                  ? "bg-expense"
                  : pct >= 60
                    ? "bg-brand"
                    : "bg-income";
              return (
                <li key={r.account.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: r.dotColor }}
                      />
                      <span className="truncate font-medium text-text">
                        {r.sourceName} · {r.account.name}
                      </span>
                    </div>
                    <div className="num shrink-0 text-right text-xs">
                      <span className="font-semibold text-expense">
                        {fmtMoney(r.used, { currency: r.account.currency })}
                      </span>
                      <span className="text-text-faint">
                        {" "}
                        / {fmtMoney(r.limit, { currency: r.account.currency })}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={cn("h-full rounded-full", tone)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-faint">
                      {pct.toFixed(0)}% used
                      {" · "}
                      {fmtMoney(r.limit - r.used, {
                        currency: r.account.currency,
                      })}{" "}
                      available
                    </span>
                    {r.used > 0 && (
                      <button
                        type="button"
                        onClick={() => setConfirmFor(r)}
                        className="font-medium text-text-muted underline-offset-2 hover:text-text hover:underline"
                      >
                        Pay bill
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog
        open={confirmFor !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmFor(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pay this credit card bill?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmFor && (
                <>
                  This will settle{" "}
                  <strong className="text-text">
                    {fmtMoney(confirmFor.used, {
                      currency: confirmFor.account.currency,
                    })}
                  </strong>{" "}
                  of outstanding charges on{" "}
                  <strong className="text-text">
                    {confirmFor.sourceName} · {confirmFor.account.name}
                  </strong>
                  . Those charges will start counting against your checking
                  balance from now.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmFor) {
                  settle.mutate(confirmFor.account.id);
                  setConfirmFor(null);
                }
              }}
            >
              Pay bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
