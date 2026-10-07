"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { BuildingRoomSelector } from "@/components/locations/building-room-selector";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ASSET_CATEGORIES } from "@/lib/assets/constants";
import type { FormAction } from "@/lib/forms";
import type { BuildingOption, RoomOption } from "@/lib/locations/types";
import { useActionForm } from "@/lib/use-action-form";

export type AssetFormDefaults = {
  name: string;
  category: string;
  serialNumber: string;
  department: string;
  buildingId: string;
  roomId: string;
  purchaseDate: string;
  warrantyUntil: string;
  description: string;
};

type AssetFormProps = {
  action: FormAction;
  buildings: BuildingOption[];
  departmentSuggestions: string[];
  /** Existing values when editing. */
  defaults?: AssetFormDefaults;
  /** Rooms of the default building (editing), shown without a loading step. */
  initialRooms?: RoomOption[];
  /** Latest allowed purchase date (campus today), YYYY-MM-DD. */
  today: string;
  submitLabel: string;
  cancelHref: string;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-4 w-full text-sm font-semibold text-slate-900">
        {title}
      </legend>
      <div className="clear-left space-y-4">{children}</div>
    </fieldset>
  );
}

export function AssetForm({
  action,
  buildings,
  departmentSuggestions,
  defaults,
  initialRooms,
  today,
  submitLabel,
  cancelHref,
}: AssetFormProps) {
  const { state, onSubmit, pending } = useActionForm(action);
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  const control = (id: string, field: string, hint?: string) => ({
    "aria-invalid": error(field) ? true : undefined,
    "aria-describedby": describedBy(id, { hint, error: error(field) }),
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-6"
      aria-busy={pending}
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}
      {state.fieldErrors && !state.message && (
        <Alert tone="error" title="Please check the form">
          Some fields need attention. They are marked below.
        </Alert>
      )}

      <Section title="Basic information">
        <Field id="asset-name" label="Asset name" error={error("name")}>
          <Input
            id="asset-name"
            name="name"
            required
            maxLength={200}
            placeholder="Epson Projector P-104"
            defaultValue={defaults?.name}
            {...control("asset-name", "name")}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="asset-category" label="Category" error={error("category")}>
            <Select
              id="asset-category"
              name="category"
              required
              defaultValue={defaults?.category ?? ""}
              {...control("asset-category", "category")}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {ASSET_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </Select>
          </Field>

          <Field
            id="asset-serial"
            label="Serial number (optional)"
            error={error("serialNumber")}
          >
            <Input
              id="asset-serial"
              name="serialNumber"
              maxLength={100}
              autoComplete="off"
              defaultValue={defaults?.serialNumber}
              {...control("asset-serial", "serialNumber")}
            />
          </Field>
        </div>

        <Field
          id="asset-department"
          label="Department (optional)"
          hint="Choose a suggestion or type a new department."
          error={error("department")}
        >
          <Input
            id="asset-department"
            name="department"
            maxLength={100}
            list="asset-department-options"
            autoComplete="off"
            defaultValue={defaults?.department}
            {...control(
              "asset-department",
              "department",
              "Choose a suggestion or type a new department.",
            )}
          />
          <datalist id="asset-department-options">
            {departmentSuggestions.map((department) => (
              <option key={department} value={department} />
            ))}
          </datalist>
        </Field>
      </Section>

      <Section title="Registered location">
        <p className="-mt-2 text-sm text-slate-600">
          Where the asset normally belongs. Temporary use elsewhere is recorded
          on assignments and never changes this.
        </p>
        <BuildingRoomSelector
          idPrefix="asset-location"
          buildings={buildings}
          buildingFieldName="buildingId"
          roomFieldName="roomId"
          buildingLabel="Registered building"
          roomLabel="Registered room"
          defaultBuildingId={defaults?.buildingId}
          defaultRoomId={defaults?.roomId}
          initialRooms={initialRooms}
          errors={{ building: error("buildingId"), room: error("roomId") }}
        />
      </Section>

      <Section title="Purchase & warranty">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="asset-purchase"
            label="Purchase date (optional)"
            error={error("purchaseDate")}
          >
            <Input
              id="asset-purchase"
              name="purchaseDate"
              type="date"
              max={today}
              defaultValue={defaults?.purchaseDate}
              {...control("asset-purchase", "purchaseDate")}
            />
          </Field>
          <Field
            id="asset-warranty"
            label="Warranty until (optional)"
            error={error("warrantyUntil")}
          >
            <Input
              id="asset-warranty"
              name="warrantyUntil"
              type="date"
              defaultValue={defaults?.warrantyUntil}
              {...control("asset-warranty", "warrantyUntil")}
            />
          </Field>
        </div>
      </Section>

      <Section title="Description">
        <Field
          id="asset-description"
          label="Description (optional)"
          error={error("description")}
        >
          <Textarea
            id="asset-description"
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={defaults?.description}
            {...control("asset-description", "description")}
          />
        </Field>
      </Section>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
        <Link
          href={cancelHref}
          className={buttonClasses({ variant: "secondary" })}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
