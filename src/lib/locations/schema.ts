import { z } from "zod";

import {
  checkbox,
  type FormState,
  initialFormState,
  optionalText,
} from "@/lib/forms";

// Rules mirror the buildings/rooms table constraints, so users get a clear
// message before the database would reject the value.

export const buildingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the building name.")
    .max(100, "Building name must be 100 characters or fewer."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,10}$/, "Use 1–10 letters or digits, e.g. VY."),
  description: optionalText(500, "Description"),
});

export const buildingUpdateSchema = buildingSchema.extend({
  isActive: checkbox,
});

export const roomSchema = z.object({
  roomNumber: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9 _-]{0,19}$/,
      "Use up to 20 letters, digits, spaces, - or _, e.g. VY101.",
    ),
  displayName: optionalText(100, "Room name"),
});

export const roomUpdateSchema = roomSchema.extend({ isActive: checkbox });

export const idSchema = z.uuid();

export type LocationFormState = FormState;

export const initialLocationFormState = initialFormState;
