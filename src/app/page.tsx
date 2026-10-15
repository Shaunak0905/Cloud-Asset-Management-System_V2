import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cpu,
  Layers,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { AssetQuickLookup } from "@/components/home/asset-quick-lookup";
import { Brand } from "@/components/layout/brand";
import { buttonClasses } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand href="/" />
          <nav className="flex items-center gap-3">
            <Link
              href="#features"
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:block"
            >
              Features
            </Link>
            <Link
              href="#workflow"
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:block"
            >
              How it works
            </Link>
            <Link
              href="/login"
              className={buttonClasses({
                variant: "primary",
                size: "sm",
                className:
                  "bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-xs hover:from-blue-800 hover:to-indigo-800",
              })}
            >
              <span>Sign in</span>
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
        {/* Decorative Grid & Radial Glow */}
        <div
          aria-hidden="true"
          className="pattern-grid pointer-events-none absolute inset-0 opacity-60"
        />
        <div
          aria-hidden="true"
          className="glow-mesh pointer-events-none absolute inset-x-0 top-0 h-96"
        />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          {/* Top Live Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-blue-800 shadow-xs backdrop-blur-sm">
            <span className="flex size-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Cloud-Native Campus Asset Management • V2</span>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
              Live
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Every Campus Asset.{" "}
            <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              One QR Code Away.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Give physical projectors, lab equipment, and computers a persistent
            digital passport. Track custody, report defects with photo evidence,
            and manage technician SLAs without paperwork.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className={buttonClasses({
                variant: "primary",
                size: "md",
                className:
                  "h-11 bg-gradient-to-r from-blue-700 to-indigo-700 px-6 text-sm font-semibold text-white shadow-md shadow-blue-700/20 hover:from-blue-800 hover:to-indigo-800",
              })}
            >
              <span>Access Campus Portal</span>
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href="#features"
              className={buttonClasses({
                variant: "secondary",
                size: "md",
                className: "h-11 px-6 text-sm font-semibold",
              })}
            >
              <span>Explore Capabilities</span>
            </Link>
          </div>

          {/* Interactive Fast Lookup Box */}
          <div className="mt-12">
            <AssetQuickLookup />
          </div>
        </div>
      </section>

      {/* Highlights Grid */}
      <section id="features" className="border-t border-slate-200/80 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-blue-700 uppercase">
              Core Capabilities
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Engineered for Real-World Campus Operations
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
              A comprehensive toolkit covering equipment acquisition, location
              tracking, technician dispatch, and decommission.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1 */}
            <div className="group rounded-2xl border border-slate-200/90 bg-slate-50/50 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-lg">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <QrCode aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                QR Digital Passports
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Print scuff-resistant Q-level QR tags. Scanning opens an
                instant public view with serial, room, department, and warranty.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group rounded-2xl border border-slate-200/90 bg-slate-50/50 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:bg-white hover:shadow-lg">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                <Wrench aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                Rapid Problem Reporting
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Users report issues in under 30 seconds with photos. Dispatches
                alert technicians and track MTTR from triage to resolution.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group rounded-2xl border border-slate-200/90 bg-slate-50/50 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:bg-white hover:shadow-lg">
              <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                Multi-Role Governance
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Enforced by Postgres Row Level Security. Separate workspaces
                for Admins, Technicians, Staff, and Students.
              </p>
            </div>

            {/* Card 4 */}
            <div className="group rounded-2xl border border-slate-200/90 bg-slate-50/50 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:bg-white hover:shadow-lg">
              <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 transition-colors group-hover:bg-cyan-600 group-hover:text-white">
                <BarChart3 aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                Lifecycle & Auditing
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Tamper-proof audit logs record who checked out, moved, or
                serviced every item with complete historical accountability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works workflow */}
      <section id="workflow" className="border-t border-slate-200/80 bg-slate-50/70 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-blue-700 uppercase">
              Operational Lifecycle
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              From Delivery to Decommission
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                01
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                Inventory & Tag
              </h3>
              <p className="mt-1.5 text-xs text-slate-600">
                Administrators register new equipment, assign a building and room,
                and print unique QR identity stickers.
              </p>
            </div>

            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                02
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                Instant Scan
              </h3>
              <p className="mt-1.5 text-xs text-slate-600">
                Faculty or students scan the physical QR code with any mobile
                browser without installing an app.
              </p>
            </div>

            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                03
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                Request or Report
              </h3>
              <p className="mt-1.5 text-xs text-slate-600">
                Borrow assets with custody verification or submit instant repair
                tickets with camera photos.
              </p>
            </div>

            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                04
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                Resolve & Audit
              </h3>
              <p className="mt-1.5 text-xs text-slate-600">
                Technicians resolve tickets with proof. Every action is audited
                in Postgres and reflected on dashboards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-blue-700 text-white">
              <QrCode aria-hidden="true" className="size-3.5" />
            </span>
            <span className="text-xs font-semibold text-slate-800">
              Campus Asset Management System
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Powered by Next.js 16 (App Router) & Supabase PostgreSQL
          </p>
          <Link
            href="/login"
            className="text-xs font-medium text-blue-700 hover:text-blue-800"
          >
            Sign in to Portal →
          </Link>
        </div>
      </footer>
    </div>
  );
}
