import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSupabaseConfig,
  requireSupabaseConfig,
  SupabaseNotConfiguredError,
} from "./env";

const VALID_URL = "https://example-project.supabase.co";
const VALID_KEY = "test-anon-key";

function setEnv(url: string | undefined, key: string | undefined) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabaseConfig", () => {
  it("returns_config_when_both_values_are_valid", () => {
    setEnv(VALID_URL, VALID_KEY);
    expect(getSupabaseConfig()).toEqual({
      ok: true,
      config: { url: VALID_URL, anonKey: VALID_KEY },
    });
  });

  it("accepts_local_http_url_for_supabase_cli", () => {
    setEnv("http://127.0.0.1:54321", VALID_KEY);
    expect(getSupabaseConfig().ok).toBe(true);
  });

  it("reports_both_variables_when_unset", () => {
    setEnv(undefined, undefined);
    expect(getSupabaseConfig()).toEqual({
      ok: false,
      problems: [
        "NEXT_PUBLIC_SUPABASE_URL is not set",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
      ],
    });
  });

  it("treats_empty_and_blank_values_as_not_set", () => {
    setEnv("", "   ");
    expect(getSupabaseConfig()).toEqual({
      ok: false,
      problems: [
        "NEXT_PUBLIC_SUPABASE_URL is not set",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
      ],
    });
  });

  it("rejects_malformed_or_non_http_url", () => {
    for (const url of ["not-a-url", "ftp://example.com"]) {
      setEnv(url, VALID_KEY);
      expect(getSupabaseConfig()).toEqual({
        ok: false,
        problems: ["NEXT_PUBLIC_SUPABASE_URL is invalid"],
      });
    }
  });

  it("never_includes_the_key_value_in_problems", () => {
    setEnv("not-a-url", "super-secret-value");
    const result = getSupabaseConfig();
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });
});

describe("requireSupabaseConfig", () => {
  it("throws_a_typed_error_when_not_configured", () => {
    setEnv(undefined, VALID_KEY);
    expect(() => requireSupabaseConfig()).toThrow(SupabaseNotConfiguredError);
  });

  it("returns_config_when_configured", () => {
    setEnv(VALID_URL, VALID_KEY);
    expect(requireSupabaseConfig()).toEqual({
      url: VALID_URL,
      anonKey: VALID_KEY,
    });
  });
});
