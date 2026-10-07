"use client";

import { CheckCheck } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

/** Marks every notification read; the page and the badge refresh. */
export function MarkAllReadButton({
  action,
}: {
  action: () => Promise<FormState>;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          toast(
            result.status === "success"
              ? { tone: "success", title: "All notifications marked as read." }
              : {
                  tone: "error",
                  title: result.message ?? "Unable to update notifications.",
                },
          );
        })
      }
    >
      <CheckCheck aria-hidden className="size-4" />
      {pending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
