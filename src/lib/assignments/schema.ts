import { z } from "zod";

import { campusDateTimeToIso } from "@/lib/format";
import { optionalText, requiredId } from "@/lib/forms";

export const REQUEST_FORM_FIELDS = [
  "buildingId",
  "roomId",
  "expectedReturn",
  "notes",
] as const;

const MAX_LOAN_DAYS = 365;

/**
 * The asset request form. The expected return time is entered in campus time
 * and must be in the future and within a year (the database checks too).
 */
export function requestAssetSchema(now: Date = new Date()) {
  return z.object({
    buildingId: requiredId("Select the building where you will use it."),
    roomId: requiredId("Select the room where you will use it."),
    expectedReturn: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (value === "") return null;
        const iso = campusDateTimeToIso(value);
        if (!iso) {
          ctx.addIssue({
            code: "custom",
            message: "Enter a valid date and time.",
          });
          return z.NEVER;
        }
        const at = new Date(iso).getTime();
        if (at <= now.getTime()) {
          ctx.addIssue({
            code: "custom",
            message: "Expected return must be in the future.",
          });
          return z.NEVER;
        }
        if (at > now.getTime() + MAX_LOAN_DAYS * 86_400_000) {
          ctx.addIssue({
            code: "custom",
            message: "Expected return must be within a year.",
          });
          return z.NEVER;
        }
        return iso;
      }),
    notes: optionalText(1000, "Notes"),
  });
}

export const ASSIGN_FORM_FIELDS = [
  "userEmail",
  ...REQUEST_FORM_FIELDS,
] as const;

/** An admin assigning or transferring an asset: the request form plus who. */
export function assignAssetSchema(now: Date = new Date()) {
  return requestAssetSchema(now).extend({
    userEmail: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Enter the email address of the person receiving the asset.")
      .pipe(z.email("Enter a valid email address.")),
  });
}

/** SQLSTATE codes raised by the assignment workflow database functions. */
export const ASSIGNMENT_ERRORS = {
  unavailable: "CA001",
  invalidLocation: "CA002",
  invalidReturn: "CA003",
  closed: "CA004",
  inactiveUser: "CA005",
} as const;
