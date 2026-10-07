// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import QRCode from "qrcode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetQrCode } from "./asset-qr-code";

const URL_TO_ENCODE = "https://assets.campus.edu/asset/AST-2026-00142";
const FAKE_PNG = "data:image/png;base64,iVBORw0KGgo=";

// jsdom has no <canvas>, which the browser build of `qrcode` needs for PNGs,
// so PNG generation is stubbed here. What the code encodes is verified with
// the real library in src/lib/qr.test.ts; SVG below uses the real library.
beforeEach(() => {
  vi.spyOn(QRCode, "toDataURL").mockResolvedValue(FAKE_PNG as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderQr(
  props: Partial<Parameters<typeof AssetQrCode>[0]> = {},
) {
  await act(async () => {
    render(
      <AssetQrCode url={URL_TO_ENCODE} publicId="AST-2026-00142" {...props} />,
    );
  });
}

describe("AssetQrCode", () => {
  it("renders_the_generated_code_with_an_accessible_name", async () => {
    await renderQr();
    const image = screen.getByRole("img", {
      name: "QR code for asset AST-2026-00142",
    });
    expect(image).toHaveAttribute("src", FAKE_PNG);
    expect(QRCode.toDataURL).toHaveBeenCalledWith(URL_TO_ENCODE, {
      errorCorrectionLevel: "Q",
      margin: 4,
      width: 1024,
    });
  });

  it("offers_a_png_download_with_a_deterministic_file_name", async () => {
    await renderQr({
      withActions: true,
      printHref: "/admin/assets/AST-2026-00142/label",
    });
    const png = screen.getByRole("link", { name: "PNG" });
    expect(png).toHaveAttribute("download", "asset-qr-AST-2026-00142.png");
    expect(png).toHaveAttribute("href", FAKE_PNG);
    expect(screen.getByRole("link", { name: "Print label" })).toHaveAttribute(
      "href",
      "/admin/assets/AST-2026-00142/label",
    );
  });

  it("downloads_an_svg_of_the_same_url", async () => {
    const created: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      created.push(blob as Blob);
      return "blob:qr";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await renderQr({ withActions: true });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "SVG" }));
    });

    expect(click).toHaveBeenCalledOnce();
    const svg = await created[0].text();
    expect(svg).toBe(
      await QRCode.toString(URL_TO_ENCODE, {
        errorCorrectionLevel: "Q",
        margin: 4,
        type: "svg",
      }),
    );
  });

  it("hides_download_controls_on_labels", async () => {
    await renderQr();
    expect(screen.queryByRole("link", { name: "PNG" })).not.toBeInTheDocument();
  });

  it("shows_a_friendly_error_if_generation_fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(QRCode, "toDataURL").mockRejectedValue(new Error("boom") as never);
    await renderQr();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to generate QR code",
    );
  });
});
