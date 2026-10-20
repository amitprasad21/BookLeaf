// Live event stream (npm run test:live; API-8, .back/TEST_PLAN.md I-20): real
// sign-ins and tokens, GET /api/v1/events over a real socket. A fixture
// ticket for AUTH006 is inserted with the secret key; it and the ticket the
// suite creates are deleted afterwards. No AI is involved (triage disabled).
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ACCOUNTS, SeedDataSchema } from "../scripts/seed-data.js";
import { createApp } from "../src/app.js";
import { createSupabaseVerifier } from "../src/auth/supabase-verifier.js";
import { loadEnv } from "../src/config/env.js";
import { createSystemWriter } from "../src/db/system-writer.js";
import { createEventHub } from "../src/events/hub.js";
import { createLogger } from "../src/lib/logger.js";

const env = {
  url: process.env.SUPABASE_URL ?? "",
  publishable: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  secret: process.env.SUPABASE_SECRET_KEY ?? "",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
  authorPassword: process.env.SEED_AUTHOR_PASSWORD ?? "",
};
const configured = Object.values(env).every((value) => value !== "" && !value.startsWith("replace-with"));

const data = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const OWNER = data.authors.find((candidate) => candidate.author_id === "AUTH006")!;
const OTHER = data.authors.find((candidate) => candidate.author_id === "AUTH005")!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Keeps reading one SSE response; waitFor() reads until the text matches or time runs out. */
function streamReader(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let pending: ReturnType<typeof reader.read> | null = null;
  let done = false;
  return {
    text: () => text,
    async waitFor(predicate: (text: string) => boolean, timeoutMs: number) {
      const deadline = Date.now() + timeoutMs;
      while (!done && !predicate(text)) {
        const left = deadline - Date.now();
        if (left <= 0) break;
        pending ??= reader.read();
        const result = await Promise.race([pending, sleep(left).then(() => null)]);
        if (!result) break;
        pending = null;
        if (result.done) {
          done = true;
          break;
        }
        text += decoder.decode(result.value, { stream: true });
      }
      return predicate(text);
    },
    close: () => reader.cancel().catch(() => {}),
  };
}

describe.runIf(configured)("event stream against live Supabase", () => {
  const events = createEventHub({ clock: () => new Date(), logger: createLogger({ LOG_LEVEL: "silent" }) });
  const app = createApp({
    env: loadEnv({ NODE_ENV: "test", SUPABASE_URL: env.url, SUPABASE_PUBLISHABLE_KEY: env.publishable }),
    logger: createLogger({ LOG_LEVEL: "silent" }),
    verifier: createSupabaseVerifier({ url: env.url, publishableKey: env.publishable }),
    systemWriter: createSystemWriter({ url: env.url, secretKey: env.secret }),
    events,
  });
  let server: Server;
  let base = "";
  let system: SupabaseClient;
  const tokens = { admin: "", owner: "", other: "" };
  const created: string[] = [];
  let ticketId = "";
  let streams: Record<keyof typeof tokens, ReturnType<typeof streamReader>>;

  const call = (path: string, who: keyof typeof tokens, body: object) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const mentions = (id: string, type: string) => (text: string) =>
    text.split("\n\n").some((frame) => frame.includes(`event: ${type}`) && frame.includes(id));

  beforeAll(async () => {
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    system = createClient(env.url, env.secret, noSession);
    const signIn = async (email: string, password: string) => {
      const client = createClient(env.url, env.publishable, noSession);
      const { data: session, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !session.session) throw new Error(`sign-in failed (${error?.code})`);
      return session.session.access_token;
    };
    [tokens.admin, tokens.owner, tokens.other] = await Promise.all([
      signIn(ADMIN_ACCOUNTS[0]!.email, env.adminPassword),
      signIn(OWNER.email, env.authorPassword),
      signIn(OTHER.email, env.authorPassword),
    ]);

    const inserted = await system
      .from("tickets")
      .insert({
        author_id: OWNER.author_id,
        book_id: null,
        subject: "Events test: live update check",
        description: "Created by the automated live event stream suite; deleted afterwards.",
      })
      .select("id")
      .single();
    if (inserted.error) throw new Error(`setup: insert failed (${inserted.error.code})`);
    ticketId = inserted.data.id;
    created.push(ticketId);

    const open = async (who: keyof typeof tokens) => {
      const response = await fetch(`${base}/events`, { headers: { Authorization: `Bearer ${tokens[who]}` } });
      if (response.status !== 200) throw new Error(`stream for ${who} refused (${response.status})`);
      return streamReader(response);
    };
    streams = { admin: await open("admin"), owner: await open("owner"), other: await open("other") };
    for (let i = 0; i < 100 && events.size() < 3; i += 1) await sleep(10);
  });

  afterAll(async () => {
    await Promise.all(Object.values(streams ?? {}).map((stream) => stream.close()));
    server?.closeAllConnections();
    server?.close();
    if (created.length === 0) return;
    const { error } = await system.from("tickets").delete().in("id", created);
    if (error) throw new Error(`cleanup failed (${error.code}); delete the "Events test" tickets by hand`);
  });

  it("opens one authenticated stream per user", async () => {
    expect(events.size()).toBe(3);
    for (const stream of Object.values(streams)) {
      expect(await stream.waitFor((text) => text.startsWith(": connected"), 2_000)).toBe(true);
    }
  });

  it("delivers an admin reply to the ticket's author and admins, never to another author (I-20)", async () => {
    const res = await call(`/admin/tickets/${ticketId}/messages`, "admin", {
      body: "Thanks for writing in. We're looking into this now.",
    });
    expect(res.status).toBe(201);

    const updated = mentions(ticketId, "ticket.updated");
    expect(await streams.owner.waitFor(updated, 5_000)).toBe(true);
    expect(await streams.admin.waitFor(updated, 5_000)).toBe(true);
    expect(streams.owner.text()).toContain('"changes":["messages","status"]');
    expect(await streams.other.waitFor((text) => text.includes(ticketId), 1_000)).toBe(false);
    // Identifiers only: the reply text never travels on the stream.
    expect(streams.owner.text()).not.toContain("looking into this");
  });

  it("keeps internal notes to admins", async () => {
    const res = await call(`/admin/tickets/${ticketId}/notes`, "admin", { body: "Live events suite note." });
    expect(res.status).toBe(201);
    const internal = mentions(ticketId, "ticket.internal_updated");
    expect(await streams.admin.waitFor(internal, 5_000)).toBe(true);
    expect(await streams.owner.waitFor(internal, 1_000)).toBe(false);
  });

  it("announces a new ticket to admins only", async () => {
    const res = await call("/author/tickets", "owner", {
      bookId: null,
      subject: "Events test: new ticket",
      description: "Created by the automated live event stream suite; deleted afterwards.",
    });
    expect(res.status).toBe(201);
    const id = ((await res.json()) as { data: { id: string } }).data.id;
    created.push(id);
    expect(await streams.admin.waitFor(mentions(id, "ticket.created"), 5_000)).toBe(true);
    expect(await streams.owner.waitFor((text) => text.includes(id), 1_000)).toBe(false);
  });
});
