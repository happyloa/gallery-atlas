import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> {
  label: string;
  /** Visually hide the label but keep it for screen readers. */
  hideLabel?: boolean;
  hint?: string;
  icon?: ReactNode;
}

export function TextField({
  label,
  hideLabel,
  hint,
  icon,
  className,
  ...props
}: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-xs font-medium tracking-[0.14em] text-muted uppercase",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span
            className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          aria-describedby={hintId}
          className={cn(
            "min-h-12 w-full border-0 border-b border-ink/30 bg-transparent font-serif text-xl text-ink placeholder:text-muted/80 transition-colors duration-200 ease-gallery focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-60 sm:text-2xl",
            icon ? "pl-9" : "pl-0",
          )}
          {...props}
        />
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
