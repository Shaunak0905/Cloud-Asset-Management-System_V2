import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { MessagePage } from "@/components/layout/message-page";
import { getAuthState } from "@/lib/auth/current-user";
import { homePathForRole, LOGIN_PATH } from "@/lib/auth/routes";
import { SIGN_IN_MESSAGES } from "@/lib/auth/sign-in";

export const metadata: Metadata = { title: "Account unavailable" };

export default async function AccountInactivePage() {
  const auth = await getAuthState();
  if (auth.status === "anonymous") {
    redirect(LOGIN_PATH);
  }
  if (auth.status === "active") {
    redirect(homePathForRole(auth.user.role));
  }

  return (
    <MessagePage
      eyebrow="Account unavailable"
      title={
        auth.status === "inactive"
          ? "Your account is inactive"
          : "Account not set up"
      }
      actions={<SignOutButton />}
    >
      <p>
        {auth.status === "inactive"
          ? SIGN_IN_MESSAGES.inactive
          : SIGN_IN_MESSAGES.noProfile}
      </p>
    </MessagePage>
  );
}
