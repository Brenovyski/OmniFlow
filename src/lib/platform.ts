const detectMac = () => {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.platform;
  return /mac/i.test(platform);
};

export const isMac = detectMac();

export const cmdSymbol = isMac ? "⌘" : "Ctrl";

export function isCmdKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}
