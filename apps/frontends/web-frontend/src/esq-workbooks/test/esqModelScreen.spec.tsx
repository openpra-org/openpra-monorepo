import { JSX, useCallback, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EsqFunctionLink, EsqFunctionTarget, EsqNetworkNodeTarget, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { EsqWorkbookProvider, type EsqWorkbookRuntime } from "../esqWorkbookContext";
import { EsqModelTabs } from "../EsqModelTabs";
import { modelViewOf, withDefaultLink, withFunctionLink, withModelImported, withTypedTrees } from "../esqModel";
import { applyEventTreeOperation, createEmptyEventTree } from "../../newly-developed-methods/event-tree";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { getSyWorkbook } from "../../sy-workbooks/syWorkbookApi";
import { dependencyNetwork, linkedEsq, modelUpstream } from "./esqModelFixtures";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

jest.mock("../../sy-workbooks/syWorkbookApi", () => ({ getSyWorkbook: jest.fn() }));

jest.mock("../../newly-developed-methods/fault-tree", () => ({
  ...jest.requireActual<typeof import("../../newly-developed-methods/fault-tree")>("../../newly-developed-methods/fault-tree"),
  FaultTreeEditor: () => null,
}));

type ChangeSpy = jest.Mock<void, [EventSequenceQuantification]>;

const NOW = "2026-10-05T12:00:00.000Z";

const SAVED: EsqWorkbookRuntime = { workbookId: "esq-1", projectId: "p-1", revision: 5, saveStatus: "saved" };

const UNSAVED: EsqWorkbookRuntime = { workbookId: null, projectId: null, revision: null, saveStatus: "saved" };

const ROOM_TEXT = "Network node ROOM · Pump room · DN-01";

const COOLING: EsqFunctionTarget = { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-COOL", gateId: "G-COOL" } };

function node(trueStateIds: string[], nodeId = "N-ROOM", modelId = "BN-1"): EsqNetworkNodeTarget {
  return { kind: "NETWORK_NODE", node: { workbookId: "esq-1", modelId, nodeId }, trueStateIds };
}

function networked(): EventSequenceQuantification {
  return { ...withModelImported(linkedEsq(), modelUpstream(), NOW), bayesianNetworks: [dependencyNetwork()] };
}

function drawnTree(): EventTree {
  return applyEventTreeOperation({ ...createEmptyEventTree("IEG-01", "POS-01"), uuid: "ET-DRAWN", name: "Drawn tree", label: "ET-ESQ-01" }, {
    kind: "ADD_FUNCTIONAL_EVENT",
    functionalEvent: { uuid: "FE-DRAWN", name: "Drawn cooling", label: "DCOOL", order: 0 },
  });
}

function Harness({ initial, editable = true, runtime = SAVED, onChange }: { initial: EventSequenceQuantification; editable?: boolean; runtime?: EsqWorkbookRuntime; onChange: (esq: EventSequenceQuantification) => void }): JSX.Element {
  const [esq, setEsq] = useState(initial);
  const [upstream] = useState(() => modelUpstream());
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => {
    const next = mutator(current);
    onChange(next);
    return next;
  }), [onChange]);
  return (
    <EsqWorkbookProvider data={{ esq }} editable={editable} mutateEsq={mutateEsq} upstream={upstream} runtime={runtime}>
      <EsqModelTabs />
    </EsqWorkbookProvider>
  );
}

async function praxis(): Promise<void> {
  await act(async () => {
    await settledWithPraxis(() => undefined);
  });
}

async function openFunction(id: string, action = "Edit"): Promise<HTMLElement> {
  await praxis();
  fireEvent.click(screen.getByRole("tab", { name: "Functions" }));
  fireEvent.click(screen.getByRole("button", { name: `${action} ${id}` }));
  return screen.getByRole("dialog", { name: "Function" });
}

function nodeWindow(): HTMLElement {
  return screen.getByRole("dialog", { name: "Network node" });
}

function selectedText(select: HTMLElement): string {
  if (!(select instanceof HTMLSelectElement)) throw new Error("not a select");
  return select.selectedOptions[0]?.textContent ?? "";
}

function optionTexts(select: HTMLElement): string[] {
  return within(select).getAllByRole("option").map((option) => option.textContent ?? "");
}

function changeSpy(): ChangeSpy {
  return jest.fn<void, [EventSequenceQuantification]>();
}

function lastOf(onChange: ChangeSpy): EventSequenceQuantification | undefined {
  const calls = onChange.mock.calls;
  return calls[calls.length - 1]?.[0];
}

function linkOf(onChange: ChangeSpy, functionId: string): EsqFunctionLink | undefined {
  return lastOf(onChange)?.modelDecisions?.functionLinks?.find((link) => link.functionId === functionId);
}

describe("ESQ Step 02 network node links", () => {
  beforeEach(() => {
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    jest.mocked(getSyWorkbook).mockReset();
  });

  it("sets a network node for every tree in a window over the Function window and edits it again", async () => {
    const onChange = changeSpy();
    render(<Harness initial={networked()} onChange={onChange} />);
    const functionWindow = await openFunction("RT");
    const everyTree = within(functionWindow).getByLabelText("Every tree linked to");
    expect(optionTexts(everyTree)).toEqual(["Not linked", "COOL-TOP · COOL fails · COOL", "SUP-TOP · SUP fails · SUP", "RPS-TOP · RPS fails · RPS", "Split fraction", "Network node"]);

    fireEvent.change(everyTree, { target: { value: "node" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(everyTree).toHaveValue("");
    expect(screen.getByRole("dialog", { name: "Function" })).toBeInTheDocument();
    const picker = within(nodeWindow());
    expect(picker.getByRole("heading", { name: "RT · Every tree" })).toBeInTheDocument();
    expect(optionTexts(picker.getByLabelText("Network"))).toEqual(["DN-01 · Cooling dependencies"]);
    expect(optionTexts(picker.getByLabelText("Node"))).toEqual(["ROOM · Pump room", "GRID · Offsite power"]);
    const states = within(picker.getByRole("group", { name: "States of ROOM in which RT fails" }));
    expect(states.getAllByRole("checkbox").map((box) => box.parentElement?.textContent)).toEqual(["DRY · Dry", "WET · Wet", "FLOODED · Flooded"]);
    const save = picker.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    fireEvent.click(states.getByLabelText("FLOODED · Flooded"));
    expect(save).toBeEnabled();
    fireEvent.click(states.getByLabelText("WET · Wet"));
    fireEvent.click(states.getByLabelText("DRY · Dry"));
    expect(save).toBeDisabled();
    fireEvent.click(states.getByLabelText("DRY · Dry"));
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(linkOf(onChange, "RT")).toEqual({ functionId: "RT", rules: [], target: node(["S-WET", "S-FLOODED"]) });
    expect(screen.queryByRole("dialog", { name: "Network node" })).not.toBeInTheDocument();
    const stored = within(screen.getByRole("dialog", { name: "Function" }));
    expect(selectedText(stored.getByLabelText("Every tree linked to"))).toBe(ROOM_TEXT);
    expect(selectedText(stored.getByLabelText("ET-A linked to"))).toBe(`Every tree · ${ROOM_TEXT}`);
    expect(stored.queryByRole("button", { name: "Edit the network node for ET-A" })).not.toBeInTheDocument();

    fireEvent.click(stored.getByRole("button", { name: "Edit the network node for Every tree" }));
    const again = within(nodeWindow());
    expect(again.getByLabelText("Node")).toHaveValue("N-ROOM");
    expect(again.getByLabelText("WET · Wet")).toBeChecked();
    expect(again.getByLabelText("FLOODED · Flooded")).toBeChecked();
    expect(again.getByLabelText("DRY · Dry")).not.toBeChecked();
    fireEvent.change(again.getByLabelText("Node"), { target: { value: "N-GRID" } });
    expect(again.getByRole("group", { name: "States of GRID in which RT fails" })).toBeInTheDocument();
    expect(again.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(again.getByLabelText("OFF · Lost"));
    fireEvent.click(again.getByRole("button", { name: "Save" }));
    expect(linkOf(onChange, "RT")).toEqual({ functionId: "RT", rules: [], target: node(["S-OFF"], "N-GRID") });

    fireEvent.click(within(screen.getByRole("dialog", { name: "Function" })).getByRole("button", { name: "Close" }));
    expect(within(screen.getByRole("table", { name: "Functions" })).getByText("Network node GRID · Offsite power · DN-01")).toBeInTheDocument();
  });

  it("sets a network node for one tree and keeps Escape and the page scroll lock to the open window", async () => {
    const onChange = changeSpy();
    render(<Harness initial={networked()} onChange={onChange} />);
    const functionWindow = await openFunction("COOL");
    expect(document.body.style.overflow).toBe("hidden");
    const shutdown = within(functionWindow).getByLabelText("ET-B linked to");
    expect(selectedText(shutdown)).toBe("Not linked");

    fireEvent.change(shutdown, { target: { value: "node" } });
    expect(within(nodeWindow()).getByRole("heading", { name: "COOL · ET-B" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Network node" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Function" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.change(within(screen.getByRole("dialog", { name: "Function" })).getByLabelText("ET-B linked to"), { target: { value: "node" } });
    fireEvent.click(within(nodeWindow()).getByLabelText("FLOODED · Flooded"));
    fireEvent.click(within(nodeWindow()).getByRole("button", { name: "Save" }));
    expect(linkOf(onChange, "COOL")).toEqual({ functionId: "COOL", rules: [{ id: "tree:ET-B", treeIds: ["ET-B"], groupIds: [], stateIds: [], target: node(["S-FLOODED"]), reason: "" }] });
    const stored = within(screen.getByRole("dialog", { name: "Function" }));
    expect(selectedText(stored.getByLabelText("ET-B linked to"))).toBe(ROOM_TEXT);
    expect(selectedText(stored.getByLabelText("ET-A linked to"))).toBe("From ES · COOL-TOP");
    expect(stored.getByRole("button", { name: "Edit the network node for ET-B" })).toBeInTheDocument();
    expect(stored.queryByLabelText("ET-B reason for change")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Function" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(within(screen.getByRole("table", { name: "Functions" })).getByText("2 targets")).toBeInTheDocument();
  });

  it("changes a rule row to a network node and keeps its reason", async () => {
    const onChange = changeSpy();
    const rule = { id: "R-1", groupIds: ["IEG-01"], stateIds: ["POS-02"], target: COOLING, reason: "Shutdown uses the same cooling train." };
    render(<Harness initial={withFunctionLink(networked(), "COOL", { functionId: "COOL", rules: [rule] })} onChange={onChange} />);
    const functionWindow = await openFunction("COOL");
    fireEvent.change(within(functionWindow).getByLabelText("IEG-01 in POS-02 linked to"), { target: { value: "node" } });
    const picker = within(nodeWindow());
    expect(picker.getByRole("heading", { name: "COOL · IEG-01 in POS-02" })).toBeInTheDocument();
    fireEvent.click(picker.getByLabelText("WET · Wet"));
    fireEvent.click(picker.getByRole("button", { name: "Save" }));
    expect(linkOf(onChange, "COOL")).toEqual({ functionId: "COOL", rules: [{ ...rule, target: node(["S-WET"]) }] });
    expect(selectedText(within(screen.getByRole("dialog", { name: "Function" })).getByLabelText("IEG-01 in POS-02 linked to"))).toBe(ROOM_TEXT);
  });

  it("names a network node that is not in this workbook as missing and lists it in the checks", async () => {
    const onChange = changeSpy();
    render(<Harness initial={withDefaultLink(networked(), "RT", node(["S-FLOODED"], "N-ROOM", "BN-GONE"))} onChange={onChange} />);
    const functionWindow = await openFunction("RT");
    expect(selectedText(within(functionWindow).getByLabelText("Every tree linked to"))).toBe("Missing network node");
    expect(selectedText(within(functionWindow).getByLabelText("ET-A linked to"))).toBe("Every tree · Missing network node");
    fireEvent.click(within(functionWindow).getByRole("button", { name: "Close" }));
    expect(within(screen.getByRole("table", { name: "Functions" })).getByText("Missing network node")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: (name) => name.startsWith("Checks") }));
    expect(within(screen.getByRole("table", { name: "Checks" })).getByText("RT links to a network node that is not in this workbook's dependency networks.")).toBeInTheDocument();
  });

  it("shows a reviewer the node and its failing states without a way to change them", async () => {
    const onChange = changeSpy();
    render(<Harness initial={withDefaultLink(networked(), "RT", node(["S-FLOODED"]))} editable={false} onChange={onChange} />);
    const functionWindow = await openFunction("RT", "View");
    expect(within(functionWindow).getByLabelText("Every tree linked to")).toBeDisabled();
    fireEvent.click(within(functionWindow).getByRole("button", { name: "View the network node for Every tree" }));
    const picker = within(nodeWindow());
    expect(picker.getByLabelText("Network")).toBeDisabled();
    expect(picker.getByLabelText("Node")).toBeDisabled();
    expect(picker.getByLabelText("FLOODED · Flooded")).toBeChecked();
    expect(picker.getByLabelText("FLOODED · Flooded")).toBeDisabled();
    expect(picker.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps Save off until the workbook has an id and when the workbook has no dependency network", async () => {
    const onChange = changeSpy();
    const unsaved = render(<Harness initial={networked()} runtime={UNSAVED} onChange={onChange} />);
    fireEvent.change(within(await openFunction("RT")).getByLabelText("Every tree linked to"), { target: { value: "node" } });
    fireEvent.click(within(nodeWindow()).getByLabelText("FLOODED · Flooded"));
    expect(within(nodeWindow()).getByRole("button", { name: "Save" })).toBeDisabled();
    unsaved.unmount();

    render(<Harness initial={{ ...networked(), bayesianNetworks: [] }} onChange={onChange} />);
    fireEvent.change(within(await openFunction("RT")).getByLabelText("Every tree linked to"), { target: { value: "node" } });
    const picker = within(nodeWindow());
    expect(optionTexts(picker.getByLabelText("Network"))).toEqual(["No dependency network in this workbook"]);
    expect(picker.getByLabelText("Network")).toBeDisabled();
    expect(picker.getByLabelText("Node")).toBeDisabled();
    expect(picker.queryByRole("group")).not.toBeInTheDocument();
    expect(picker.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sets a network node for a function of a drawn tree without asking for a reason", async () => {
    const onChange = changeSpy();
    render(<Harness initial={withTypedTrees(networked(), [drawnTree()], modelUpstream(), NOW)} onChange={onChange} />);
    const functionWindow = within(await openFunction("DCOOL"));
    expect(selectedText(functionWindow.getByLabelText("ET-ESQ-01 linked to"))).toBe("Not linked");
    fireEvent.change(functionWindow.getByLabelText("ET-ESQ-01 linked to"), { target: { value: "node" } });
    expect(within(nodeWindow()).getByRole("heading", { name: "DCOOL · ET-ESQ-01" })).toBeInTheDocument();
    fireEvent.click(within(nodeWindow()).getByLabelText("FLOODED · Flooded"));
    fireEvent.click(within(nodeWindow()).getByRole("button", { name: "Save" }));
    expect(linkOf(onChange, "DCOOL")).toEqual({ functionId: "DCOOL", rules: [{ id: "tree:ET-DRAWN", treeIds: ["ET-DRAWN"], groupIds: [], stateIds: [], target: node(["S-FLOODED"]), reason: "" }] });
    const stored = within(screen.getByRole("dialog", { name: "Function" }));
    expect(selectedText(stored.getByLabelText("ET-ESQ-01 linked to"))).toBe(ROOM_TEXT);
    expect(stored.queryByRole("columnheader", { name: "Reason for change" })).not.toBeInTheDocument();
    const saved = lastOf(onChange);
    if (saved === undefined) throw new Error("nothing was saved");
    expect((modelViewOf(saved)?.findings ?? []).filter((finding) => finding.item.startsWith("DCOOL"))).toEqual([]);
  });

  it("links a functional event of a drawn tree to a fault tree top only", async () => {
    const onChange = changeSpy();
    const upstream = modelUpstream();
    const sy = upstream.sy;
    if (sy === undefined) throw new Error("SY fixture missing");
    jest.mocked(getSyWorkbook).mockResolvedValue({ workbookId: "sy-1", projectId: "p-1", ownerUsername: "analyst", revision: 1, mef: sy, myRoles: [], hasPreviousMef: false, updatedAt: NOW });
    render(<Harness initial={withTypedTrees(networked(), [drawnTree()], upstream, NOW)} onChange={onChange} />);
    await praxis();
    fireEvent.change(screen.getByLabelText("Event tree"), { target: { value: "ET-DRAWN" } });
    fireEvent.click(screen.getByRole("button", { name: (name) => name.includes("Drawn cooling") }));
    fireEvent.click(within(screen.getByLabelText("Event-tree node actions")).getByRole("button", { name: "Link" }));
    await praxis();

    const linkWindow = within(screen.getByRole("dialog", { name: "Link" }));
    expect(linkWindow.getByRole("heading", { name: "DCOOL" })).toBeInTheDocument();
    expect(linkWindow.getAllByRole("combobox")).toHaveLength(1);
    expect(optionTexts(linkWindow.getByLabelText("Fault tree top"))).toEqual(["Not linked", "COOL-TOP · COOL fails · COOL", "SUP-TOP · SUP fails · SUP", "RPS-TOP · RPS fails · RPS"]);
    expect(linkWindow.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(linkWindow.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.change(linkWindow.getByLabelText("Fault tree top"), { target: { value: "top:M-COOL:G-COOL" } });
    fireEvent.click(linkWindow.getByRole("button", { name: "Save" }));
    const last = lastOf(onChange);
    expect(last?.modelDecisions?.typedTrees?.[0]?.functionalEvents["FE-DRAWN"]).toEqual({ uuid: "FE-DRAWN", name: "Drawn cooling", label: "DCOOL", order: 0, faultTreeTopEvent: { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: "sy-1", modelId: "M-COOL", entityId: "G-COOL" } });
    expect(last?.model?.functions.find((record) => record.id === "DCOOL")).toEqual({ id: "DCOOL", name: "Drawn cooling", treeIds: ["ET-DRAWN"], esLinks: [{ treeId: "ET-DRAWN", top: { workbookId: "sy-1", modelId: "M-COOL", gateId: "G-COOL" } }] });
    expect(screen.queryByRole("dialog", { name: "Link" })).not.toBeInTheDocument();
  });
});
