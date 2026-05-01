import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PlaceholderPage({ title, subtitle, children }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
        )}
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-text-faint">
            Coming soon
          </span>
          <CardTitle className="text-base">Nothing here yet</CardTitle>
          <CardDescription>
            This view is scaffolded. Real content lands in the next step.
          </CardDescription>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
