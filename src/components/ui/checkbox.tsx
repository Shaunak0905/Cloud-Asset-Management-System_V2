import type { InputHTMLAttributes } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  label: string;
  hint?: string;
};

export function Checkbox({ id, label, hint, ...props }: CheckboxProps) {
  const hintId = `${id}-hint`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        aria-describedby={hint ? hintId : undefined}
        className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        {...props}
      />
      <div className="text-sm">
        <label htmlFor={id} className="font-medium text-slate-900">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-slate-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
