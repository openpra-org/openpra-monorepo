import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RcSourceTermEditor } from "../rcSourceTerm";
import { RcWorkbookProvider, type RcWorkbookData, type RcSourceTermActions } from "../rcWorkbookContext";

const category = (): ReleaseCategoryInputs => ({
  releaseCategory: "RC-2", releaseCharacteristics: {}, sourceTerm: { revision: 3,
    values: { groups: [{ id: 1, name: "Cs" }], inventory: [{ name: "Cs-137", group: 1, activityBq: 4e16 }],
      releases: [{ id: 1, startSeconds: 0, durationSeconds: 3600, fractions: [0.1] }] },
  },
});
function setup(editable = true, inline = true, withDrawer = false, c = category()) {
  const actions: RcSourceTermActions = {
    saveValues: jest.fn(async (_id, revision, values) => ({ ...c, sourceTerm: { revision: revision + 1, values } })),
    importFile: jest.fn(async () => c), downloadOriginal: jest.fn(),
  };
  const data = { rc: {}, cc: {}, nms: [] } as unknown as RcWorkbookData;
  render(<RcWorkbookProvider data={data} editable={editable} mutateRc={jest.fn()} sourceTerms={actions}>
    <div data-testid="panel"><RcSourceTermEditor category={c} inline={inline} /></div>
    {withDrawer && <div data-testid="drawer"><RcSourceTermEditor category={c} /></div>}
  </RcWorkbookProvider>);
  if (inline) fireEvent.click(screen.getByRole("tab", { name: /Inventory/ }));
  return { actions, c };
}
function edit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } }); fireEvent.blur(input);
}
describe("Step 01 source input controls", () => {
  it("shows only the selected segment and saves its fractions without changing another segment", async () => {
    const c = category();
    c.sourceTerm!.values.releases.push({ id: 2, startSeconds: 4000, durationSeconds: 100, heightMetres: 20, fractions: [0.2] });
    const { actions } = setup(true, true, false, c);
    fireEvent.click(screen.getByRole("tab", { name: /Releases/ }));
    expect(screen.getByLabelText("Start for segment 1")).toHaveValue(0);
    expect(screen.queryByLabelText("Start for segment 2")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Release segment"), { target: { value: "1" } });
    expect(screen.getByLabelText("Start for segment 2")).toHaveValue(4000);
    expect(screen.queryByLabelText("Start for segment 1")).not.toBeInTheDocument();
    edit("Fraction for Cs in segment 2", "0.3");
    fireEvent.click(screen.getByRole("button", { name: "Save source data" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save source data" })).toBeDisabled());
    expect(actions.saveValues).toHaveBeenCalledWith("RC-2", 3, expect.objectContaining({ releases: [
      expect.objectContaining({ id: 1, fractions: [0.1] }), expect.objectContaining({ id: 2, fractions: [0.3] }),
    ] }));
  });
  it("shares unsaved edits and discards between the MS panel and existing drawer", async () => {
    setup(true, true, true);
    const panel = within(screen.getByTestId("panel")), drawer = within(screen.getByTestId("drawer"));
    const activity = drawer.getByLabelText("Activity Cs-137 (Bq)");
    fireEvent.change(activity, { target: { value: "500000" } }); fireEvent.blur(activity);
    await waitFor(() => expect(panel.getByLabelText("Activity Cs-137 (Bq)")).toHaveValue(500000));
    fireEvent.click(drawer.getByRole("button", { name: "Discard edits" }));
    await waitFor(() => expect(panel.getByLabelText("Activity Cs-137 (Bq)")).toHaveValue(4e16));
    expect(panel.getByRole("button", { name: "Save source data" })).toBeDisabled();
  });
  it("keeps the existing drawer's table selector and presentation", () => {
    setup(true, false);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Input table"), { target: { value: "segments" } });
    expect(screen.getByLabelText("Height for segment 1")).toHaveValue(null);
    expect(screen.queryByLabelText("Fraction for Cs in segment 1")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Input table"), { target: { value: "fractions" } });
    expect(screen.getByLabelText("Fraction for Cs in segment 1")).toHaveValue(0.1);
  });
  it("commits edits using the selected category and source revision", async () => {
    const { actions } = setup();
    edit("Activity Cs-137 (Bq)", "500000");
    fireEvent.click(screen.getByRole("button", { name: "Save source data" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save source data" })).toBeDisabled());
    expect(actions.saveValues).toHaveBeenCalledWith("RC-2", 3, expect.objectContaining({ inventory: [{ name: "Cs-137", group: 1, activityBq: 500000 }] }));
  });
  it("shows missing height as blank and saves an explicit zero", async () => {
    const { actions } = setup();
    fireEvent.click(screen.getByRole("tab", { name: /Releases/ }));
    expect(screen.getByLabelText("Height for segment 1")).toHaveValue(null);
    edit("Height for segment 1", "0");
    fireEvent.click(screen.getByRole("button", { name: "Save source data" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save source data" })).toBeDisabled());
    expect(actions.saveValues).toHaveBeenCalledWith("RC-2", 3, expect.objectContaining({ releases: [expect.objectContaining({ heightMetres: 0 })] }));
  });
  it("does not turn blank inventory activity into zero", async () => {
    const { actions } = setup();
    edit("Activity Cs-137 (Bq)", "");
    fireEvent.click(screen.getByRole("button", { name: "Save source data" }));
    await screen.findByRole("alert");
    expect(actions.saveValues).not.toHaveBeenCalled();
  });
  it("validates fractions and lets the user discard edits", async () => {
    const { actions } = setup();
    fireEvent.click(screen.getByRole("tab", { name: /Releases/ }));
    edit("Fraction for Cs in segment 1", "1.2");
    fireEvent.click(screen.getByRole("button", { name: "Save source data" }));
    await screen.findByRole("alert"); expect(actions.saveValues).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard edits" }));
    await waitFor(() => expect(screen.getByLabelText("Fraction for Cs in segment 1")).toHaveValue(0.1));
  });
  it("sends native files with the selected category revision", async () => {
    const { actions } = setup(); const file = new File(["native cards"], "source.inp", { type: "application/octet-stream" });
    fireEvent.change(screen.getByLabelText("Import source-term file"), { target: { files: [file] } });
    await waitFor(() => expect(actions.importFile).toHaveBeenCalledWith("RC-2", 3, file));
  });
  it("provides read-only tables to reviewers", () => {
    const { actions } = setup(false);
    expect(screen.getByLabelText("Activity Cs-137 (Bq)")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save source data" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Import source-term file")).not.toBeInTheDocument();
    expect(actions.saveValues).not.toHaveBeenCalled();
  });
  it("switches input tabs with the keyboard and keeps the panel labelled", () => {
    setup();
    const inventory = screen.getByRole("tab", { name: /Inventory/ });
    inventory.focus();
    fireEvent.keyDown(inventory, { key: "ArrowRight" });
    const releases = screen.getByRole("tab", { name: /Releases/ });
    expect(releases).toHaveFocus();
    expect(releases).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", releases.id);
    expect(screen.getByLabelText("Height for segment 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Fraction for Cs in segment 1")).toBeInTheDocument();
  });
});
