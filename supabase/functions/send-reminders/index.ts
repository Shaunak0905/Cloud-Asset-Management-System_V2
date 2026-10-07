// Supabase Edge Function entry point (Deno). The logic lives in reminders.ts.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase in the
// Edge Function environment. Secrets set by you (see README → Reminders):
//   REMINDERS_SECRET       required; shared with the cron job
//   REMINDERS_SERVICE_KEY  optional; the project's service_role key, used
//                          instead of the injected one when that is refused
//                          by the REST API ("JWT issued at future")
import { handleReminders } from "./reminders.ts";

Deno.serve((request) =>
  handleReminders(request, {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey:
      Deno.env.get("REMINDERS_SERVICE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      "",
    secret: Deno.env.get("REMINDERS_SECRET") ?? "",
  }),
);
