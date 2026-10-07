"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast";
import { FLASH_PARAM, flashMessage } from "@/lib/flash";

/**
 * Shows the success message for a `?toast=<code>` redirect once, then removes
 * the parameter from the URL. Unknown codes are ignored.
 */
export function FlashToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const code = params.get(FLASH_PARAM);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!code) {
      handled.current = null;
      return;
    }
    if (handled.current === code) return;
    handled.current = code;

    const message = flashMessage(code);
    if (message) toast({ tone: "success", title: message });

    const next = new URLSearchParams(params.toString());
    next.delete(FLASH_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [code, params, pathname, router, toast]);

  return null;
}
