import { useMemo } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { useCommandStore, type CommandItem as Cmd } from "./registry";

const GROUP_ORDER = ["Navigate", "Actions", "Account"] as const;

export function CommandPaletteDialog() {
  const open = useCommandStore((s) => s.open);
  const setOpen = useCommandStore((s) => s.setOpen);
  const closePalette = useCommandStore((s) => s.closePalette);
  const commands = useCommandStore((s) => s.commands);

  const grouped = useMemo(() => {
    const buckets = new Map<string, Cmd[]>();
    for (const cmd of commands.values()) {
      const list = buckets.get(cmd.group) ?? [];
      list.push(cmd);
      buckets.set(cmd.group, list);
    }
    const ordered: { group: string; items: Cmd[] }[] = [];
    for (const g of GROUP_ORDER) {
      const items = buckets.get(g);
      if (items?.length) ordered.push({ group: g, items });
    }
    for (const [g, items] of buckets) {
      if ((GROUP_ORDER as readonly string[]).includes(g)) continue;
      ordered.push({ group: g, items });
    }
    return ordered;
  }, [commands]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[20%] z-50 w-full max-w-xl translate-x-[-50%] overflow-hidden rounded-card border border-border bg-surface shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-label="Command palette"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search for a page or action.
          </DialogPrimitive.Description>
          <Command label="Command palette" loop>
            <CommandInput placeholder="Type a command or search…" />
            <CommandList>
              <CommandEmpty>No matching command.</CommandEmpty>
              {grouped.map(({ group, items }) => (
                <CommandGroup key={group} heading={group}>
                  {items.map((cmd) => {
                    const Icon = cmd.icon;
                    return (
                      <CommandItem
                        key={cmd.id}
                        value={`${cmd.label} ${cmd.keywords?.join(" ") ?? ""}`}
                        onSelect={() => {
                          closePalette();
                          // Defer so the close animation can start before the
                          // command runs (some commands navigate away).
                          requestAnimationFrame(() => cmd.run());
                        }}
                      >
                        {Icon && (
                          <Icon className="size-[15px] shrink-0 text-text-faint" />
                        )}
                        <span className="flex-1">{cmd.label}</span>
                        {cmd.hint && <CommandShortcut>{cmd.hint}</CommandShortcut>}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-text-faint">
              <span>
                <kbd className="font-mono">↑</kbd>{" "}
                <kbd className="font-mono">↓</kbd> navigate
              </span>
              <span>
                <kbd className="font-mono">↵</kbd> select
              </span>
              <span>
                <kbd className="font-mono">esc</kbd> close
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
