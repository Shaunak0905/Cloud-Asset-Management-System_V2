import Link from "next/link";

import { MessagePage } from "@/components/layout/message-page";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <MessagePage
      eyebrow="404"
      title="Page not found"
      actions={
        <Link href="/" className={buttonClasses()}>
          Back to home
        </Link>
      }
    >
      <p>The page you are looking for does not exist or has moved.</p>
    </MessagePage>
  );
}
