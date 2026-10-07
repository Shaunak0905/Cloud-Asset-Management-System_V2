import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { canAccessPath, isProtectedPath } from "@/lib/auth/routes";
import { Constants } from "@/types/database";

import { isNavItemActive, navigationForRole } from "./navigation";

const ROLES = Constants.public.Enums.user_role;
const APP_GROUP = path.resolve(import.meta.dirname, "../app/(app)");

describe("navigationForRole", () => {
  it.each(ROLES)(
    "links_%s_only_to_protected_pages_the_role_may_open",
    (role) => {
      for (const item of navigationForRole(role)) {
        expect(isProtectedPath(item.href), item.href).toBe(true);
        expect(canAccessPath(role, item.href), item.href).toBe(true);
      }
    },
  );

  it.each(ROLES)("links_%s_only_to_pages_that_exist", (role) => {
    for (const item of navigationForRole(role)) {
      expect(
        existsSync(path.join(APP_GROUP, item.href, "page.tsx")),
        item.href,
      ).toBe(true);
    }
  });

  it.each(ROLES)("has_unique_links_for_%s", (role) => {
    const hrefs = navigationForRole(role).map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("gives_admins_the_management_sections", () => {
    expect(navigationForRole("ADMIN").map((item) => item.label)).toEqual([
      "Dashboard",
      "Assets",
      "Maintenance",
      "Buildings & Rooms",
      "Users",
      "Audit Logs",
      "Notifications",
      "Profile",
    ]);
  });

  it("gives_technicians_their_maintenance_queue", () => {
    expect(navigationForRole("TECHNICIAN").map((item) => item.label)).toEqual([
      "Dashboard",
      "My Maintenance",
      "Assets",
      "Notifications",
      "Profile",
    ]);
  });

  it("gives_staff_and_students_the_same_member_navigation", () => {
    const labels = [
      "Dashboard",
      "Assets",
      "My Assignments",
      "My Requests",
      "Notifications",
      "Profile",
    ];
    expect(navigationForRole("STUDENT").map((item) => item.label)).toEqual(
      labels,
    );
    expect(navigationForRole("STAFF").map((item) => item.label)).toEqual(
      labels,
    );
  });
});

describe("isNavItemActive", () => {
  const dashboard = navigationForRole("ADMIN")[0];
  const assets = navigationForRole("ADMIN")[1];

  it("matches_dashboards_exactly", () => {
    expect(isNavItemActive(dashboard, "/admin")).toBe(true);
    expect(isNavItemActive(dashboard, "/admin/assets")).toBe(false);
  });

  it("highlights_admin_assets_on_shared_asset_detail_pages", () => {
    expect(isNavItemActive(assets, "/assets/AST-2026-00001")).toBe(true);
    expect(isNavItemActive(dashboard, "/assets/AST-2026-00001")).toBe(false);
  });

  it("highlights_maintenance_on_shared_request_pages", () => {
    const adminMaintenance = navigationForRole("ADMIN")[2];
    const techMaintenance = navigationForRole("TECHNICIAN")[1];
    for (const item of [adminMaintenance, techMaintenance]) {
      expect(item.label).toMatch(/Maintenance/);
      expect(isNavItemActive(item, "/maintenance/MR-2026-0017")).toBe(true);
    }
    expect(isNavItemActive(assets, "/maintenance/MR-2026-0017")).toBe(false);
  });

  it("matches_sections_and_their_sub_pages", () => {
    expect(isNavItemActive(assets, "/admin/assets")).toBe(true);
    expect(isNavItemActive(assets, "/admin/assets/123/edit")).toBe(true);
    expect(isNavItemActive(assets, "/admin/assetsx")).toBe(false);
  });
});
