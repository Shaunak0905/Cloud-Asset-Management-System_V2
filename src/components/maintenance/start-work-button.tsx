"use client";

import { Play } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

/**
 * "Start work" for the assigned technician (docs/08 §18). Not destructive,
 * so no confirmation; the page refreshes with the request IN_PROGRESS.
 */
export function StartWorkButton({
  action,
}: {
  action: () => Promise<FormState>;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function start() {
    startTransition(async () => {
      const result = await action();
      if (result.status === "success") {
        toast({ tone: "success", title: "Work started." });
      } else {
        toast({
          tone: "error",
          title: result.message ?? "Unable to start work.",
        });
      }
    });
  }

  return (
    <Button onClick={start} disabled={pending}>
      <Play aria-hidden className="size-4" />
      {pending ? "Starting…" : "Start work"}
    </Button>
  );
}
