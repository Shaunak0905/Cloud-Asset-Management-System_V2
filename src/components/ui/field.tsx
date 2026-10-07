import type { ReactNode } from "react";

type FieldProps = {
  /** id of the control; hint and error get `${id}-hint` / `${id}-error`. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

/**
 * Label + control + hint + error. Give the control
 * `aria-describedby={describedBy(id, { hint, error })}` and
 * `aria-invalid` when there is an error.
 */
export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={fieldHintId(id)} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={fieldErrorId(id)} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function fieldErrorId(id: string): string {
  return `${id}-error`;
}

export function fieldHintId(id: string): string {
  return `${id}-hint`;
}

/** aria-describedby value for a control inside <Field>. */
export function describedBy(
  id: string,
  { hint, error }: { hint?: string; error?: string },
): string | undefined {
  if (error) return fieldErrorId(id);
  if (hint) return fieldHintId(id);
  return undefined;
}
