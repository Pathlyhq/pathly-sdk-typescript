/**
 * HTTP client for the Pathly public `/v1` API.
 *
 * Hand-written so creates stay idempotent, `Retry-After` is honoured, and a
 * missing resource (404) stays distinct from a transport failure.
 */

import { APIError, parseApiError } from "./errors.js";
import type {
  MaintenanceWindow,
  MaintenanceWindowInput,
  Scenario,
  ScenarioInput,
  SlaTarget,
  SlaTargetInput,
  Webhook,
  WebhookInput,
} from "./types.js";
import { omitUndefined } from "./types.js";
import { DEFAULT_USER_AGENT } from "./version.js";

export const DEFAULT_BASE_URL = "https://api.pathlyhq.com";
export const MAX_ATTEMPTS = 4;
export const MAX_RETRY_WAIT_MS = 90_000;
export const PAGE_SIZE = 200;
export const MAX_PAGES = 200;

export type FetchFn = typeof fetch;
export type SleepFn = (ms: number) => Promise<void>;

export interface ClientOptions {
  /** API token. Defaults to `PATHLY_API_TOKEN`. Never logged. */
  token?: string;
  /** API base URL. Defaults to `PATHLY_API_URL` or production. */
  baseUrl?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  userAgent?: string;
  /** Injectable `fetch` for tests or a corporate proxy. */
  fetch?: FetchFn;
  /** Injectable sleep between retries (defaults to real wait). */
  sleep?: SleepFn;
}

interface RequestOptions {
  body?: unknown;
  idempotencyKey?: string;
  expectJson?: boolean;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function newIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `sdk-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function esc(value: string): string {
  return encodeURIComponent(value);
}

function backoffMs(attempt: number): number {
  return attempt * 500;
}

function waitForMs(headers: Headers, attempt: number): number {
  const raw = headers.get("Retry-After");
  if (raw) {
    const secs = Number.parseFloat(raw.trim());
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(secs * 1000, MAX_RETRY_WAIT_MS);
    }
  }
  return backoffMs(attempt);
}

/**
 * Thread-safe client. The token is never logged.
 */
export class Client {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly userAgent: string;
  private readonly token: string;
  private readonly fetchFn: FetchFn;
  private readonly sleep: SleepFn;

  constructor(options: ClientOptions = {}) {
    const resolved = (options.token ?? process.env.PATHLY_API_TOKEN ?? "").trim();
    if (!resolved) {
      throw new Error(
        "PATHLY_API_TOKEN is required. Export it, or pass token to Client().",
      );
    }

    let url = (options.baseUrl ?? process.env.PATHLY_API_URL ?? "").trim();
    if (!url) {
      url = DEFAULT_BASE_URL;
    }

    this.baseUrl = url.replace(/\/+$/, "");
    this.token = resolved;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.sleep = options.sleep ?? defaultSleep;
  }

  // ------------------------------------------------------------------ HTTP

  async request<T = unknown>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const expectJson = opts.expectJson !== false;
    let payload: string | undefined;
    if (opts.body !== undefined) {
      payload = JSON.stringify(opts.body);
    }

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      const outcome = await this.attempt<T>(
        method,
        path,
        payload,
        opts.idempotencyKey,
        expectJson,
        attempt,
        false,
      );
      if (outcome.retryMs <= 0) {
        if (outcome.error) {
          throw outcome.error;
        }
        return outcome.result as T;
      }
      await this.sleep(outcome.retryMs);
    }

    const last = await this.attempt<T>(
      method,
      path,
      payload,
      opts.idempotencyKey,
      expectJson,
      MAX_ATTEMPTS,
      true,
    );
    if (last.error) {
      throw last.error;
    }
    return last.result as T;
  }

  private async attempt<T>(
    method: string,
    path: string,
    payload: string | undefined,
    idempotencyKey: string | undefined,
    expectJson: boolean,
    attempt: number,
    last: boolean,
  ): Promise<{ retryMs: number; result?: T; error?: Error }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
      "User-Agent": this.userAgent,
    };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchFn(this.baseUrl + path, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const wrapped = new APIError(
        0,
        `calling ${method} ${path}: ${reason}`,
        path,
      );
      if (last) {
        return { retryMs: 0, error: wrapped };
      }
      return { retryMs: backoffMs(attempt), error: wrapped };
    } finally {
      clearTimeout(timer);
    }

    let raw: string;
    try {
      raw = await res.text();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const wrapped = new APIError(
        0,
        `reading the response of ${method} ${path}: ${reason}`,
        path,
      );
      if (last) {
        return { retryMs: 0, error: wrapped };
      }
      return { retryMs: backoffMs(attempt), error: wrapped };
    }

    if (res.status === 429 || res.status >= 500) {
      const failure = parseApiError(res.status, path, raw);
      if (last) {
        return { retryMs: 0, error: failure };
      }
      return { retryMs: waitForMs(res.headers, attempt), error: failure };
    }

    if (res.status >= 400) {
      return { retryMs: 0, error: parseApiError(res.status, path, raw) };
    }

    if (!expectJson || raw.length === 0) {
      return { retryMs: 0, result: undefined };
    }

    try {
      return { retryMs: 0, result: JSON.parse(raw) as T };
    } catch (err) {
      return {
        retryMs: 0,
        error: new APIError(
          res.status,
          `unreadable response from ${method} ${path}: ${String(err)}`,
          path,
        ),
      };
    }
  }

  /**
   * Verify the token. A 403 is accepted (key valid, missing `org:read`).
   */
  async ping(): Promise<void> {
    try {
      await this.request("GET", "/v1/usage");
    } catch (err) {
      if (err instanceof APIError && err.statusCode === 403) {
        return;
      }
      throw err;
    }
  }

  // -------------------------------------------------------------- Scenarios

  async createScenario(
    data: ScenarioInput,
    idempotencyKey?: string,
  ): Promise<Scenario> {
    return this.request<Scenario>("POST", "/v1/scenarios", {
      body: omitUndefined(data),
      idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
    });
  }

  async getScenario(scenarioId: string): Promise<Scenario> {
    return this.request<Scenario>("GET", `/v1/scenarios/${esc(scenarioId)}`);
  }

  async updateScenario(
    scenarioId: string,
    data: ScenarioInput,
  ): Promise<Scenario> {
    return this.request<Scenario>("PATCH", `/v1/scenarios/${esc(scenarioId)}`, {
      body: omitUndefined(data),
    });
  }

  async deleteScenario(scenarioId: string): Promise<void> {
    await this.request("DELETE", `/v1/scenarios/${esc(scenarioId)}`, {
      expectJson: false,
    });
  }

  async listScenarios(): Promise<Scenario[]> {
    return this.listPaged<Scenario>("/v1/scenarios");
  }

  /** Mute or unmute. Pass `null` / omit to clear the mute. */
  async muteScenario(
    scenarioId: string,
    mutedUntil: string | null = null,
  ): Promise<void> {
    await this.request(
      "POST",
      `/v1/scenarios/${esc(scenarioId)}/mute`,
      {
        body: { mutedUntil },
        expectJson: false,
      },
    );
  }

  // ---------------------------------------------------- Maintenance windows

  async createMaintenanceWindow(
    data: MaintenanceWindowInput,
    idempotencyKey?: string,
  ): Promise<MaintenanceWindow> {
    return this.request<MaintenanceWindow>("POST", "/v1/maintenance-windows", {
      body: omitUndefined(data),
      idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
    });
  }

  async getMaintenanceWindow(windowId: string): Promise<MaintenanceWindow> {
    return this.request<MaintenanceWindow>(
      "GET",
      `/v1/maintenance-windows/${esc(windowId)}`,
    );
  }

  async deleteMaintenanceWindow(windowId: string): Promise<void> {
    await this.request(
      "DELETE",
      `/v1/maintenance-windows/${esc(windowId)}`,
      { expectJson: false },
    );
  }

  async listMaintenanceWindows(): Promise<MaintenanceWindow[]> {
    return this.listPaged<MaintenanceWindow>("/v1/maintenance-windows");
  }

  // --------------------------------------------------------------- Webhooks

  async createWebhook(
    data: WebhookInput,
    idempotencyKey?: string,
  ): Promise<Webhook> {
    const body: Record<string, unknown> = { url: data.url };
    if (data.events !== undefined) {
      body.events = data.events;
    }
    return this.request<Webhook>("POST", "/v1/webhooks", {
      body,
      idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
    });
  }

  async getWebhook(webhookId: string): Promise<Webhook> {
    return this.request<Webhook>("GET", `/v1/webhooks/${esc(webhookId)}`);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request("DELETE", `/v1/webhooks/${esc(webhookId)}`, {
      expectJson: false,
    });
  }

  async listWebhooks(): Promise<Webhook[]> {
    return this.listPaged<Webhook>("/v1/webhooks");
  }

  // ------------------------------------------------------------ SLA targets

  async upsertSlaTarget(
    data: SlaTargetInput,
    idempotencyKey?: string,
  ): Promise<SlaTarget> {
    return this.request<SlaTarget>("PUT", "/v1/sla-targets", {
      body: omitUndefined(data),
      idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
    });
  }

  async getSlaTarget(targetId: string): Promise<SlaTarget> {
    return this.request<SlaTarget>("GET", `/v1/sla-targets/${esc(targetId)}`);
  }

  async deleteSlaTarget(targetId: string): Promise<void> {
    await this.request("DELETE", `/v1/sla-targets/${esc(targetId)}`, {
      expectJson: false,
    });
  }

  async listSlaTargets(): Promise<SlaTarget[]> {
    return this.listPaged<SlaTarget>("/v1/sla-targets");
  }

  // -------------------------------------------------------------- Pagination

  private async listPaged<T>(base: string): Promise<T[]> {
    const items: T[] = [];
    let cursor = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) {
        query.set("cursor", cursor);
      }
      const path = `${base}?${query.toString()}`;
      const out = await this.request<{ items?: T[]; nextCursor?: string | null }>(
        "GET",
        path,
      );
      items.push(...(out.items ?? []));
      const next = out.nextCursor;
      if (!next) {
        return items;
      }
      cursor = String(next);
    }
    throw new APIError(
      0,
      `pagination exceeded ${MAX_PAGES} pages for ${base}`,
      base,
    );
  }
}
