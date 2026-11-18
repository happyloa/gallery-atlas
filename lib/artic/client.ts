/**
 * The only place that calls the AIC API. Adds the courtesy header, a timeout, bounded
 * retries with jittered exponential backoff, Retry-After handling for 429, and turns every
 * failure into an `AicError` with a code the UI can act on.
 */
import { AIC_API_BASE, REQUEST_TIMEOUT_MS } from "./config";
import { fixtureResponse, isFixtureMode, isFixtureNotFound } from "./dev-fixtures";

export type AicErrorCode =
  | "not_found"
  | "bad_request"
  | "rate_limited"
  | "timeout"
  | "network"
  | "upstream"
  | "invalid_response";

export class AicError extends Error {
  readonly code: AicErrorCode;
  readonly status: number | null;

  constructor(
    code: AicErrorCode,
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = "AicError";
    this.code = code;
    this.status = status;
  }

  /** Worth showing a "try again" button for. */
  get retryable(): boolean {
    return this.code !== "not_found" && this.code !== "bad_request";
  }
}

/**
 * `instanceof` alone is not enough: a dev-server module reload or a duplicated chunk can
 * leave two copies of the class. Fall back to the name and code.
 */
export function isAicError(error: unknown): error is AicError {
  return (
    error instanceof AicError ||
    (error instanceof Error &&
      error.name === "AicError" &&
      typeof (error as { code?: unknown }).code === "string")
  );
}

/**
 * Plain User-Agent. Workers' fetch sends none by default, and the API's edge answers
 * requests without one with 403. Names the project only, nothing personal.
 */
export const USER_AGENT = "GalleryAtlas/0.1";

export interface AicRequestOptions {
  /** Seconds the response may be served from the fetch cache. */
  revalidate?: number;
  /** Extra attempts after the first, for retryable failures. */
  retries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 5000;
const BACKOFF_BASE_MS = 300;
const EMAIL_PATTERN = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;

/**
 * `AIC-User-Agent`, as the museum asks. The contact address comes only from the
 * AIC_CONTACT_EMAIL server variable; without it the header carries no address.
 */
export function aicUserAgent(email = readContactEmail()): string {
  return email
    ? `Gallery Atlas (${email})`
    : "Gallery Atlas (independent project)";
}

function readContactEmail(): string | null {
  const value =
    typeof process !== "undefined"
      ? process.env?.AIC_CONTACT_EMAIL?.trim()
      : undefined;
  return value && EMAIL_PATTERN.test(value) ? value : null;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Retry-After as milliseconds: delta-seconds or an HTTP date. Null when absent or unusable. */
export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

function backoffMs(attempt: number, random: () => number): number {
  const ceiling = BACKOFF_BASE_MS * 2 ** attempt;
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

function errorForStatus(status: number): AicError {
  if (status === 404)
    return new AicError(
      "not_found",
      "The museum API has no such record.",
      status,
    );
  if (status === 429)
    return new AicError(
      "rate_limited",
      "The museum API is rate limiting requests.",
      status,
    );
  if (status >= 500)
    return new AicError(
      "upstream",
      `The museum API returned ${status}.`,
      status,
    );
  // 401/403 mean the museum refused us (blocked, or a limit we should have prevented),
  // not that the visitor asked for something wrong.
  if (status === 401 || status === 403)
    return new AicError(
      "upstream",
      `The museum API refused the request (${status}).`,
      status,
    );
  return new AicError(
    "bad_request",
    `The museum API rejected the request (${status}).`,
    status,
  );
}

/**
 * GET a path under the API base and return parsed JSON. `path` must be built by the
 * helpers in queries.ts; absolute URLs are refused so nothing can redirect the request.
 */
export async function aicGet(
  path: string,
  options: AicRequestOptions = {},
): Promise<unknown> {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    throw new AicError(
      "bad_request",
      "Refusing to request an unexpected path.",
    );
  }
  // End-to-end tests and offline development: answer from local fixtures (never in production).
  if (!options.fetchImpl && isFixtureMode()) {
    try {
      return fixtureResponse(path);
    } catch (error) {
      if (isFixtureNotFound(error))
        throw new AicError("not_found", "No such fixture record.", 404);
      throw error;
    }
  }
  const url = `${AIC_API_BASE}${path}`;
  const {
    retries = 2,
    timeoutMs = REQUEST_TIMEOUT_MS,
    fetchImpl = fetch,
    sleep = defaultSleep,
    random = Math.random,
  } = options;

  let lastError: AicError = new AicError(
    "network",
    "The museum API could not be reached.",
  );

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0 && options.signal?.aborted) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });

    let response: Response;
    try {
      const init: RequestInit & { next?: { revalidate?: number } } = {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          "AIC-User-Agent": aicUserAgent(),
        },
        signal: controller.signal,
      };
      if (options.revalidate !== undefined)
        init.next = { revalidate: options.revalidate };
      response = await fetchImpl(url, init);
    } catch {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      lastError =
        controller.signal.aborted && !options.signal?.aborted
          ? new AicError(
              "timeout",
              `The museum API did not answer within ${Math.round(timeoutMs / 1000)} s.`,
            )
          : new AicError("network", "The museum API could not be reached.");
      if (options.signal?.aborted) throw lastError;
      if (attempt < retries) await sleep(backoffMs(attempt, random));
      continue;
    }

    try {
      if (response.ok) {
        let body: string;
        try {
          body = await response.text();
        } catch {
          // The body stream failed part-way (often our own timeout aborting it).
          throw controller.signal.aborted
            ? new AicError(
                "timeout",
                `The museum API did not answer within ${Math.round(timeoutMs / 1000)} s.`,
              )
            : new AicError(
                "network",
                "The connection to the museum API dropped.",
              );
        }
        try {
          return JSON.parse(body) as unknown;
        } catch {
          throw new AicError(
            "invalid_response",
            "The museum API sent a response that is not JSON.",
            response.status,
          );
        }
      }

      lastError = errorForStatus(response.status);
      if (response.status === 429) {
        // Honour a short Retry-After once; otherwise give up and let the visitor retry.
        const wait = parseRetryAfter(response.headers.get("Retry-After"));
        if (attempt < retries && wait !== null && wait <= MAX_RETRY_AFTER_MS) {
          await sleep(wait);
          continue;
        }
        throw lastError;
      }
      if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
      if (attempt < retries) await sleep(backoffMs(attempt, random));
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
  throw lastError;
}
