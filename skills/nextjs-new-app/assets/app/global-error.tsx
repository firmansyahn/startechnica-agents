"use client";

import "./globals.css";

// The last-resort error page (nextjs-logging rule log-global-error-page): it replaces the root layout,
// so it renders its own <html> and <body> and has no providers or translations above it. The server
// error is already logged by onRequestError (instrumentation.ts); show the digest so support can find it.
/* eslint-disable react/jsx-no-literals -- no messages provider exists above the root layout */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
          <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
          {error.digest ? <p className="text-muted-foreground">Reference: {error.digest}</p> : null}
          <button type="button" className="self-start rounded-md border px-3 py-1.5 text-sm" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
