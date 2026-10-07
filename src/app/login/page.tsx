import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getAuthState } from "@/lib/auth/current-user";
import {
  ACCOUNT_INACTIVE_PATH,
  postLoginPath,
  safeRedirectPath,
} from "@/lib/auth/routes";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeRedirectPath(next) ?? undefined;

  const auth = await getAuthState();
  if (auth.status === "active") {
    redirect(postLoginPath(auth.user.role, nextPath));
  }
  if (auth.status === "inactive" || auth.status === "missing_profile") {
    redirect(ACCOUNT_INACTIVE_PATH);
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-sm font-semibold tracking-wide text-blue-700 uppercase"
          >
            Campus Asset Management
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {nextPath
              ? "Please sign in to continue."
              : "Use your campus account to continue."}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm next={nextPath} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Accounts are created by the campus administrator.
        </p>
      </div>
    </main>
  );
}
