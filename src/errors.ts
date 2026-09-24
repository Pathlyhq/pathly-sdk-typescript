/**
 * HTTP and domain errors raised by the Pathly SDK.
 *
 * API messages are kept as returned: rewording would hide the missing scope,
 * the offending field, or the exceeded quota.
 */

export class APIError extends Error {
  readonly statusCode: number;
  readonly path: string;
  override readonly message: string;

  constructor(statusCode: number, message: string, path = "") {
    const text =
      path !== ""
        ? `${path}: ${message} (HTTP ${statusCode})`
        : `${message} (HTTP ${statusCode})`;
    super(text);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.message = text;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }
}

export class NotFoundError extends APIError {
  constructor(message: string, path = "") {
    super(404, message, path);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** True when `err` reports a missing resource (HTTP 404). */
export function isNotFound(err: unknown): boolean {
  return err instanceof APIError && err.isNotFound;
}

function statusText(status: number): string {
  const phrases: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };
  return phrases[status] ?? `HTTP ${status}`;
}

/** Render a validation path as `events.0`, or `body` when empty. */
export function fieldOf(path: unknown): string {
  if (!Array.isArray(path) || path.length === 0) {
    return "body";
  }
  const parts: string[] = [];
  for (const item of path) {
    if (typeof item === "string") {
      parts.push(item);
    } else if (typeof item === "number") {
      parts.push(String(Math.trunc(item)));
    }
  }
  return parts.length > 0 ? parts.join(".") : "body";
}

/** Build an {@link APIError} from a raw response body. */
export function parseApiError(
  status: number,
  path: string,
  body: string,
): APIError {
  let message = body.trim() || statusText(status);
  let parsed: unknown;
  try {
    parsed = body.trim() ? JSON.parse(body) : {};
  } catch {
    parsed = {};
  }

  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "error" in parsed &&
    (parsed as { error: unknown }).error
  ) {
    message = String((parsed as { error: unknown }).error);
    const details = (parsed as { details?: unknown }).details;
    if (Array.isArray(details)) {
      for (const detail of details) {
        if (detail === null || typeof detail !== "object") {
          continue;
        }
        const d = detail as { path?: unknown; message?: unknown };
        const field = fieldOf(d.path ?? []);
        const detailMsg = d.message != null ? String(d.message) : "";
        message += ` [${field}: ${detailMsg}]`;
      }
    }
  }

  if (status === 401) {
    message +=
      " Check PATHLY_API_TOKEN: an expired, revoked or truncated key gives the same response.";
  } else if (status === 403) {
    message +=
      " Widen the scopes of the key, or check that the plan includes the feature.";
  }

  if (status === 404) {
    return new NotFoundError(message, path);
  }
  return new APIError(status, message, path);
}
