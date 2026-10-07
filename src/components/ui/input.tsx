import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils/cn";

/** Shared look for text inputs, selects and textareas. */
export const controlClasses = cn(
  "block w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs",
  "placeholder:text-slate-400",
  "focus:border-blue-700 focus:outline-2 focus:outline-blue-700/25",
  "aria-invalid:border-red-600 aria-invalid:focus:outline-red-600/25",
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
);

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, "h-10", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClasses, "h-10 pr-8", className)} {...props} />
  );
}

export function Textarea({
  className,
  rows = 4,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(controlClasses, "py-2", className)}
      {...props}
    />
  );
}
