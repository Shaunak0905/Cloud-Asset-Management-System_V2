import Form from "next/form";
import Link from "next/link";

import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  AUDIT_ACTION_GROUPS,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_ENTITY_TYPES,
} from "@/lib/audit/events";
import { type AuditListParams, hasAuditFilters } from "@/lib/audit/schema";

/**
 * Audit filters (docs/13 §37, §39) as a GET form, so the URL holds the state
 * and filtered views can be bookmarked or shared between admins.
 */
export function AuditFilters({
  basePath,
  params,
}: {
  basePath: string;
  params: AuditListParams;
}) {
  return (
    <Form
      action={basePath}
      role="search"
      aria-label="Filter audit logs"
      className="mb-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect
          id="audit-action"
          name="action"
          label="Action"
          allLabel="All actions"
          value={params.action}
        >
          {AUDIT_ACTION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.actions.map((action) => (
                <option key={action} value={action}>
                  {AUDIT_ACTION_LABELS[action]}
                </option>
              ))}
            </optgroup>
          ))}
        </FilterSelect>

        <FilterSelect
          id="audit-entity"
          name="entity"
          label="Record type"
          allLabel="All record types"
          value={params.entityType}
        >
          {AUDIT_ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {AUDIT_ENTITY_LABELS[type]}
            </option>
          ))}
        </FilterSelect>

        <div>
          <label htmlFor="audit-actor" className="sr-only">
            Done by (name or email)
          </label>
          <Input
            id="audit-actor"
            name="actor"
            type="search"
            placeholder="Done by (name or email)"
            defaultValue={params.actor ?? ""}
          />
        </div>

        <div>
          <label htmlFor="audit-reference" className="sr-only">
            Asset ID or request number
          </label>
          <Input
            id="audit-reference"
            name="reference"
            type="search"
            placeholder="Asset ID or request number"
            defaultValue={params.reference ?? ""}
            className="font-mono placeholder:font-sans"
          />
        </div>

        <Field id="audit-from" label="From">
          <Input
            id="audit-from"
            name="from"
            type="date"
            defaultValue={params.from ?? ""}
          />
        </Field>
        <Field id="audit-to" label="To">
          <Input
            id="audit-to"
            name="to"
            type="date"
            defaultValue={params.to ?? ""}
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-xs text-slate-500">
          Dates are campus time. An asset ID also finds its maintenance events.
        </p>
        {hasAuditFilters(params) && (
          <Link
            href={basePath}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            Clear filters
          </Link>
        )}
        <Button type="submit" size="sm">
          Apply
        </Button>
      </div>
    </Form>
  );
}
