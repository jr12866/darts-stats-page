import type { ReactNode } from "react";

/**
 * Shared form control styles for the pub theme.
 *
 * Inputs look like dark, oiled wood with a brass edge when focused.
 */
export const inputClass =
  "w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent";

export const selectClass =
  "w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent";

export const buttonClass =
  "rounded bg-accent px-3 py-2 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60";

export const ghostButtonClass =
  "rounded border border-border-strong bg-surface px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent";

export function FormRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
