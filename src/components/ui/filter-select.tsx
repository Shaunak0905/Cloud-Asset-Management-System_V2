import type { ReactNode } from "react";

import { Select } from "./input";

/** A list filter: a select with a visually hidden label and an "all" option. */
export function FilterSelect({
  id,
  name,
  label,
  allLabel,
  value,
  children,
}: {
  id: string;
  name: string;
  label: string;
  allLabel: string;
  value: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} name={name} defaultValue={value ?? ""}>
        <option value="">{allLabel}</option>
        {children}
      </Select>
    </div>
  );
}
