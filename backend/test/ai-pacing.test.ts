import { afterEach, describe, expect, it, vi } from "vitest";
import { pacedFetch } from "../src/ai/providers/pacing.js";
import { postJson, kindForStatus } from "../src/ai/providers/http.js";
import { createJobQueue } from "../src/ai/queue.js";
import { captureLogger } from "./helpers.js";

describe("provider pacing", () => {
  it("spaces simultaneous calls and HTTP retries through one provider gate", async () => {
    const starts: number[] = [];
    let count = 0;
    const base = vi.fn(async () => {
      starts.push(Date.now());
      count += 1;
      return new Response("{}", { status: count === 1 ? 503 : 200 });
    });
    const fetchFn = pacedFetch(base, 30);
    const call = () =>
      postJson(
        "https://provider.invalid",
        {},
        {},
        { provider: "gemini", timeoutMs: 1000, maxRetries: 1, fetchFn, sleep: async () => {} },
        kindForStatus,
      );
    await Promise.all([call(), call()]);
    expect(starts).toHaveLength(3);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(25);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(25);
  });

  it("does not send a cancelled request or poison later callers", async () => {
    const base = vi.fn(async () => new Response("{}"));
    const fetchFn = pacedFetch(base, 30);
    await fetchFn("https://provider.invalid");
    const cancelled = new AbortController();
    const skipped = fetchFn("https://provider.invalid", { signal: cancelled.signal });
    cancelled.abort();
    await expect(skipped).rejects.toBeDefined();
    await fetchFn("https://provider.invalid");
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("can be explicitly disabled and does not couple different providers", async () => {
    const base = vi.fn(async () => new Response("{}"));
    expect(pacedFetch(base, 0)).toBe(base);
    const first = pacedFetch(base, 1000);
    const second = pacedFetch(base, 1000);
    await Promise.all([first("https://a.invalid"), second("https://b.invalid")]);
    expect(base).toHaveBeenCalledTimes(2);
  });
});

describe("paced triage queue", () => {
  afterEach(() => vi.useRealTimers());

  it("spaces starts, drops duplicates and clears a pending wake on shutdown", async () => {
    vi.useFakeTimers();
    const starts: string[] = [];
    const queue = createJobQueue({
      concurrency: 2,
      minStartIntervalMs: 8000,
      logger: captureLogger().logger,
      run: async (id) => {
        starts.push(id);
      },
    });
    expect(["a", "b", "c", "b"].map((id) => queue.enqueue(id))).toEqual([true, true, true, false]);
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(7999);
    expect(starts).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(starts).toEqual(["a", "b"]);
    await queue.close(10);
    await vi.advanceTimersByTimeAsync(16000);
    expect(starts).toEqual(["a", "b"]);
    expect(queue.stats()).toEqual({ queued: 0, running: 0 });
    expect(queue.enqueue("d")).toBe(false);
  });
});
