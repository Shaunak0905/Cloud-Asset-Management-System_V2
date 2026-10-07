// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FormState } from "@/lib/forms";

import { ReportProblemForm } from "./report-problem-form";

function renderForm(
  assetStatus: "AVAILABLE" | "ASSIGNED" | "DAMAGED" = "AVAILABLE",
  result: FormState = { status: "error", message: "Try again." },
) {
  const action = vi.fn(async (): Promise<FormState> => result);
  render(
    <ReportProblemForm
      action={action}
      assetStatus={assetStatus}
      cancelHref="/assets/AST-2026-00001"
    />,
  );
  return action;
}

const description = () =>
  screen.getByLabelText("What is the problem?") as HTMLTextAreaElement;
const priority = (name: RegExp) =>
  screen.getByRole("radio", { name }) as HTMLInputElement;

describe("ReportProblemForm", () => {
  it("submits_the_description_and_priority_and_keeps_them_after_an_error", async () => {
    const action = renderForm();
    fireEvent.change(description(), {
      target: { value: "Powers on, no image" },
    });
    fireEvent.click(priority(/^High/));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    });

    const [, submitted] = action.mock.calls[0] as unknown as [
      FormState,
      FormData,
    ];
    expect(submitted.get("description")).toBe("Powers on, no image");
    expect(submitted.get("priority")).toBe("HIGH");
    expect(screen.getByRole("alert")).toHaveTextContent("Try again.");
    expect(description().value).toBe("Powers on, no image");
    expect(priority(/^High/).checked).toBe(true);
  });

  it("names_each_priority_and_explains_it", () => {
    renderForm();
    expect(priority(/^Critical$/)).toHaveAccessibleDescription(
      "Unusable or unsafe.",
    );
  });

  it("warns_that_serious_problems_take_an_available_asset_out_of_service", () => {
    renderForm("AVAILABLE");
    fireEvent.click(priority(/^Low/));
    expect(screen.queryByText(/marked/)).not.toBeInTheDocument();
    fireEvent.click(priority(/^Critical/));
    expect(screen.getByText(/nobody takes it/)).toBeInTheDocument();
  });

  it("explains_that_an_assigned_asset_stays_with_its_user", () => {
    renderForm("ASSIGNED");
    fireEvent.click(priority(/^High/));
    expect(screen.getByText(/stays with the person/)).toBeInTheDocument();
  });

  it("shows_a_missing_priority_on_the_group", async () => {
    renderForm("AVAILABLE", {
      status: "error",
      fieldErrors: { priority: ["Choose how serious the problem is."] },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    });
    expect(
      screen.getByRole("group", { name: "How serious is it?" }),
    ).toHaveAccessibleDescription("Choose how serious the problem is.");
  });
});
