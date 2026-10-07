import { z } from "zod";

import type { FormState } from "./form-state";

export {
  type FormAction,
  type FormState,
  initialFormState,
} from "./form-state";

/** Reads text fields; missing fields and files become "". */
export function readFields(
  formData: FormData,
  keys: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    keys.map((key) => {
      const value = formData.get(key);
      return [key, typeof value === "string" ? value : ""];
    }),
  );
}

export function invalidForm(
  error: z.ZodError,
  values: Record<string, string>,
): FormState {
  return {
    status: "error",
    fieldErrors: z.flattenError(error).fieldErrors,
    values,
  };
}

/** Trimmed optional text; empty becomes null. */
export function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value));
}

/** HTML checkboxes submit "on" when ticked and nothing when not. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.null(), z.undefined()])
  .transform((value) => value === "on" || value === "true");

/** A required UUID chosen from a list (empty means "not chosen"). */
export function requiredId(message: string) {
  return z.string().trim().min(1, message).pipe(z.uuid(message));
}

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Optional YYYY-MM-DD date; empty becomes null. */
export const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || isIsoDate(value), "Enter a valid date.")
  .transform((value) => (value === "" ? null : value));
