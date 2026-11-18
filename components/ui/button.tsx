import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonTone = "light" | "dark";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium tracking-wide whitespace-nowrap transition-colors duration-200 ease-gallery disabled:cursor-not-allowed disabled:opacity-45";

const sizes: Record<ButtonSize, string> = {
  md: "min-h-12 px-6 text-sm",
  // 44px, the smallest comfortable touch target.
  sm: "min-h-11 px-4 text-[0.8125rem]",
};

/** `tone` is the background the button sits on: light paper or the dark gallery. */
const variants: Record<ButtonTone, Record<ButtonVariant, string>> = {
  light: {
    primary: "bg-ink text-paper hover:bg-accent-deep",
    secondary: "border border-ink/30 text-ink hover:border-ink hover:bg-ink/5",
    quiet: "text-ink underline-offset-4 hover:underline",
  },
  dark: {
    primary: "bg-paper text-ink hover:bg-paper-deep",
    secondary:
      "border border-gallery-text/40 text-gallery-text hover:border-gallery-text hover:bg-white/5",
    quiet: "text-gallery-text underline-offset-4 hover:underline",
  },
};

export function buttonStyles({
  variant = "primary",
  tone = "light",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(base, sizes[size], variants[tone][variant], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  variant,
  tone,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, tone, size, className })}
      {...props}
    />
  );
}
