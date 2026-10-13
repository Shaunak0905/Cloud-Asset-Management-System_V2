import "server-only";

import { CAMPUS_TIME_ZONE, campusMonthStart } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import {
  type AdminDashboard,
  myDashboardSchema,
  parseAdminDashboard,
  type Sustainability,
  sustainabilitySchema,
  technicianDashboardSchema,
} from "./schema";

// Dashboard numbers come from database functions that count with GROUP BY
// as the signed-in user (RLS applies); nothing is counted in the browser.

function loadError(what: string, error: { code?: string; message: string }) {
  console.error(
    `[dashboard] failed to load ${what}:`,
    error.code,
    error.message,
  );
  return new Error(`Unable to load ${what}.`);
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard", {
    p_month_start: campusMonthStart(),
  });
  if (error) throw loadError("dashboard", error);
  return parseAdminDashboard(data);
}

/**
 * Sustainability figures (SDG 12) for admins, or null when they cannot be
 * loaded (e.g. the migration has not been applied yet): the section then
 * says so instead of breaking the rest of the dashboard.
 */
export async function getSustainability(): Promise<Sustainability | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sustainability_dashboard", {
    p_time_zone: CAMPUS_TIME_ZONE,
  });
  if (error) {
    loadError("sustainability figures", error);
    return null;
  }
  const parsed = sustainabilitySchema.safeParse(data);
  if (!parsed.success) {
    console.error("[dashboard] unexpected sustainability result");
    return null;
  }
  return parsed.data;
}

export async function getTechnicianDashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("technician_dashboard", {
    p_month_start: campusMonthStart(),
  });
  if (error) throw loadError("dashboard", error);
  return technicianDashboardSchema.parse(data);
}

export async function getMyDashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_dashboard");
  if (error) throw loadError("dashboard", error);
  return myDashboardSchema.parse(data);
}
