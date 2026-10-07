import type { Metadata } from "next";

import { ProfileForm } from "@/components/profile/profile-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile" };

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" });

export default async function ProfilePage() {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, email, role, department, phone, created_at")
    .eq("id", user.id)
    .single();
  if (error) {
    console.error("[profile] load failed:", error.code);
    throw new Error("Unable to load your profile.");
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account and contact details."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Account" className="lg:col-span-1">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="mt-0.5 font-medium break-all text-slate-900">
                {profile.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd className="mt-1">
                <Badge tone="blue">{ROLE_LABELS[profile.role]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Member since</dt>
              <dd className="mt-0.5 text-slate-900">
                {dateFormat.format(new Date(profile.created_at))}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-xs text-slate-500">
            Your email and role are managed by the campus administrator.
          </p>
        </Card>

        <Card
          title="Contact details"
          description="Visible to administrators and to technicians handling your requests."
          className="lg:col-span-2"
        >
          <ProfileForm
            initial={{
              fullName: profile.full_name,
              department: profile.department ?? "",
              phone: profile.phone ?? "",
            }}
          />
        </Card>
      </div>
    </>
  );
}
