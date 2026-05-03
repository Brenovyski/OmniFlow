import { useEffect } from "react";

import { useCommandStore, type CommandItem } from "./registry";

/**
 * Register a list of palette commands for the lifetime of a component.
 *
 * Pages call this on mount; the commands disappear from the palette when
 * the page unmounts. Pass a stable array (memoize or define outside the
 * render path) — the dependency check is reference-equality on `commands`.
 */
export function useRegisterCommands(commands: CommandItem[]) {
  const register = useCommandStore((s) => s.register);
  const unregister = useCommandStore((s) => s.unregister);

  useEffect(() => {
    register(commands);
    return () => unregister(commands.map((c) => c.id));
  }, [commands, register, unregister]);
}
