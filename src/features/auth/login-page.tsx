import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LoginPage() {
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate("/", { replace: true });
  };

  return (
    <div
      className="grid min-h-screen place-items-center p-6"
      style={{
        background:
          "radial-gradient(ellipse at top, hsl(var(--brand) / 0.12), transparent 60%), hsl(var(--background))",
      }}
    >
      <div className="w-full max-w-[380px]">
        <img
          src="/volt.svg"
          alt="OmniFlow"
          className="mx-auto mb-[18px] block h-[168px] w-[168px]"
        />
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold tracking-tight">
                Welcome back
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                Sign in to your OmniFlow account.
              </p>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-text-muted">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  className="h-9 rounded-input border border-border bg-surface px-3 text-sm focus-visible:border-brand focus-visible:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-text-muted">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-9 rounded-input border border-border bg-surface px-3 text-sm focus-visible:border-brand focus-visible:outline-none"
                />
              </label>
              <Button type="submit" className="mt-2">
                Sign in
              </Button>
            </form>
            <p className="text-center text-xs text-text-faint">
              Auth is wired in step 2.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
