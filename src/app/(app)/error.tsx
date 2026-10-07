"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Error state for signed-in pages. It renders inside the app shell (the
 * layout above stays), so the navigation remains usable. Technical details
 * go to the console only; production errors from the server arrive without
 * their message anyway.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert">
      <EmptyState
        icon={TriangleAlert}
        title="This page could not be loaded"
        description="Something went wrong on our side or with the connection. Please try again. If it keeps happening, contact the administrator."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => retry()}>Try again</Button>
            {/* /login sends a signed-in user to their own home page. */}
            <Link
              href="/login"
              className={buttonClasses({ variant: "secondary" })}
            >
              Go to my home page
            </Link>
          </div>
        }
      />
    </div>
  );
}
