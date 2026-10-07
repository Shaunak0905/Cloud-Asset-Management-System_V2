"use client";

import { useEffect } from "react";

import { MessagePage } from "@/components/layout/message-page";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Technical details go to the console only, never to the page.
    console.error(error);
  }, [error]);

  return (
    <MessagePage
      title="Something went wrong"
      actions={<Button onClick={() => retry()}>Try again</Button>}
    >
      <p>
        The page could not be loaded. Please try again. If the problem
        continues, contact the administrator.
      </p>
    </MessagePage>
  );
}
