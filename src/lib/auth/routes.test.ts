import { describe, expect, it } from "vitest";

import {
  canAccessPath,
  homePathForRole,
  isProtectedPath,
  loginPathWithNext,
  postLoginPath,
  safeRedirectPath,
} from "./routes";

describe("isProtectedPath", () => {
  it.each([
    "/dashboard",
    "/assets",
    "/assets/123",
    "/maintenance/new",
    "/assignments",
    "/profile",
    "/admin",
    "/admin/users",
    "/technician/requests/1",
    "/account-inactive",
  ])("protects_%s", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/login",
    "/asset/AST-2026-00001",
    "/forbidden",
    "/api/health",
    "/administrator",
    "/assetsx",
  ])("leaves_%s_public", (path) => {
    expect(isProtectedPath(path)).toBe(false);
  });
});

describe("canAccessPath", () => {
  it("limits_admin_routes_to_admins", () => {
    expect(canAccessPath("ADMIN", "/admin/assets")).toBe(true);
    expect(canAccessPath("TECHNICIAN", "/admin")).toBe(false);
    expect(canAccessPath("STAFF", "/admin/users")).toBe(false);
    expect(canAccessPath("STUDENT", "/admin")).toBe(false);
  });

  it("limits_technician_routes_to_technicians", () => {
    expect(canAccessPath("TECHNICIAN", "/technician/requests")).toBe(true);
    expect(canAccessPath("ADMIN", "/technician")).toBe(false);
    expect(canAccessPath("STUDENT", "/technician")).toBe(false);
  });

  it("allows_every_role_on_shared_and_public_routes", () => {
    for (const role of ["ADMIN", "TECHNICIAN", "STAFF", "STUDENT"] as const) {
      expect(canAccessPath(role, "/assets")).toBe(true);
      expect(canAccessPath(role, "/asset/AST-2026-00001")).toBe(true);
    }
  });
});

describe("homePathForRole", () => {
  it("sends_each_role_to_its_dashboard", () => {
    expect(homePathForRole("ADMIN")).toBe("/admin");
    expect(homePathForRole("TECHNICIAN")).toBe("/technician");
    expect(homePathForRole("STAFF")).toBe("/dashboard");
    expect(homePathForRole("STUDENT")).toBe("/dashboard");
  });
});

describe("safeRedirectPath", () => {
  it.each([
    ["/assets", "/assets"],
    ["/asset/AST-2026-00001", "/asset/AST-2026-00001"],
    ["/assets?status=AVAILABLE&page=2", "/assets?status=AVAILABLE&page=2"],
  ])("accepts_%s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    ["absolute url", "https://evil.example/phish"],
    ["protocol-relative url", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["javascript url", "javascript:alert(1)"],
    ["relative path", "assets"],
    ["login loop", "/login?next=/admin"],
    ["control characters", "/assets\n"],
    ["non-string", ["/assets"]],
    ["missing", undefined],
  ])("rejects_%s", (_label, input) => {
    expect(safeRedirectPath(input)).toBeNull();
  });
});

describe("postLoginPath", () => {
  it("honours_a_safe_next_path_the_role_may_open", () => {
    expect(postLoginPath("STUDENT", "/asset/AST-2026-00001")).toBe(
      "/asset/AST-2026-00001",
    );
    expect(postLoginPath("ADMIN", "/admin/users")).toBe("/admin/users");
  });

  it("falls_back_to_the_role_home_for_forbidden_or_unsafe_next", () => {
    expect(postLoginPath("STUDENT", "/admin")).toBe("/dashboard");
    expect(postLoginPath("TECHNICIAN", "https://evil.example")).toBe(
      "/technician",
    );
    expect(postLoginPath("ADMIN", null)).toBe("/admin");
  });
});

describe("loginPathWithNext", () => {
  it("encodes_the_original_path_and_query", () => {
    expect(loginPathWithNext("/assets", "?status=AVAILABLE")).toBe(
      "/login?next=%2Fassets%3Fstatus%3DAVAILABLE",
    );
  });

  it("omits_next_for_the_home_page", () => {
    expect(loginPathWithNext("/")).toBe("/login");
  });
});
