---
title: Cap, sniff and store uploads under random names, and serve them as attachments
impact: HIGH
tags: uploads, files, xss
check: review
---

## Cap, sniff and store uploads under random names, and serve them as attachments

**Impact: HIGH** (stored XSS from an uploaded HTML or SVG file, path traversal, disk exhaustion)

Count bytes while streaming and abort past the limit; check the type by magic bytes against the feature's allow-list (not the file name or the browser's `Content-Type`); refuse SVG and HTML unless sanitised; store under a random key outside `public/`, keeping the original name only as metadata. Serve through a handler that authorizes the reader, with `Content-Disposition: attachment` (inline only for re-encoded images), the stored type, `nosniff` and `Cache-Control: private`.

**Incorrect:**

```ts
const file = form.get("file") as File;
await writeFile(path.join("public/uploads", file.name), Buffer.from(await file.arrayBuffer()));
```

**Correct:**

```ts
const key = crypto.randomUUID();
const { type, size } = await streamToStore(req.body, key, { maxBytes: 5_000_000, allow: ["image/png", "image/jpeg", "application/pdf"] });
await saveFileMeta({ key, type, size, originalName: sanitizeName(name), owner: session.userId });
```

**How to check:** in review, every upload route handler and every handler that serves stored files. Uploads never go through server actions (`action-writes-only`).
