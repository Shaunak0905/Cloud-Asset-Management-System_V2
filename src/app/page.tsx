import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-24">
      <div className="max-w-xl text-center">
        <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase">
          Cloud-Based Campus Asset System
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
          Campus Asset Management
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Every campus asset has a QR code. Scan it to view the asset, request
          it for use, or report a problem.
        </p>
        <div className="mt-8">
          <Link href="/login" className={buttonClasses()}>
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
