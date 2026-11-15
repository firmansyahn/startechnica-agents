import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/src/messages/en.json";

// A fresh QueryClient per test, retries off, cache kept for the whole test (`nextjs-data` Testing rules).
// A second locale needs its own messages: renderWithQuery(ui, { locale: "de", msgs: de }).
export function renderWithQuery(ui: ReactElement, { locale = "en", msgs }: { locale?: string; msgs?: object } = {}) {
  if (locale !== "en" && !msgs) throw new Error(`renderWithQuery: pass the "${locale}" messages as msgs; the default is en.json`);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale={locale} messages={msgs ?? messages} timeZone="UTC">
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  }
  return { client, ...render(ui, { wrapper: Wrapper }) };
}

export interface FakeCall {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}

export interface FakeReply {
  method: string;
  path: string;
  status: number;
  body: unknown;
}

/**
 * Stubs fetch at the network boundary and records each call. `answer` maps "METHOD path" to a reply.
 * `validate` is the project's reply check (rules data-test-fixtures-fit-spec, contract-test-fixtures-validated):
 * wire it to the validator the transport uses (the BFF's src/api/validate.ts, or a check of the OpenAPI
 * document), and have it throw on a reply the real backend could never send. It runs before each reply is
 * built; the reply then becomes a 500, and setup-dom.ts fails the test after it with the message (the page
 * under test would otherwise swallow a rejected fetch). Pass it once from a project wrapper, not per test.
 */
const fixtureErrors: string[] = [];
/** The invalid-fixture messages since the last call; setup-dom.ts fails the test that produced any. */
export function takeFixtureErrors(): string[] {
  return fixtureErrors.splice(0);
}

export function fakeApi(answer: Record<string, { status?: number; body?: unknown }>, { validate }: { validate?: (reply: FakeReply) => void } = {}) {
  const calls: FakeCall[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/(?:[\w-]+\/)?api\//, "");
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ method, path, query: Object.fromEntries(url.searchParams), body, headers: Object.fromEntries(new Headers(init?.headers)) });
    const reply = answer[`${method} ${path}`];
    if (!reply) return new Response(JSON.stringify({ status: "failed", message: `No fake for ${method} ${path}` }), { status: 404 });
    const status = reply.status ?? 200;
    try {
      validate?.({ method, path, status, body: status === 204 ? null : (reply.body ?? {}) });
    } catch (e) {
      fixtureErrors.push(`${method} ${path}: ${e instanceof Error ? e.message : String(e)}`);
      return new Response(JSON.stringify({ status: "failed", message: "Invalid test fixture" }), { status: 500 });
    }
    return new Response(status === 204 ? null : JSON.stringify(reply.body ?? {}), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return calls;
}
