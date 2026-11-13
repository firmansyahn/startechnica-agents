"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "@/src/api/result";

let browserClient: QueryClient | undefined;

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        refetchOnWindowFocus: false,
        // Retrying a refusal is pointless; retry once on a server or network failure.
        retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status < 500),
      },
    },
  });
}

function getQueryClient() {
  if (typeof window === "undefined") return makeClient();   // one per server render
  return (browserClient ??= makeClient());                   // one per browser
}

/** Mounted around the app chrome and the pages, so they share one cache (nextjs-data references/queries.md). */
export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
