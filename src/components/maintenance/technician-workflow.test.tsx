// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

import {
  AssignTechnicianForm,
  type TechnicianChoice,
} from "./assign-technician-form";
import { StartWorkButton } from "./start-work-button";
import { WorkLog, type WorkLogEntry } from "./work-log";
import { WorkNoteForm } from "./work-note-form";

const RAVI: TechnicianChoice = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Ravi Kumar",
  email: "ravi@campus.edu",
};
const PRIYA: TechnicianChoice = {
  id: "22222222-2222-4222-8222-222222222222",
  full_name: "Priya Shah",
  email: "priya@campus.edu",
};

function submittedData(action: ReturnType<typeof vi.fn>) {
  const [, data] = action.mock.calls[0] as unknown as [FormState, FormData];
  return data;
}

describe("AssignTechnicianForm", () => {
  function renderForm(
    currentTechnicianId: string | null,
    result: FormState = { status: "success", savedAt: 1 },
    technicians = [RAVI, PRIYA],
  ) {
    const action = vi.fn(async (): Promise<FormState> => result);
    render(
      <ToastProvider>
        <AssignTechnicianForm
          action={action}
          technicians={technicians}
          currentTechnicianId={currentTechnicianId}
        />
      </ToastProvider>,
    );
    return action;
  }

  it("submits_the_chosen_technician_once_one_is_picked", async () => {
    const action = renderForm(null);
    const submit = screen.getByRole("button", { name: "Assign technician" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Technician"), {
      target: { value: PRIYA.id },
    });
    await act(async () => {
      fireEvent.click(submit);
    });

    expect(submittedData(action).get("technicianId")).toBe(PRIYA.id);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Technician assigned.",
    );
  });

  it("leaves_the_current_technician_out_when_reassigning", () => {
    renderForm(RAVI.id);
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      "Choose a technician",
      "Priya Shah (priya@campus.edu)",
    ]);
    expect(screen.getByRole("button", { name: "Reassign" })).toBeDisabled();
  });

  it("shows_the_reason_when_the_database_refuses", async () => {
    renderForm(null, {
      status: "error",
      fieldErrors: {
        technicianId: ["This person is no longer an active technician."],
      },
    });
    fireEvent.change(screen.getByLabelText("Technician"), {
      target: { value: RAVI.id },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Assign technician" }),
      );
    });
    expect(screen.getByLabelText("Technician")).toHaveAccessibleDescription(
      "This person is no longer an active technician.",
    );
  });

  it("explains_when_there_is_nobody_to_choose", () => {
    renderForm(RAVI.id, { status: "idle" }, [RAVI]);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText(/no other active technician/i)).toBeInTheDocument();
  });
});

describe("StartWorkButton", () => {
  function renderButton(result: FormState) {
    const action = vi.fn(async () => result);
    render(
      <ToastProvider>
        <StartWorkButton action={action} />
      </ToastProvider>,
    );
    return action;
  }

  it("starts_work_and_confirms", async () => {
    const action = renderButton({ status: "success", savedAt: 1 });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start work" }));
    });
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Work started.");
  });

  it("shows_the_reason_when_it_is_refused", async () => {
    renderButton({
      status: "error",
      message: "This request has been closed, so it can no longer change.",
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start work" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("has been closed");
  });
});

describe("WorkNoteForm", () => {
  function renderForm(result: FormState) {
    const action = vi.fn(async (): Promise<FormState> => result);
    render(
      <ToastProvider>
        <WorkNoteForm action={action} />
      </ToastProvider>,
    );
    return action;
  }

  const notes = () => screen.getByLabelText("Note") as HTMLTextAreaElement;
  const entryType = () =>
    screen.getByLabelText("Entry type") as HTMLSelectElement;

  it("offers_only_work_entries", () => {
    renderForm({ status: "idle" });
    expect(
      Array.from(entryType().options).map((option) => option.value),
    ).toEqual([
      "INSPECTION",
      "DIAGNOSIS",
      "REPAIR",
      "PART_REPLACEMENT",
      "TESTING",
      "NOTE",
    ]);
  });

  it("submits_the_entry_and_clears_the_form_once_saved", async () => {
    const action = renderForm({ status: "success", savedAt: 1 });
    fireEvent.change(entryType(), { target: { value: "REPAIR" } });
    fireEvent.change(notes(), { target: { value: "Replaced the lamp" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    });

    const data = submittedData(action);
    expect(data.get("action")).toBe("REPAIR");
    expect(data.get("notes")).toBe("Replaced the lamp");
    expect(notes().value).toBe("");
    expect(entryType().value).toBe("NOTE");
    expect(screen.getByRole("status")).toHaveTextContent("Note added.");
  });

  it("keeps_the_text_when_the_note_is_refused", async () => {
    renderForm({ status: "error", message: "Notes can only be added…" });
    fireEvent.change(notes(), { target: { value: "Checked the cable" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Notes can only be added",
    );
    expect(notes().value).toBe("Checked the cable");
  });
});

describe("WorkLog", () => {
  const entry = (overrides: Partial<WorkLogEntry>): WorkLogEntry => ({
    id: crypto.randomUUID(),
    action: "NOTE",
    notes: null,
    performed_at: "2026-10-01T09:30:00Z",
    performed_by: "someone",
    performer: null,
    ...overrides,
  });

  it("lists_entries_with_their_author_and_notes", () => {
    render(
      <WorkLog
        viewerId="me"
        entries={[
          entry({
            action: "REPORTED",
            performed_by: "student",
            performer: { full_name: "Asha Rao" },
          }),
          entry({ action: "ASSIGNED", notes: "Assigned to Ravi Kumar" }),
          entry({
            action: "DIAGNOSIS",
            performed_by: "me",
            notes: "HDMI board is faulty.",
          }),
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Reported · Asha Rao");
    // Author hidden from this viewer: no name is guessed.
    expect(items[1]).toHaveTextContent("Technician assigned");
    expect(items[1]).not.toHaveTextContent("·");
    expect(items[1]).toHaveTextContent("Assigned to Ravi Kumar");
    expect(items[2]).toHaveTextContent("Diagnosis · You");
    expect(items[2]).toHaveTextContent("HDMI board is faulty.");
  });

  it("says_when_nothing_is_recorded", () => {
    render(<WorkLog viewerId="me" entries={[]} />);
    expect(screen.getByText("Nothing recorded yet.")).toBeInTheDocument();
  });
});
