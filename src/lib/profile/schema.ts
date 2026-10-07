import { z } from "zod";

/** Optional text field: trimmed, empty becomes null. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value));
}

// Limits mirror the profiles table constraints.
export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your full name.")
    .max(200, "Full name must be 200 characters or fewer."),
  department: optionalText(100, "Department"),
  phone: z
    .string()
    .trim()
    .max(30, "Phone must be 30 characters or fewer.")
    .regex(/^[0-9+()\-\s]*$/, "Use digits, spaces and + ( ) - only.")
    .transform((value) => (value === "" ? null : value)),
});

export {
  initialProfileFormState,
  type ProfileFormState,
  type ProfileValues,
} from "./state";
