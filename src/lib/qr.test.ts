import QRCode from "qrcode";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_STATUS_MESSAGES } from "@/lib/assets/public";
import { getAppUrl } from "@/lib/env";
import { Constants } from "@/types/database";

import {
  getAssetPublicUrl,
  isLocalAddress,
  PUBLIC_ID_PATTERN,
  QR_OPTIONS,
  qrFileName,
} from "./qr";

// docs/14-testing-and-quality-assurance.md §7 and §34.

const PROD = "https://assets.campus.edu";

/** The text a QR code actually carries, read back from its encoded segments. */
function encodedText(url: string): string {
  const qr = QRCode.create(url, {
    errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel,
  });
  return (qr.segments as Array<{ data: Uint8Array | string }>)
    .map((segment) =>
      typeof segment.data === "string"
        ? segment.data
        : new TextDecoder().decode(segment.data),
    )
    .join("");
}

describe("getAssetPublicUrl", () => {
  it("builds_the_public_asset_url_from_the_public_id", () => {
    expect(getAssetPublicUrl(PROD, "AST-2026-00142")).toBe(
      "https://assets.campus.edu/asset/AST-2026-00142",
    );
  });

  it("tolerates_a_trailing_slash_and_encodes_the_id", () => {
    expect(getAssetPublicUrl(`${PROD}/`, "AST-2026-00001")).toBe(
      "https://assets.campus.edu/asset/AST-2026-00001",
    );
    expect(getAssetPublicUrl(PROD, "a/b?c")).toBe(
      "https://assets.campus.edu/asset/a%2Fb%3Fc",
    );
  });

  it("gives_different_assets_different_urls", () => {
    expect(getAssetPublicUrl(PROD, "AST-2026-00001")).not.toBe(
      getAssetPublicUrl(PROD, "AST-2026-00002"),
    );
  });
});

describe("QR content", () => {
  it("encodes_exactly_the_public_url_and_nothing_else", () => {
    const url = getAssetPublicUrl(PROD, "AST-2026-00142");
    expect(encodedText(url)).toBe(url);
  });

  it("is_identical_when_regenerated_for_reprinting", async () => {
    const url = getAssetPublicUrl(PROD, "AST-2026-00142");
    const first = await QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });
    const second = await QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });
    expect(second).toBe(first);
  });

  it("differs_between_assets", async () => {
    const a = await QRCode.toString(getAssetPublicUrl(PROD, "AST-2026-00001"), {
      ...QR_OPTIONS,
      type: "svg",
    });
    const b = await QRCode.toString(getAssetPublicUrl(PROD, "AST-2026-00002"), {
      ...QR_OPTIONS,
      type: "svg",
    });
    expect(a).not.toBe(b);
  });

  it("uses_high_error_correction_and_a_quiet_zone", () => {
    expect(QR_OPTIONS).toEqual({ errorCorrectionLevel: "Q", margin: 4 });
  });
});

describe("qrFileName", () => {
  it("is_deterministic_and_safe", () => {
    expect(qrFileName("AST-2026-00142", "png")).toBe(
      "asset-qr-AST-2026-00142.png",
    );
    expect(qrFileName("../../etc", "svg")).toBe("asset-qr-etc.svg");
  });
});

describe("isLocalAddress", () => {
  it.each([
    "http://localhost:3000/asset/X",
    "http://127.0.0.1:3000/asset/X",
    "http://192.168.1.20:3000/asset/X",
    "http://172.16.1.167:3000/asset/X",
    "http://10.0.0.5/asset/X",
  ])("flags_%s", (url) => {
    expect(isLocalAddress(url)).toBe(true);
  });

  it.each([
    "https://assets.campus.edu/asset/X",
    "https://campus-assets.vercel.app/asset/X",
  ])("accepts_%s", (url) => {
    expect(isLocalAddress(url)).toBe(false);
  });
});

describe("PUBLIC_ID_PATTERN", () => {
  it("matches_generated_ids_and_rejects_junk", () => {
    expect(PUBLIC_ID_PATTERN.test("AST-2026-00142")).toBe(true);
    for (const bad of ["", "ab", "-AST", "AST 1", "AST/1", "x".repeat(65)]) {
      expect(PUBLIC_ID_PATTERN.test(bad), bad).toBe(false);
    }
  });
});

describe("getAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["https://assets.campus.edu", "https://assets.campus.edu"],
    ["https://assets.campus.edu/", "https://assets.campus.edu"],
    ["http://localhost:3000", "http://localhost:3000"],
    ["https://campus.edu/assets/", "https://campus.edu/assets"],
  ])("normalises_%s", (value, expected) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", value);
    expect(getAppUrl()).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "not a url",
    "ftp://campus.edu",
    "https://campus.edu/?x=1",
  ])("returns_null_for_%s", (value) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", value);
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", undefined);
    expect(getAppUrl()).toBeNull();
  });

  it("defaults_to_the_vercel_production_domain", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "campus-assets.vercel.app");
    expect(getAppUrl()).toBe("https://campus-assets.vercel.app");
  });

  it("prefers_the_configured_url_over_the_vercel_domain", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://assets.campus.edu");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "campus-assets.vercel.app");
    expect(getAppUrl()).toBe("https://assets.campus.edu");
  });
});

describe("public status wording", () => {
  it("covers_every_status", () => {
    for (const status of Constants.public.Enums.asset_status) {
      expect(PUBLIC_STATUS_MESSAGES[status].headline).toBeTruthy();
      expect(PUBLIC_STATUS_MESSAGES[status].detail).toBeTruthy();
    }
  });

  it("does_not_reveal_who_or_where_for_assets_in_use", () => {
    expect(PUBLIC_STATUS_MESSAGES.ASSIGNED.detail).toBe(
      "This asset is currently in use.",
    );
  });
});
