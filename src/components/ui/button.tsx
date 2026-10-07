import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-blue-700",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:outline-blue-700",
  ghost: "text-slate-700 hover:bg-slate-100 focus-visible:outline-blue-700",
  danger:
    "bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

type ButtonStyle = { variant?: Variant; size?: Size; className?: string };

/** Button styling, also usable on links (`<Link className={buttonClasses()}>`). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyle = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle;

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}
