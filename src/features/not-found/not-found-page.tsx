import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="flex max-w-[420px] flex-col items-center text-center">
        <img
          src="/volt.svg"
          alt=""
          className="h-[140px] w-[140px] opacity-95"
        />
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          Off the flow
        </h1>
        <p className="mt-2 text-text-muted">
          The page you were looking for doesn&apos;t exist.
        </p>
        <Link to="/" className={buttonVariants({ variant: "outline" }) + " mt-5"}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
