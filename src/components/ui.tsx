import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`pub-card wood-grain rounded-lg border border-border-strong bg-surface shadow-lg shadow-black/30 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-base font-semibold tracking-wide text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Table({
  head,
  children,
}: {
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-strong text-left text-xs uppercase tracking-widest text-muted">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  className = "",
  numeric = false,
}: {
  children?: ReactNode;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 font-medium ${numeric ? "text-right" : ""} ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  numeric = false,
}: {
  children?: ReactNode;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <td
      className={`px-5 py-3 ${numeric ? "text-right tabular-nums" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "muted" | "green";
}) {
  const tones = {
    neutral:
      "bg-accent-soft text-accent border-accent/30",
    accent: "bg-accent text-background border-transparent font-semibold",
    muted: "bg-surface-raised text-muted border-border",
    green: "bg-green-soft text-green border-green/40",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="clover text-2xl leading-none" aria-hidden="true">
        ☘
      </p>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * A rank badge for the standings tables. The top three get the brass
 * treatment.
 */
export function Rank({ position }: { position: number }) {
  return (
    <span className={`rank ${position <= 3 ? "rank-top" : ""}`}>{position}</span>
  );
}
