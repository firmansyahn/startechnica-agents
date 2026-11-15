import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Result } from "@/api/result";
// ADAPT: the project's form drawer or dialog composite. Copy this file beside it as <Composite>.test.tsx.
import { FormDrawer } from "./FormDrawer";

// Rule ui-overlay-form-state: a form in an overlay keeps its state on failure and resets on open.
// Run against the project's form drawer/dialog composite, so every create/edit overlay built on it
// gets the behaviour: a refused save keeps it open with the refusal inside and the input kept; opening
// for create shows the defaults (not the last record); opening for edit shows the record; closing
// with unsaved changes asks first.
//
// What it can't see: overlays built by hand instead of on the composite (`page-form-drawer-composite`
// lists those), and field-level errors (`nextjs-forms` tests them per form).

// ADAPT: the composite's button names and the confirm it shows before discarding changes.
const LABELS = { save: "Save", cancel: "Cancel", discard: /discard/i, keepEditing: /keep editing/i };
const REFUSAL = "The name is already taken";

// ADAPT: the one place that knows the composite's API. It renders the composite with one text field
// labelled "Name", opened for create by "New" and for edit by "Edit" (a record named "Existing").
function NameField() {
  const { register } = useFormContext<{ name: string }>();
  return (
    <label>
      Name <input {...register("name")} />
    </label>
  );
}
function Harness({ save }: { save: (values: { name: string }) => Promise<Result<unknown>> }) {
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<{ name: string } | null>(null);
  const show = (r: { name: string } | null) => {
    setRecord(r);
    setOpen(true);
  };
  return (
    <>
      <button onClick={() => show(null)}>New</button>
      <button onClick={() => show({ name: "Existing" })}>Edit</button>
      <FormDrawer open={open} onOpenChange={setOpen} title="Item" defaultValues={record ?? { name: "" }} onSave={save}>
        <NameField />
      </FormDrawer>
    </>
  );
}

const ok = async (): Promise<Result<unknown>> => ({ ok: true, data: {} });
const refused = async (): Promise<Result<unknown>> => ({ ok: false, error: { status: 409, message: REFUSAL } });

function setup(save = vi.fn(ok)) {
  const user = userEvent.setup();
  render(<Harness save={save} />);
  const name = () => within(screen.getByRole("dialog")).getByRole("textbox", { name: "Name" });
  return { user, save, name };
}

describe("the form overlay keeps state on failure and resets on open (rule ui-overlay-form-state)", () => {
  it("stays open on a refused save, with the refusal inside and the input kept", async () => {
    const { user, name } = setup(vi.fn(refused));
    await user.click(screen.getByRole("button", { name: "New" }));
    await user.type(name(), "Taken");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: LABELS.save }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(REFUSAL)).toBeInTheDocument();
    expect(name()).toHaveValue("Taken");
  });

  it("opens for create with the defaults, after an edit", async () => {
    const { user, name } = setup();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(name()).toHaveValue("Existing");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: LABELS.cancel }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New" }));
    expect(name()).toHaveValue("");
  });

  it("opens for edit with the record, after a create", async () => {
    const { user, save, name } = setup();
    await user.click(screen.getByRole("button", { name: "New" }));
    await user.type(name(), "Fresh");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: LABELS.save }));
    expect(save).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(name()).toHaveValue("Existing");
  });

  it("asks before closing with unsaved changes", async () => {
    const { user, name } = setup();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(name());
    await user.type(name(), "Changed");
    await user.keyboard("{Escape}");
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: LABELS.keepEditing }));
    expect(name()).toHaveValue("Changed");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: LABELS.cancel }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: LABELS.discard }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
