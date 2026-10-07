"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/types";
import type { FormAction } from "@/lib/forms";
import { useActionForm } from "@/lib/use-action-form";
import { Constants } from "@/types/database";

const ROLE_EFFECTS: Record<UserRole, string> = {
  ADMIN: "They will be able to manage everything, including users and roles.",
  TECHNICIAN:
    "They will be able to work on maintenance requests assigned to them.",
  STAFF: "They will be able to request assets and report problems.",
  STUDENT: "They will be able to request assets and report problems.",
};

/**
 * Admin: change one user's role (docs/05 §24). Asks for confirmation and
 * says what the new role allows; the database checks and audits the change.
 */
export function RoleForm({
  action,
  role,
  userId,
  userName,
}: {
  action: FormAction;
  role: UserRole;
  userId: string;
  userName: string;
}) {
  const [choice, setChoice] = useState<UserRole>(role);
  const [confirming, setConfirming] = useState(false);
  const confirmed = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending } = useActionForm(action);
  const toast = useToast();

  useEffect(() => {
    if (state.savedAt) {
      toast({ tone: "success", title: "Role changed." });
    }
  }, [state.savedAt, toast]);

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast({ tone: "error", title: state.message });
    }
  }, [state, toast]);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (!confirmed.current) {
          event.preventDefault();
          setConfirming(true);
          return;
        }
        confirmed.current = false;
        onSubmit(event);
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor={`role-${userId}`} className="sr-only">
        Role for {userName}
      </label>
      <div className="w-36 shrink-0">
        <Select
          id={`role-${userId}`}
          name="role"
          value={choice}
          onChange={(event) => setChoice(event.target.value as UserRole)}
        >
          {Constants.public.Enums.user_role.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </Select>
      </div>
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={choice === role || pending}
      >
        {pending ? "Saving…" : "Change"}
      </Button>

      <ConfirmDialog
        open={confirming}
        tone={choice === "ADMIN" || role === "ADMIN" ? "danger" : "primary"}
        title={`Change ${userName}'s role to ${ROLE_LABELS[choice]}?`}
        description={`${ROLE_EFFECTS[choice]} The change is recorded in the audit log.`}
        confirmLabel="Change role"
        onCancel={() => {
          setConfirming(false);
          setChoice(role);
        }}
        onConfirm={() => {
          confirmed.current = true;
          setConfirming(false);
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
