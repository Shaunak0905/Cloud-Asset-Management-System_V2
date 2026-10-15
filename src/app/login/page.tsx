import {
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Wrench,
} from "lucide-react";
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
    <main className="flex min-h-screen flex-1 flex-col lg:grid lg:grid-cols-12">
      {/* Visual Showcase Panel (Desktop) */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white lg:col-span-6 lg:flex xl:col-span-7">
        {/* Ambient background glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-96 rounded-full bg-blue-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-96 rounded-full bg-indigo-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pattern-dots pointer-events-none absolute inset-0 opacity-20"
        />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2.5 font-semibold text-white transition-opacity hover:opacity-90"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-md shadow-blue-500/20">
              <QrCode aria-hidden="true" className="size-5" />
            </span>
            <span className="tracking-tight text-lg">Campus Assets</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>Back to Overview</span>
          </Link>
        </div>

        {/* Center Content */}
        <div className="relative z-10 my-auto max-w-lg space-y-8 py-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 backdrop-blur-xs">
            <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
            Cloud-Native Campus Hardware Network
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-white xl:text-4xl">
              Digital identity for physical equipment, managed in real time.
            </h1>
            <p className="text-base text-slate-300">
              Scan QR labels, triage repairs with photos, track asset custody,
              and maintain compliance with automated PostgreSQL Row Level
              Security.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid gap-3 pt-2">
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs transition-colors hover:bg-white/10">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                <QrCode aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Instant QR Tagging
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Unique printable QR stickers link directly to public specs and
                  maintenance request flows.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs transition-colors hover:bg-white/10">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <Wrench aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Technician Workflows
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Assign maintenance tickets, upload photographic resolution
                  proof, and monitor MTTR.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs transition-colors hover:bg-white/10">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                <ShieldCheck aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Role-Based Isolation
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Dedicated consoles for Administrators, Technicians, Staff, and
                  Students.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <LockKeyhole aria-hidden="true" className="size-3.5 text-blue-400" />
            <span>Enterprise-Grade RLS Protection</span>
          </div>
          <span>Next.js 16 • Supabase</span>
        </div>
      </section>

      {/* Auth Form Panel */}
      <section className="flex flex-1 flex-col justify-center bg-slate-50 px-6 py-12 sm:px-12 lg:col-span-6 xl:col-span-5">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile brand header */}
          <div className="mb-6 lg:hidden">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              <span>Back to Campus Overview</span>
            </Link>
          </div>

          <div className="mb-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-md shadow-blue-600/20">
              <QrCode aria-hidden="true" className="size-5" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              Sign in
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              {nextPath
                ? "Please sign in to proceed to your destination."
                : "Enter your campus credentials to continue."}
            </p>
          </div>

          {/* Form Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <LoginForm next={nextPath} />
          </div>

          {/* Role Access Information Pills */}
          <div className="mt-6 rounded-xl border border-slate-200/80 bg-white/70 p-4 text-xs text-slate-600 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <CheckCircle2 aria-hidden="true" className="size-3.5 text-blue-600" />
              <span>Automated Role Routing</span>
            </div>
            <p className="mt-1 leading-relaxed text-slate-500">
              Your profile determines your workspace:{" "}
              <strong className="text-slate-700">Admin</strong> (/admin),{" "}
              <strong className="text-slate-700">Technician</strong> (/technician), or{" "}
              <strong className="text-slate-700">Staff/Student</strong> (/dashboard).
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Accounts are created by the campus administrator in Supabase Auth.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
