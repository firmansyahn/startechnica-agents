---
title: A 422 puts messages on the fields and focuses the first
impact: LOW
tags: testing
check: review
---

## A 422 puts messages on the fields and focuses the first

**Impact: LOW**

Answer the call with a 422 and `fields: { name: ["Already taken"] }`; expect the message under Name, focus on the Name input, and the form still open.

**Correct:**

```tsx
fakeApi({ "POST items": { status: 422, body: { message: "Invalid", fields: { name: ["Already taken"] } } } });
await user.click(screen.getByRole("button", { name: "Save" }));
expect(await screen.findByText("Already taken")).toBeInTheDocument();
expect(screen.getByLabelText("Name")).toHaveFocus();
```
