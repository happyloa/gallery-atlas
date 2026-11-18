/** JSON responses for the /api route handlers. */
import { isAicError } from "./client";
import type { AicErrorCode } from "./client";

const STATUS_FOR_CODE: Record<AicErrorCode, number> = {
  not_found: 404,
  bad_request: 400,
  rate_limited: 429,
  timeout: 504,
  network: 502,
  upstream: 502,
  invalid_response: 502,
};

/** Shared cache headers: let the edge keep good responses briefly and serve stale on error. */
export function jsonOk(body: unknown, maxAgeSeconds: number): Response {
  return Response.json(body, {
    headers: {
      "Cache-Control": `public, max-age=60, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 6}`,
    },
  });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  headers: HeadersInit = {},
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

/** Maps an upstream failure to a response. Unknown errors become a generic 500. */
export function upstreamErrorResponse(error: unknown): Response {
  if (isAicError(error)) {
    const headers: HeadersInit =
      error.code === "rate_limited" ? { "Retry-After": "30" } : {};
    return jsonError(
      STATUS_FOR_CODE[error.code],
      error.code,
      error.message,
      headers,
    );
  }
  console.error(error);
  return jsonError(500, "internal", "Something went wrong.");
}
