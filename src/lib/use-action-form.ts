"use client";

import {
  type FormEvent,
  startTransition,
  useActionState,
  useState,
  useTransition,
} from "react";

import {
  type FormAction,
  type FormState,
  initialFormState,
} from "./form-state";

/**
 * useActionState for forms that contain controlled fields (e.g. the
 * building → room selector).
 *
 * React resets a form submitted through its `action` prop, and the reset
 * blanks controlled <select>s while their React state keeps the old value.
 * Submitting via onSubmit + startTransition skips that reset, so every field
 * keeps what the user entered when the server returns validation errors.
 */
export function useActionForm(action: FormAction) {
  const [state, dispatch, pending] = useActionState(action, initialFormState);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return { state, onSubmit, pending };
}

/**
 * Like useActionForm, but calls `onSuccess` from the submission itself. For
 * forms that a successful save removes from the page (e.g. resolving a
 * request): an effect watching the state would never run, because the form
 * unmounts in the same update. The toast lives in the app shell, so feedback
 * given from `onSuccess` still shows.
 */
export function useActionFormWithSuccess(
  action: FormAction,
  onSuccess: (result: FormState) => void,
) {
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startPending] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startPending(async () => {
      const result = await action(state, formData);
      setState(result);
      if (result.status === "success") onSuccess(result);
    });
  }

  return { state, onSubmit, pending };
}
