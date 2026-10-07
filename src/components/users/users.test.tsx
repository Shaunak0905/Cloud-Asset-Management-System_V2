// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MaintenanceFilters } from "@/components/maintenance/maintenance-filters";
import { ToastProvider } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";
import { parseMaintenanceListParams } from "@/lib/maintenance/schema";

import { AccountStatusButton } from "./account-status-button";
import { RoleForm } from "./role-form";
import { UserTable, type UserTableRow } from "./user-table";

const USER = "11111111-2222-4333-8444-555555555555";

describe("RoleForm", () => {
  function renderForm(result: FormState = { status: "success", savedAt: 1 }) {
    const action = vi.fn(async (): Promise<FormState> => result);
    render(
      <ToastProvider>
        <RoleForm
          action={action}
          role="STUDENT"
          userId={USER}
          userName="Priya Shah"
        />
      </ToastProvider>,
    );
    return action;
  }

  it("asks_before_changing_the_role_and_says_what_it_allows", async () => {
    const action = renderForm();
    const change = screen.getByRole("button", { name: "Change" });
    expect(change).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Role for Priya Shah"), {
      target: { value: "ADMIN" },
    });
    fireEvent.click(change);
    expect(action).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog", {
      name: "Change Priya Shah's role to Admin?",
    });
    expect(dialog).toHaveTextContent("manage everything");
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Change role" }),
      );
    });
    const [, data] = action.mock.calls[0] as unknown as [FormState, FormData];
    expect(data.get("role")).toBe("ADMIN");
    expect(screen.getByRole("status")).toHaveTextContent("Role changed.");
  });

  it("puts_the_role_back_when_cancelled", () => {
    renderForm();
    const select = screen.getByLabelText(
      "Role for Priya Shah",
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "TECHNICIAN" } });
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(select.value).toBe("STUDENT");
  });
});

describe("AccountStatusButton", () => {
  it("asks_before_deactivating", async () => {
    const action = vi.fn(async (): Promise<FormState> => ({
      status: "success",
      savedAt: 1,
    }));
    render(
      <ToastProvider>
        <AccountStatusButton action={action} active userName="Priya Shah" />
      </ToastProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Deactivate Priya Shah" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Deactivate Priya Shah?",
    });
    expect(dialog).toHaveTextContent("Their history is kept");
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Deactivate" }),
      );
    });
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Account deactivated.",
    );
  });
});

describe("UserTable", () => {
  const rows: UserTableRow[] = [
    {
      id: "admin-1",
      full_name: "Asha Admin",
      email: "asha@campus.edu",
      role: "ADMIN",
      department: null,
      is_active: true,
      created_at: "2026-09-28T05:00:00Z",
    },
    {
      id: USER,
      full_name: "Priya Shah",
      email: "priya@campus.edu",
      role: "STUDENT",
      department: "Physics",
      is_active: false,
      created_at: "2026-09-29T05:00:00Z",
    },
  ];

  it("gives_no_controls_on_the_admins_own_row", () => {
    render(
      <ToastProvider>
        <UserTable
          rows={rows}
          viewerId="admin-1"
          roleAction={() => async () => ({ status: "idle" })}
          statusAction={() => async () => ({ status: "idle" })}
        />
      </ToastProvider>,
    );
    const [, self, other] = screen.getAllByRole("row");
    expect(self).toHaveTextContent("Asha Admin (you)");
    expect(within(self).queryByRole("button")).toBeNull();
    expect(within(self).queryByRole("combobox")).toBeNull();

    expect(other).toHaveTextContent("Inactive");
    expect(
      within(other).getByRole("button", { name: "Reactivate Priya Shah" }),
    ).toBeInTheDocument();
    expect(within(other).getByLabelText("Role for Priya Shah")).toHaveValue(
      "STUDENT",
    );
  });
});

describe("MaintenanceFilters", () => {
  it("offers_the_technician_filter_only_when_technicians_are_given", () => {
    const params = parseMaintenanceListParams({
      technician: "unassigned",
      sort: "oldest",
    });
    const { rerender } = render(
      <MaintenanceFilters
        basePath="/admin/maintenance"
        params={params}
        technicians={[{ id: USER, full_name: "Ravi Kumar" }]}
      />,
    );
    const technician = screen.getByLabelText("Technician") as HTMLSelectElement;
    expect(technician.value).toBe("unassigned");
    expect(
      within(technician).getByRole("option", { name: "Ravi Kumar" }),
    ).toBeInTheDocument();
    expect((screen.getByLabelText("Sort by") as HTMLSelectElement).value).toBe(
      "oldest",
    );
    expect(screen.getByLabelText("Reported from")).toHaveAttribute(
      "type",
      "date",
    );

    rerender(
      <MaintenanceFilters basePath="/technician/maintenance" params={params} />,
    );
    expect(screen.queryByLabelText("Technician")).toBeNull();
  });
});
