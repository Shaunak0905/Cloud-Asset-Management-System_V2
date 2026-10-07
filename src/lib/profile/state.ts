// Profile form values and state, shared by the action and the client form.
// Kept free of zod so the form does not ship it (validation: ./schema).

export type ProfileValues = {
  fullName: string;
  department: string;
  phone: string;
};

export type ProfileFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof ProfileValues, string[]>>;
  values?: ProfileValues;
  /** Changes on every successful save so the form can announce it. */
  savedAt?: number;
};

export const initialProfileFormState: ProfileFormState = { status: "idle" };
