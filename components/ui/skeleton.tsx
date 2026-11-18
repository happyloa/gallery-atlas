import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer bg-[linear-gradient(100deg,var(--color-paper-deep)_40%,var(--color-paper)_50%,var(--color-paper-deep)_60%)] bg-size-[200%_100%]",
        className,
      )}
    />
  );
}
