import { Archive, Link as LinkIcon, Pencil, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountForm } from "@/features/accounts/account-form";
import { useAccountBalances } from "@/features/accounts/balances-queries";
import { useCreditCardOutstanding } from "@/features/accounts/credit-card-queries";
import {
  useArchiveAccount,
  useCreateAccount,
  useUpdateAccount,
} from "@/features/accounts/mutations";
import { useAccounts } from "@/features/accounts/queries";
import {
  ACCOUNT_TYPE_LABEL,
  type Account,
} from "@/features/accounts/schemas";
import {
  useArchiveSource,
  useCreateSource,
  useUpdateSource,
} from "@/features/sources/mutations";
import {
  useConnectPluggyItem,
  useSyncFromPluggy,
} from "@/features/sources/pluggy-mutations";
import {
  methodsBySourceId,
  useSourcePaymentMethods,
  useSources,
} from "@/features/sources/queries";
import {
  PAYMENT_METHOD_LABEL,
  PluggySourceStatus,
  SOURCE_KIND_LABEL,
  isPluggyManaged,
  type Source,
} from "@/features/sources/schemas";
import { SourceForm } from "@/features/sources/source-form";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const PLUGGY_STATUS_TONE: Record<PluggySourceStatus, string> = {
  active: "bg-income",
  updating: "bg-brand animate-pulse",
  login_error: "bg-expense",
  outdated: "bg-amber-500",
  disconnected: "bg-text-faint",
};

const PLUGGY_STATUS_LABEL: Record<PluggySourceStatus, string> = {
  active: "Synced",
  updating: "Updating…",
  login_error: "Login error",
  outdated: "Out of date",
  disconnected: "Disconnected",
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export function SourcesSection() {
  const sourcesQ = useSources();
  const accountsQ = useAccounts();
  const balancesQ = useAccountBalances();
  const ccOutstandingQ = useCreditCardOutstanding();
  const methodsQ = useSourcePaymentMethods();

  const createSource = useCreateSource();
  const updateSource = useUpdateSource();
  const archiveSource = useArchiveSource();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const archiveAccount = useArchiveAccount();
  const syncFromPluggy = useSyncFromPluggy();
  const connectPluggyItem = useConnectPluggyItem();

  const [sourceDialog, setSourceDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; source: Source }
    | null
  >(null);

  const [accountDialog, setAccountDialog] = useState<
    | { mode: "create"; sourceId: string }
    | { mode: "edit"; account: Account }
    | null
  >(null);

  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [pluggyItemId, setPluggyItemId] = useState("");
  const [archiveSourceTarget, setArchiveSourceTarget] = useState<Source | null>(
    null,
  );
  const [archiveAccountTarget, setArchiveAccountTarget] = useState<Account | null>(
    null,
  );
  const [showArchived, setShowArchived] = useState(false);

  const sources = sourcesQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const methodsBySource = useMemo(
    () => methodsBySourceId(methodsQ.data ?? []),
    [methodsQ.data],
  );
  const accountsBySource = useMemo(() => {
    const m = new Map<string, Account[]>();
    for (const a of accounts) {
      const list = m.get(a.source_id) ?? [];
      list.push(a);
      m.set(a.source_id, list);
    }
    return m;
  }, [accounts]);

  const visibleSources = showArchived
    ? sources
    : sources.filter((s) => !s.archived_at);
  const pluggySources = visibleSources.filter(isPluggyManaged);
  const manualSources = visibleSources.filter((s) => !isPluggyManaged(s));

  const submitting =
    createSource.isPending || updateSource.isPending || archiveSource.isPending;
  const accountSubmitting =
    createAccount.isPending || updateAccount.isPending;

  function renderSourceCard(src: Source) {
    const allSrcAccounts = accountsBySource.get(src.id) ?? [];
    const srcAccounts = showArchived
      ? allSrcAccounts
      : allSrcAccounts.filter((a) => !a.archived_at);
    const srcMethods = methodsBySource.get(src.id) ?? [];
    const isArchived = !!src.archived_at;
    const isPlg = isPluggyManaged(src);
    const status = (src.pluggy_status ?? "active") as PluggySourceStatus;
    return (
      <div
        key={src.id}
        className={cn(
          "rounded-card border border-border bg-surface",
          isArchived && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: src.color ?? "#A8A29E" }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-display text-base font-semibold leading-tight">
                {src.name}
                {isPlg && (
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full",
                      PLUGGY_STATUS_TONE[status],
                    )}
                    title={PLUGGY_STATUS_LABEL[status]}
                  />
                )}
                {isArchived && (
                  <span className="text-[10.5px] font-medium uppercase tracking-wider text-text-faint">
                    archived
                  </span>
                )}
              </div>
              <div className="text-[11.5px] text-text-faint">
                {src.short_name ? `${src.short_name} · ` : ""}
                {SOURCE_KIND_LABEL[src.kind]}
                {isPlg && (
                  <>
                    {" · "}
                    {status === "login_error" ? (
                      <a
                        href="https://meu.pluggy.ai"
                        target="_blank"
                        rel="noreferrer"
                        className="text-expense underline"
                      >
                        Reconnect at meu.pluggy
                      </a>
                    ) : (
                      <span>
                        synced {timeAgo(src.pluggy_last_synced_at)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isPlg && !isArchived && (
              <button
                type="button"
                onClick={() => syncFromPluggy.mutate(src.id)}
                disabled={syncFromPluggy.isPending}
                className="rounded-md p-1 text-text-faint hover:bg-surface-2 hover:text-text disabled:opacity-50"
                aria-label={`Sync ${src.name} now`}
                title="Sync now"
              >
                <RefreshCw
                  className={cn(
                    "size-4",
                    syncFromPluggy.isPending && "animate-spin",
                  )}
                />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSourceDialog({ mode: "edit", source: src })}
              className="rounded-md p-1 text-text-faint hover:bg-surface-2 hover:text-text"
              aria-label={`Edit ${src.name}`}
            >
              <Pencil className="size-4" />
            </button>
            {!isArchived && (
              <button
                type="button"
                onClick={() => setArchiveSourceTarget(src)}
                className="rounded-md p-1 text-text-faint hover:bg-surface-2 hover:text-text"
                aria-label={`Archive ${src.name}`}
              >
                <Archive className="size-4" />
              </button>
            )}
          </div>
        </div>

        {srcMethods.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5">
            {srcMethods.map((m) => (
              <span
                key={m}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-text-muted"
              >
                {PAYMENT_METHOD_LABEL[m]}
              </span>
            ))}
          </div>
        )}

        <div>
          {srcAccounts.length === 0 ? (
            <div className="px-4 py-4 text-sm text-text-muted">
              No accounts inside this source yet.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {srcAccounts.map((acc) => {
                  const balance = balancesQ.data?.get(acc.id);
                  const accArchived = !!acc.archived_at;
                  const ccUsed = ccOutstandingQ.data?.get(acc.id) ?? 0;
                  return (
                    <tr
                      key={acc.id}
                      className={cn(
                        "group border-b border-border last:border-b-0 hover:bg-surface-2/60",
                        accArchived && "opacity-60",
                      )}
                    >
                      <td className="px-4 py-3 text-[13.5px]">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-sm"
                            style={{ background: src.color ?? "#A8A29E" }}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-text">
                              {ACCOUNT_TYPE_LABEL[acc.type]}
                              {accArchived && (
                                <span className="ml-2 text-[10.5px] font-medium uppercase tracking-wider text-text-faint">
                                  archived
                                </span>
                              )}
                            </div>
                            {acc.type === "checking" &&
                              acc.credit_limit_cents != null && (
                                <div className="text-[11.5px] text-text-faint">
                                  CC limit{" "}
                                  {fmtMoney(acc.credit_limit_cents, {
                                    currency: acc.currency,
                                  })}
                                </div>
                              )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[13.5px]">
                        <div className="num font-semibold">
                          {balance !== undefined ? (
                            fmtMoney(balance, { currency: acc.currency })
                          ) : (
                            <span className="text-text-faint">…</span>
                          )}
                        </div>
                        {acc.type === "checking" && ccUsed > 0 && (
                          <div className="text-[11px] text-text-faint">
                            CC outstanding{" "}
                            <span className="text-expense">
                              {fmtMoney(ccUsed, { currency: acc.currency })}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() =>
                              setAccountDialog({ mode: "edit", account: acc })
                            }
                            className="rounded-md p-1 text-text-faint hover:bg-surface-2 hover:text-text"
                            aria-label={`Edit ${acc.name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          {!accArchived && (
                            <button
                              type="button"
                              onClick={() => setArchiveAccountTarget(acc)}
                              className="rounded-md p-1 text-text-faint hover:bg-surface-2 hover:text-text"
                              aria-label={`Archive ${acc.name}`}
                            >
                              <Archive className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!isArchived && !isPlg && (
          <div className="border-t border-border px-4 py-2">
            <button
              type="button"
              onClick={() =>
                setAccountDialog({ mode: "create", sourceId: src.id })
              }
              className="text-xs text-text-muted hover:text-text"
            >
              + Add account to {src.name}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Sources</h2>
          <p className="text-sm text-text-muted">
            Banks, benefits providers, brokers — and the accounts that live
            inside each.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setConnectDialogOpen(true)}
            disabled={connectPluggyItem.isPending}
          >
            <LinkIcon className="size-3.5" />
            Connect Pluggy item
          </Button>
          <Button
            variant="outline"
            onClick={() => syncFromPluggy.mutate(undefined)}
            disabled={syncFromPluggy.isPending}
          >
            <RefreshCw
              className={cn(
                "size-3.5",
                syncFromPluggy.isPending && "animate-spin",
              )}
            />
            {syncFromPluggy.isPending ? "Syncing…" : "Sync from Pluggy"}
          </Button>
          <Button onClick={() => setSourceDialog({ mode: "create" })}>
            <Plus className="size-3.5" />
            Add source
          </Button>
        </div>
      </div>

      {sourcesQ.isLoading ? (
        <div className="rounded-card border border-border bg-surface-2 px-4 py-8 text-center text-sm text-text-muted">
          Loading sources…
        </div>
      ) : visibleSources.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-2 px-4 py-8 text-center text-sm text-text-muted">
          No sources yet. Add one above.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {pluggySources.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                Pluggy-managed
              </h3>
              <div className="flex flex-col gap-3">
                {pluggySources.map((src) => renderSourceCard(src))}
              </div>
            </div>
          )}
          {manualSources.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                Manual
              </h3>
              <div className="flex flex-col gap-3">
                {manualSources.map((src) => renderSourceCard(src))}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowArchived((v) => !v)}
        className="self-start text-xs text-text-faint hover:text-text-muted"
      >
        {showArchived ? "Hide archived" : "Show archived"}
      </button>

      <Dialog
        open={connectDialogOpen}
        onOpenChange={(next) => {
          setConnectDialogOpen(next);
          if (!next) setPluggyItemId("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect a Pluggy item</DialogTitle>
            <DialogDescription>
              Pluggy doesn&rsquo;t expose a list-items API, so OmniFlow needs
              the item ID. Open{" "}
              <a
                href="https://meu.pluggy.ai"
                target="_blank"
                rel="noreferrer"
                className="text-brand underline"
              >
                meu.pluggy.ai
              </a>
              , pick the connection, and copy its ID — then paste it below.
              We&rsquo;ll validate, save the source, and pull the last 90
              days.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pluggyItemId.trim()) return;
              connectPluggyItem.mutate(pluggyItemId.trim(), {
                onSuccess: () => {
                  setConnectDialogOpen(false);
                  setPluggyItemId("");
                },
              });
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pluggy-item-id">Pluggy item ID</Label>
              <Input
                id="pluggy-item-id"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={pluggyItemId}
                onChange={(e) => setPluggyItemId(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConnectDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={connectPluggyItem.isPending || !pluggyItemId.trim()}
              >
                {connectPluggyItem.isPending ? "Connecting…" : "Connect & sync"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sourceDialog !== null}
        onOpenChange={(next) => {
          if (!next) setSourceDialog(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {sourceDialog?.mode === "edit" ? "Edit source" : "New source"}
            </DialogTitle>
            <DialogDescription>
              {sourceDialog?.mode === "edit"
                ? "Update name, kind, color, and which payment methods this source supports."
                : "An institution (bank, benefits provider, broker) and the accounts inside it."}
            </DialogDescription>
          </DialogHeader>
          {sourceDialog && (
            <SourceForm
              initial={sourceDialog.mode === "edit" ? sourceDialog.source : null}
              initialMethods={
                sourceDialog.mode === "edit"
                  ? methodsBySource.get(sourceDialog.source.id) ?? []
                  : undefined
              }
              submitting={submitting}
              onCancel={() => setSourceDialog(null)}
              onSubmit={(input) => {
                if (sourceDialog.mode === "edit") {
                  updateSource.mutate(
                    {
                      id: sourceDialog.source.id,
                      patch: {
                        name: input.name,
                        short_name: input.short_name ?? null,
                        kind: input.kind,
                        color: input.color,
                      },
                      methods: input.methods,
                    },
                    { onSuccess: () => setSourceDialog(null) },
                  );
                } else {
                  createSource.mutate(input, {
                    onSuccess: () => setSourceDialog(null),
                  });
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={accountDialog !== null}
        onOpenChange={(next) => {
          if (!next) setAccountDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accountDialog?.mode === "edit" ? "Edit account" : "New account"}
            </DialogTitle>
            <DialogDescription>
              {accountDialog?.mode === "edit"
                ? "Update name, balance, and credit card limit."
                : "Add an account inside this source."}
            </DialogDescription>
          </DialogHeader>
          {accountDialog && (
            <AccountForm
              initial={accountDialog.mode === "edit" ? accountDialog.account : null}
              sourceId={
                accountDialog.mode === "edit"
                  ? accountDialog.account.source_id
                  : accountDialog.sourceId
              }
              submitting={accountSubmitting}
              onCancel={() => setAccountDialog(null)}
              onSubmit={(input) => {
                if (accountDialog.mode === "edit") {
                  updateAccount.mutate(
                    { id: accountDialog.account.id, patch: input },
                    { onSuccess: () => setAccountDialog(null) },
                  );
                } else {
                  createAccount.mutate(input, {
                    onSuccess: () => setAccountDialog(null),
                  });
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={archiveSourceTarget !== null}
        onOpenChange={(next) => {
          if (!next) setArchiveSourceTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this source?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveSourceTarget && (
                <>
                  &ldquo;{archiveSourceTarget.name}&rdquo; and its accounts will
                  be hidden from new transactions and dropdowns. Existing
                  transactions still reference them. You can unarchive later.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveSourceTarget) {
                  archiveSource.mutate(archiveSourceTarget.id);
                  setArchiveSourceTarget(null);
                }
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={archiveAccountTarget !== null}
        onOpenChange={(next) => {
          if (!next) setArchiveAccountTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAccountTarget && (
                <>
                  &ldquo;{archiveAccountTarget.name}&rdquo; will be hidden from
                  new transactions. Existing transactions still reference it.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveAccountTarget) {
                  archiveAccount.mutate(archiveAccountTarget.id);
                  setArchiveAccountTarget(null);
                }
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
