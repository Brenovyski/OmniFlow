import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

export function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    const { error: err } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setSubmitting(false);

    if (err) {
      setError(err.message);
      return;
    }

    if (mode === "signup") {
      // If "Confirm email" is on in the Supabase project, the session is null
      // until the user clicks the link in their inbox. Surface that here.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setInfo("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
        return;
      }
    }
    // On success, AuthContext flips and RedirectIfAuthed sends us to /.
  };

  const isSignup = mode === "signup";

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
                {isSignup ? "Create account" : "Welcome back"}
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                {isSignup
                  ? "Set up your OmniFlow account."
                  : "Sign in to your OmniFlow account."}
              </p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-text-muted">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 rounded-input border border-border bg-surface px-3 text-sm focus-visible:border-brand focus-visible:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-text-muted">Password</span>
                <input
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 rounded-input border border-border bg-surface px-3 text-sm focus-visible:border-brand focus-visible:outline-none"
                />
              </label>

              {error && (
                <p className="text-center text-xs text-expense">{error}</p>
              )}
              {info && (
                <p className="text-center text-xs text-income">{info}</p>
              )}

              <Button type="submit" className="mt-2" disabled={submitting}>
                {submitting
                  ? isSignup
                    ? "Creating account…"
                    : "Signing in…"
                  : isSignup
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </form>

            <p className="text-center text-xs text-text-faint">
              {isSignup ? "Already have an account?" : "No account yet?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setMode(isSignup ? "signin" : "signup");
                }}
                className="font-medium text-brand-press hover:underline"
              >
                {isSignup ? "Sign in" : "Create one"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
