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

/** Stubs fetch at the network boundary and records each call. `answer` maps "METHOD path" to a reply. */
export function fakeApi(answer: Record<string, { status?: number; body?: unknown }>) {
  const calls: FakeCall[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/(?:[\w-]+\/)?api\//, "");
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ method, path, query: Object.fromEntries(url.searchParams), body, headers: Object.fromEntries(new Headers(init?.headers)) });
    const reply = answer[`${method} ${path}`];
    if (!reply) return new Response(JSON.stringify({ status: "failed", message: `No fake for ${method} ${path}` }), { status: 404 });
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  return calls;
}
