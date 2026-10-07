// The form state shared by Server Actions and the client forms that call
// them. Kept free of zod so client components do not ship it (validation
// helpers live in ./forms, which only server code imports for values).

/** Result of a form Server Action, consumed with useActionState. */
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Submitted values, echoed back so fields keep them after an error. */
  values?: Record<string, string>;
  /** Changes on every successful save so forms can react. */
  savedAt?: number;
};

export const initialFormState: FormState = { status: "idle" };

export type FormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;
