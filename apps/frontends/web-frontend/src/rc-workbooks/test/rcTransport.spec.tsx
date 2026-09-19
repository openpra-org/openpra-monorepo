import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RcTransportInputs, RcTransportSettings } from "interfaces-mef-types/rc/transport";
import { RcTransportPanel } from "../rcTransport";
import { RcWorkbookProvider, useRcWorkbook, type RcTransportActions, type RcWorkbookData } from "../rcWorkbookContext";

// These values exercise editing state only; they are not a scientific example.
const settings = (velocity = .003): RcTransportSettings => ({ decayMode: "parent", groupVelocities: [{ groupId: 1, name: "Cs", velocity, basis: "analyst" }] });
function setup(options: { pending?: boolean; fail?: boolean; stale?: boolean } = {}) {
  const original: RcTransportInputs = { revision: 7, categories: [{ categoryId: "RC-1", settings: settings() }], decayFiles: [] };
  const initial = { rc: { releaseCategoryToConsequence: { releaseCategoryInputs: [{ releaseCategory: "RC-1", releaseCharacteristics: {}, sourceTerm: { revision: 3, values: {
    groups: [{ id: 1, name: "Cs" }], inventory: [{ name: "Cs-137", group: 1, activityBq: 1 }], releases: [],
  } } }] }, atmosphericTransportAndDispersion: { transportInputs: original } }, cc: {}, nms: [] } as unknown as RcWorkbookData;
  let finish: () => void = () => undefined;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const importFiles = jest.fn(async (..._args: Parameters<RcTransportActions["importFiles"]>) => { if (options.pending) await pending; if (options.fail) throw new Error("Import failed"); return { ...original, revision: 8 }; });
  const saveSettings = jest.fn(async (...[_revision, _category, _source, values]: Parameters<RcTransportActions["saveSettings"]>) => ({ ...original, revision: 9, categories: [{ categoryId: "RC-1", settings: values }] }));
  function Controls() {
    const { setTransportDraft, transportDrafts } = useRcWorkbook();
    return <><button onClick={() => {
      setTransportDraft("RC-1", { baseRevision: options.stale ? 6 : 7, sourceRevision: 3, settings: { ...settings(.004), decayMode: "ingrowth" } });
      setTransportDraft("RC-2", { baseRevision: 7, sourceRevision: 4, settings: settings(.005) });
      setTransportDraft("old", { baseRevision: 5, sourceRevision: 1, settings: settings(.006) });
    }}>Edit settings</button><button onClick={() => setTransportDraft("RC-1", { baseRevision: 7, sourceRevision: 3, settings: settings(.007) })}>Edit again</button>
      <output aria-label="Drafts">{JSON.stringify(transportDrafts)}</output><RcTransportPanel /></>;
  }
  function Harness() {
    const [data, setData] = useState(initial);
    const accept = (inputs: RcTransportInputs) => { setData(previous => ({ ...previous, rc: { ...previous.rc, atmosphericTransportAndDispersion: { ...previous.rc.atmosphericTransportAndDispersion, transportInputs: inputs } } })); return inputs; };
    const actions: RcTransportActions = { importFiles: async (...args) => accept(await importFiles(...args)), saveSettings: async (...args) => accept(await saveSettings(...args)), unlink: jest.fn(),
      readSource: jest.fn(async () => ({ sourceRevision: 3 })), readOriginal: jest.fn(), readDecay: jest.fn() };
    return <RcWorkbookProvider data={data} editable mutateRc={jest.fn()} transport={actions}><Controls /></RcWorkbookProvider>;
  }
  render(<Harness />);fireEvent.click(screen.getByRole("button", { name: "Edit settings" }));
  return { importFiles, saveSettings, finish };
}
const drafts = () => JSON.parse(screen.getByLabelText("Drafts").textContent!);
function upload(kind: "dispersion" | "decay") {
  fireEvent.click(screen.getByRole("tab", { name: kind === "dispersion" ? "Dispersion" : "Radioactive decay", exact: true }));
  const button = screen.getByRole("button", { name: kind === "dispersion" ? "Import file" : "Add files", exact: true });
  expect(button).toBeEnabled(); expect(screen.getByRole("button", { name: `Load published ${kind} example` })).toBeEnabled();
  const input = screen.getByLabelText("Import transport input files");expect(input).toBeEnabled();fireEvent.click(button);
  const file = new File(["UI test fixture"], "test-input.txt", { type: "text/plain" });
  fireEvent.change(input, { target: { files: [file] } });return file;
}

describe("Step 04 imports with unsaved settings", () => {
  it.each(["dispersion", "decay"] as const)("imports %s without discarding or saving settings", async kind => {
    const { importFiles, saveSettings } = setup();const file = upload(kind);
    await waitFor(() => expect(drafts()["RC-1"].baseRevision).toBe(8));
    expect(importFiles).toHaveBeenCalledWith(kind, 7, [file], undefined, undefined);
    expect(drafts()["RC-1"]).toEqual({ baseRevision: 8, sourceRevision: 3, settings: { ...settings(.004), decayMode: "ingrowth" } });
    expect(drafts()["RC-2"].baseRevision).toBe(8);expect(drafts().old.baseRevision).toBe(5);
    expect(saveSettings).not.toHaveBeenCalled();expect(screen.queryByText(/Transport inputs or the source changed/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save transport inputs", exact: true }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(8, "RC-1", 3, { ...settings(.004), decayMode: "ingrowth" }));
  });
  it("preserves edits made while an import is finishing", async () => {
    const { finish } = setup({ pending: true });upload("dispersion");
    fireEvent.click(screen.getByRole("button", { name: "Edit again" }));await act(async () => { finish(); });
    await waitFor(() => expect(drafts()["RC-1"].baseRevision).toBe(8));expect(drafts()["RC-1"].settings).toEqual(settings(.007));
  });
  it("preserves the draft and enables retry after a failed upload", async () => {
    setup({ fail: true });const before = drafts();upload("decay");
    await screen.findByText("Import failed");expect(drafts()).toEqual(before);expect(screen.getByRole("button", { name: "Add files", exact: true })).toBeEnabled();
  });
  it("does not hide an existing settings conflict when importing a reference", async () => {
    const { importFiles } = setup({ stale: true });upload("dispersion");await waitFor(() => expect(importFiles).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Import file", exact: true })).toBeEnabled());
    expect(drafts()["RC-1"].baseRevision).toBe(6);expect(screen.getByText(/Transport inputs or the source changed/)).toBeInTheDocument();expect(screen.getByRole("button", { name: "Save transport inputs", exact: true })).toBeDisabled();
  });
});
