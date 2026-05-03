import { Toaster as Sonner } from "sonner";

import { useUIStore } from "@/stores/ui-store";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  const theme = useUIStore((s) => s.theme);
  return (
    <Sonner
      theme={theme}
      richColors
      closeButton
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface group-[.toaster]:text-text group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-text-muted",
          actionButton:
            "group-[.toast]:bg-brand group-[.toast]:text-brand-foreground",
          cancelButton:
            "group-[.toast]:bg-surface-2 group-[.toast]:text-text-muted",
        },
      }}
      {...props}
    />
  );
}
