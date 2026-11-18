import { isAicError } from "./client";

/** How a failed museum request is described to visitors (see ResultsError). */
export function describeFailure(error: unknown): {
  reason: "rate_limited" | "timeout" | "generic";
  retryable: boolean;
} {
  const code = isAicError(error) ? error.code : null;
  return {
    reason:
      code === "rate_limited"
        ? "rate_limited"
        : code === "timeout"
          ? "timeout"
          : "generic",
    retryable: isAicError(error) ? error.retryable : true,
  };
}
