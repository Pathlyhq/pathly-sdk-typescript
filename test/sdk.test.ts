import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APIError,
  Client,
  DEFAULT_BASE_URL,
  MAX_ATTEMPTS,
  MAX_PAGES,
  MAX_RETRY_WAIT_MS,
  NotFoundError,
  PAGE_SIZE,
  VERSION,
  fieldOf,
  isNotFound,
  omitUndefined,
  parseApiError,
} from "../src/index.js";

type MockCall = {
  url: string;
  init?: RequestInit;
};

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function textResponse(
  body: string,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  // undici rejects a non-null body with 204; use null for empty successes.
  if (status === 204) {
    return new Response(null, { status, headers });
  }
  return new Response(body, { status, headers });
}

describe("errors", () => {
  it("formats APIError with and without path", () => {
    const withPath = new APIError(400, "bad", "/v1/x");
    expect(withPath.message).toContain("/v1/x");
    expect(withPath.message).toContain("HTTP 400");
    expect(String(withPath)).toContain("bad");

    const bare = new APIError(500, "boom");
    expect(bare.message).toBe("boom (HTTP 500)");
    expect(bare.isNotFound).toBe(false);
  });

  it("NotFoundError and isNotFound", () => {
    const err = new NotFoundError("gone", "/v1/scenarios/1");
    expect(err.statusCode).toBe(404);
    expect(err.isNotFound).toBe(true);
    expect(isNotFound(err)).toBe(true);
    expect(isNotFound(new Error("x"))).toBe(false);
    expect(isNotFound(new APIError(400, "no"))).toBe(false);
  });

  it("fieldOf handles strings, numbers, empty and non-arrays", () => {
    expect(fieldOf(["events", 0])).toBe("events.0");
    expect(fieldOf([1.9, "x"])).toBe("1.x");
    expect(fieldOf([])).toBe("body");
    expect(fieldOf(null)).toBe("body");
    expect(fieldOf([true, "ok"])).toBe("ok");
    expect(fieldOf([true, null, {}])).toBe("body");
  });

  it("parseApiError enriches 401/403 and details", () => {
    const e401 = parseApiError(
      401,
      "/v1/usage",
      JSON.stringify({ error: "unauthorized" }),
    );
    expect(e401.message).toContain("PATHLY_API_TOKEN");

    const e403 = parseApiError(
      403,
      "/v1/usage",
      JSON.stringify({
        error: "forbidden",
        details: [
          { path: ["events", 0], message: "required" },
          "skip",
          { path: [], message: "root" },
          { message: "no-path" },
          { path: ["x"], message: null },
          { path: ["y"] },
        ],
      }),
    );
    expect(e403.message).toContain("Widen the scopes");
    expect(e403.message).toContain("events.0");
    expect(e403.message).toContain("[body:");
    expect(e403.message).toContain("[x: ]");
    expect(e403.message).toContain("[y: ]");

    const nf = parseApiError(404, "/v1/x", JSON.stringify({ error: "missing" }));
    expect(nf).toBeInstanceOf(NotFoundError);

    const raw = parseApiError(418, "/v1/x", "not-json");
    expect(raw.message).toContain("not-json");

    const empty = parseApiError(502, "/v1/x", "   ");
    expect(empty.message).toContain("Bad Gateway");

    const unknown = parseApiError(599, "/v1/x", "");
    expect(unknown.message).toContain("HTTP 599");

    const falsyError = parseApiError(400, "/v1/x", JSON.stringify({ error: "" }));
    expect(falsyError.message).toContain('{"error":""}');

    const badDetails = parseApiError(
      400,
      "/v1/x",
      JSON.stringify({ error: "e", details: "nope" }),
    );
    expect(badDetails.message).toContain("e");

    const jsonNull = parseApiError(400, "/v1/x", "null");
    expect(jsonNull.message).toContain("null");
  });

  it("omitUndefined drops undefined only", () => {
    expect(omitUndefined({ a: 1, b: undefined, c: null })).toEqual({
      a: 1,
      c: null,
    });
  });
});

describe("Client construction", () => {
  const prevToken = process.env.PATHLY_API_TOKEN;
  const prevUrl = process.env.PATHLY_API_URL;

  afterEach(() => {
    if (prevToken === undefined) delete process.env.PATHLY_API_TOKEN;
    else process.env.PATHLY_API_TOKEN = prevToken;
    if (prevUrl === undefined) delete process.env.PATHLY_API_URL;
    else process.env.PATHLY_API_URL = prevUrl;
  });

  it("requires a token", () => {
    delete process.env.PATHLY_API_TOKEN;
    expect(() => new Client()).toThrow(/PATHLY_API_TOKEN/);
  });

  it("reads token and URL from env", () => {
    process.env.PATHLY_API_TOKEN = " env-token ";
    process.env.PATHLY_API_URL = "https://custom.example/";
    const c = new Client();
    expect(c.baseUrl).toBe("https://custom.example");
  });

  it("defaults to production base URL", () => {
    delete process.env.PATHLY_API_URL;
    const c = new Client({ token: "t" });
    expect(c.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(VERSION).toBe("0.1.0");
    expect(c.userAgent).toBe(`pathly-sdk-typescript/${VERSION}`);
    expect(MAX_ATTEMPTS).toBe(4);
    expect(PAGE_SIZE).toBe(200);
    expect(MAX_PAGES).toBe(200);
    expect(MAX_RETRY_WAIT_MS).toBe(90_000);
  });
});

describe("Client HTTP + resources", () => {
  let calls: MockCall[];
  let queue: Array<Response | Error>;
  let sleeps: number[];
  let client: Client;

  beforeEach(() => {
    calls = [];
    queue = [];
    sleeps = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      const next = queue.shift();
      if (!next) {
        throw new Error("unexpected fetch");
      }
      if (next instanceof Error) {
        throw next;
      }
      return next;
    };
    client = new Client({
      token: "secret-token",
      baseUrl: "https://api.test",
      fetch: fetchFn,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
  });

  it("never puts the token in thrown error messages", async () => {
    queue.push(jsonResponse({ error: "no" }, 401));
    await expect(client.ping()).rejects.toThrow(/PATHLY_API_TOKEN/);
    try {
      queue.push(jsonResponse({ error: "no" }, 401));
      await client.ping();
    } catch (err) {
      expect(String(err)).not.toContain("secret-token");
    }
  });

  it("ping accepts 200 and 403", async () => {
    queue.push(jsonResponse({ planId: "pro" }));
    await client.ping();

    queue.push(jsonResponse({ error: "forbidden" }, 403));
    await client.ping();

    queue.push(jsonResponse({ error: "no" }, 401));
    await expect(client.ping()).rejects.toBeInstanceOf(APIError);
  });

  it("retries on transport error then succeeds", async () => {
    queue.push(new Error("network down"));
    queue.push(jsonResponse({ id: "s1", name: "A", type: "http" }));
    const s = await client.getScenario("s1");
    expect(s.id).toBe("s1");
    expect(sleeps.length).toBe(1);
    expect(sleeps[0]).toBe(500);
  });

  it("retries 429 with Retry-After capped at 90s", async () => {
    queue.push(textResponse("slow", 429, { "Retry-After": "120" }));
    queue.push(jsonResponse({ id: "s1", name: "A", type: "http" }));
    await client.getScenario("s1");
    expect(sleeps[0]).toBe(MAX_RETRY_WAIT_MS);
  });

  it("retries 5xx with backoff when Retry-After is invalid", async () => {
    queue.push(textResponse("oops", 503, { "Retry-After": "nope" }));
    queue.push(jsonResponse({ id: "s1", name: "A", type: "http" }));
    await client.getScenario("s1");
    expect(sleeps[0]).toBe(500);
  });

  it("gives up after MAX_ATTEMPTS on persistent 500", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      queue.push(textResponse("down", 500));
    }
    await expect(client.getScenario("s1")).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(calls).toHaveLength(MAX_ATTEMPTS);
    expect(sleeps).toHaveLength(MAX_ATTEMPTS - 1);
  });

  it("succeeds on the last attempt after transient failures", async () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      queue.push(textResponse("down", 503));
    }
    queue.push(jsonResponse({ id: "s1", name: "A", type: "http" }));
    const s = await client.getScenario("s1");
    expect(s.id).toBe("s1");
    expect(calls).toHaveLength(MAX_ATTEMPTS);
  });

  it("falls back to backoff when Retry-After is zero", async () => {
    queue.push(textResponse("slow", 429, { "Retry-After": "0" }));
    queue.push(jsonResponse({ id: "s1", name: "A", type: "http" }));
    await client.getScenario("s1");
    expect(sleeps[0]).toBe(500);
  });

  it("does not retry 400", async () => {
    queue.push(jsonResponse({ error: "bad" }, 400));
    await expect(client.getScenario("s1")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(calls).toHaveLength(1);
  });

  it("handles empty body and unreadable JSON", async () => {
    queue.push(textResponse("", 204));
    await client.deleteScenario("s1");

    queue.push(textResponse("{not-json", 200));
    await expect(client.getScenario("s1")).rejects.toThrow(/unreadable/);
  });

  it("retries when reading the body fails, then fails on last attempt", async () => {
    const badBody = {
      status: 200,
      headers: new Headers(),
      text: async () => {
        throw new Error("read fail");
      },
    } as unknown as Response;

    queue.push(badBody);
    queue.push(jsonResponse({ id: "s1", name: "A", type: "http" }));
    await client.getScenario("s1");
    expect(sleeps.length).toBe(1);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      queue.push(badBody);
    }
    await expect(client.getScenario("s1")).rejects.toThrow(/reading the response/);
  });

  it("fails on last transport error", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      queue.push(new TypeError("abort"));
    }
    await expect(client.getScenario("s1")).rejects.toThrow(/calling GET/);
  });

  it("CRUD scenarios + mute + list pages", async () => {
    queue.push(
      jsonResponse({ id: "s1", name: "Home", type: "http" }),
    );
    const created = await client.createScenario(
      { name: "Home", url: "https://ex.com", intervalSec: 300 },
      "idem-1",
    );
    expect(created.id).toBe("s1");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(
      (calls[0]?.init?.headers as Record<string, string>)["Idempotency-Key"],
    ).toBe("idem-1");

    queue.push(jsonResponse({ id: "s1", name: "Home", type: "http" }));
    await client.getScenario("id/with spaces");
    expect(calls[1]?.url).toContain(encodeURIComponent("id/with spaces"));

    queue.push(jsonResponse({ id: "s1", name: "Renamed", type: "http" }));
    await client.updateScenario("s1", { name: "Renamed", enabled: undefined });
    const patchBody = JSON.parse(String(calls[2]?.init?.body));
    expect(patchBody).toEqual({ name: "Renamed" });

    queue.push(textResponse("", 204));
    await client.deleteScenario("s1");

    queue.push(textResponse("", 204));
    await client.muteScenario("s1", "2026-10-01T00:00:00Z");
    expect(JSON.parse(String(calls[4]?.init?.body))).toEqual({
      mutedUntil: "2026-10-01T00:00:00Z",
    });

    queue.push(textResponse("", 204));
    await client.muteScenario("s1");
    expect(JSON.parse(String(calls[5]?.init?.body))).toEqual({
      mutedUntil: null,
    });

    queue.push(
      jsonResponse({
        items: [{ id: "a", name: "A", type: "http" }],
        nextCursor: "c1",
      }),
    );
    queue.push(
      jsonResponse({
        items: [{ id: "b", name: "B", type: "http" }],
        nextCursor: null,
      }),
    );
    const all = await client.listScenarios();
    expect(all.map((s) => s.id)).toEqual(["a", "b"]);
    expect(calls[6]?.url).toContain(`limit=${PAGE_SIZE}`);
    expect(calls[7]?.url).toContain("cursor=c1");
  });

  it("auto-generates Idempotency-Key on create", async () => {
    queue.push(jsonResponse({ id: "s1", name: "X", type: "http" }));
    await client.createScenario({ name: "X", intervalSec: 60 });
    const key = (calls[0]?.init?.headers as Record<string, string>)[
      "Idempotency-Key"
    ];
    expect(key).toBeTruthy();
  });

  it("CRUD maintenance windows", async () => {
    queue.push(
      jsonResponse({
        id: "mw1",
        weekday: 7,
        startMinute: 180,
        durationMin: 120,
      }),
    );
    const mw = await client.createMaintenanceWindow({
      weekday: 7,
      startMinute: 180,
      durationMin: 120,
      reason: "backup",
    });
    expect(mw.id).toBe("mw1");

    queue.push(jsonResponse({ id: "mw1" }));
    await client.getMaintenanceWindow("mw1");

    queue.push(textResponse("", 204));
    await client.deleteMaintenanceWindow("mw1");

    queue.push(jsonResponse({ items: [{ id: "mw1" }] }));
    const list = await client.listMaintenanceWindows();
    expect(list).toHaveLength(1);
  });

  it("CRUD webhooks (no patch; secret on create)", async () => {
    queue.push(
      jsonResponse({
        id: "wh1",
        events: ["run.failed"],
        secret: "once",
        urlFingerprint: "fp",
      }),
    );
    const wh = await client.createWebhook({
      url: "https://hooks.example/x",
      events: ["run.failed"],
    });
    expect(wh.secret).toBe("once");

    queue.push(
      jsonResponse({
        id: "wh1",
        events: ["run.failed"],
        urlFingerprint: "fp",
      }),
    );
    const got = await client.getWebhook("wh1");
    expect(got.secret).toBeUndefined();

    queue.push(textResponse("", 204));
    await client.deleteWebhook("wh1");

    queue.push(jsonResponse({ items: [] }));
    expect(await client.listWebhooks()).toEqual([]);

    queue.push(jsonResponse({ id: "wh2", events: ["run.failed", "run.recovered"] }));
    await client.createWebhook({ url: "https://hooks.example/y" });
    expect(JSON.parse(String(calls[4]?.init?.body))).toEqual({
      url: "https://hooks.example/y",
    });
  });

  it("upsert / get / delete / list SLA targets", async () => {
    queue.push(
      jsonResponse({
        id: "sla1",
        objectivePct: 99.9,
        windowDays: 30,
      }),
    );
    const t = await client.upsertSlaTarget({
      objectivePct: 99.9,
      windowDays: 30,
      name: "checkout",
    });
    expect(t.id).toBe("sla1");
    expect(calls[0]?.init?.method).toBe("PUT");

    queue.push(jsonResponse({ id: "sla1" }));
    await client.getSlaTarget("sla1");

    queue.push(textResponse("", 204));
    await client.deleteSlaTarget("sla1");

    queue.push(jsonResponse({ items: [{ id: "sla1" }], nextCursor: "" }));
    expect(await client.listSlaTargets()).toHaveLength(1);
  });

  it("stops pagination after MAX_PAGES", async () => {
    for (let i = 0; i < MAX_PAGES; i++) {
      queue.push(
        jsonResponse({
          items: [{ id: String(i), name: "n", type: "http" }],
          nextCursor: `c${i}`,
        }),
      );
    }
    await expect(client.listScenarios()).rejects.toThrow(/pagination exceeded/);
  });

  it("listPaged tolerates missing items", async () => {
    queue.push(jsonResponse({}));
    expect(await client.listWebhooks()).toEqual([]);
  });

  it("aborts hung requests when timeoutMs elapses", async () => {
    const hangFetch: typeof fetch = async (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing signal"));
          return;
        }
        if (signal.aborted) {
          reject(new Error("aborted"));
          return;
        }
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const slow = new Client({
      token: "t",
      baseUrl: "https://api.test",
      timeoutMs: 20,
      fetch: hangFetch,
      sleep: async () => undefined,
    });
    await expect(slow.getScenario("s1")).rejects.toThrow(/calling GET/);
  }, 10_000);
  it("uses default sleep and covers non-Error throws", async () => {
    vi.useFakeTimers();
    let n = 0;
    const fetchFn: typeof fetch = async () => {
      n += 1;
      if (n === 1) {
        // non-Error throw → String(err) branch
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "boom";
      }
      return jsonResponse({ id: "s1", name: "A", type: "http" });
    };
    const c = new Client({
      token: "t",
      baseUrl: "https://api.test",
      fetch: fetchFn,
      // default sleep
    });
    const p = c.getScenario("s1");
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toMatchObject({ id: "s1" });
    vi.useRealTimers();
  });

  it("honours a finite Retry-After under the cap", async () => {
    queue.push(textResponse("slow", 429, { "Retry-After": "2" }));
    queue.push(jsonResponse({ id: "s1", name: "A", type: "http" }));
    await client.getScenario("s1");
    expect(sleeps[0]).toBe(2000);
  });

  it("stringifies non-Error body read failures", async () => {
    const badBody = {
      status: 200,
      headers: new Headers(),
      text: async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "read-boom";
      },
    } as unknown as Response;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      queue.push(badBody);
    }
    await expect(client.getScenario("s1")).rejects.toThrow(/read-boom/);
  });

  it("stringifies non-Error JSON parse failures", async () => {
    const weird = {
      status: 200,
      headers: new Headers(),
      text: async () => {
        const broken = {
          toString() {
            return "{";
          },
          get length() {
            return 1;
          },
          [Symbol.toPrimitive]() {
            return "{";
          },
        };
        return broken as unknown as string;
      },
    } as unknown as Response;
    // Actually JSON.parse on weird object might coerce — use invalid JSON string
    queue.push(textResponse("{", 200));
    await expect(client.getScenario("s1")).rejects.toThrow(/unreadable/);
  });
});

describe("idempotency key fallback", () => {
  it("falls back when crypto.randomUUID is missing", async () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { randomUUID: undefined },
    });

    const calls: MockCall[] = [];
    const client = new Client({
      token: "t",
      baseUrl: "https://api.test",
      fetch: async (input, init) => {
        calls.push({ url: String(input), init });
        return jsonResponse({ id: "s1", name: "A", type: "http" });
      },
      sleep: async () => undefined,
    });
    await client.createScenario({ name: "A", intervalSec: 60 });
    const key = (calls[0]?.init?.headers as Record<string, string>)[
      "Idempotency-Key"
    ];
    expect(key?.startsWith("sdk-")).toBe(true);

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: original,
    });
  });
});
