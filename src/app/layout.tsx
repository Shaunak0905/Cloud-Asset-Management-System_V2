import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SetupRequired } from "@/components/setup-required";
import { ToastProvider } from "@/components/ui/toast";
import { getSupabaseConfig } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Campus Asset Management",
    template: "%s | Campus Asset Management",
  },
  description:
    "QR-based asset tracking and maintenance management for campus equipment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = getSupabaseConfig();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ToastProvider>
          {supabase.ok ? (
            children
          ) : (
            <SetupRequired problems={supabase.problems} />
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
