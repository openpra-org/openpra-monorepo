import { JSX, useCallback, useMemo, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { EsqWorkbookProvider } from "../esqWorkbookContext";
import { ModelScreen, ModelWindows, type EsqWindowContext } from "../esqModelScreen";
import { withFunctionLink, withModelImported } from "../esqModel";
import { withCell } from "../esqBarriers";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { PUMP_ESTIMATE, linkedEsq, modelUpstream } from "./esqModelFixtures";
import { windowCell } from "./esqBarrierFixtures";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

async function settle(): Promise<void> {
  await act(async () => { await settledWithPraxis(() => undefined); });
}

function cooled(): EventSequenceQuantification {
  const esq = withModelImported(linkedEsq(), modelUpstream(), "2026-10-05T12:00:00.000Z");
  return withFunctionLink(esq, "RT", { functionId: "RT", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-RPS", gateId: "G-RPS" } } });
}

function Harness({ initial, window: context, openWindow }: { initial: EventSequenceQuantification; window?: EsqWindowContext; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [esq, setEsq] = useState(initial);
  const upstream = useMemo(() => modelUpstream(), []);
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => mutator(current)), []);
  return (
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={mutateEsq} upstream={upstream}>
      {context === undefined ? <ModelScreen openWindow={openWindow} /> : <ModelWindows context={context} onClose={() => undefined} onRetarget={openWindow} />}
    </EsqWorkbookProvider>
  );
}

describe("ESQ Step 02 model screen", () => {
  it("imports the linked workbooks and counts each tab", () => {
    render(<Harness initial={linkedEsq()} openWindow={jest.fn()} />);
    expect(screen.getByText("Nothing is imported yet. Import from the linked workbooks above.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import from linked workbooks" }));
    expect(screen.getByRole("tab", { name: "Sequences (7)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Families (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Functions (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Initiators (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Values (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import again" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Sequences" })).toHaveTextContent("To ET-T");
  });

  it("opens the function window from the function name", () => {
    const openWindow = jest.fn();
    render(<Harness initial={withModelImported(linkedEsq(), modelUpstream(), "2026-10-05T12:00:00.000Z")} openWindow={openWindow} />);
    fireEvent.click(screen.getByRole("tab", { name: "Functions (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "RT" }));
    expect(openWindow).toHaveBeenCalledWith({ kind: "esqFunction", id: "RT" });
  });

  it("links a function to a fault tree top in its window", () => {
    render(<Harness initial={withModelImported(linkedEsq(), modelUpstream(), "2026-10-05T12:00:00.000Z")} window={{ kind: "esqFunction", id: "RT" }} openWindow={jest.fn()} />);
    const select = screen.getByLabelText("Linked to");
    expect(select).toHaveValue("");
    fireEvent.change(select, { target: { value: "top:M-RPS:G-RPS" } });
    expect(screen.getByLabelText("Linked to")).toHaveValue("top:M-RPS:G-RPS");
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(screen.getByRole("group", { name: "Rule 1" })).toBeInTheDocument();
  });

  it("takes a split fraction from a Step 04 cell", () => {
    let esq = withModelImported(linkedEsq(), modelUpstream(), "2026-10-05T12:00:00.000Z");
    esq = withCell(esq, "BC-1", { ...windowCell("BC-1"), typed: { expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.99 } } }, basis: "Window runs." }, ofRecord: "TYPED" });
    esq = withCell(esq, "BC-2", { ...windowCell("BC-2"), use: "END_STATE_ATTRIBUTE" });
    render(<Harness initial={esq} window={{ kind: "esqFunction", id: "RT" }} openWindow={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Linked to"), { target: { value: "split" } });
    const from = screen.getByLabelText("Value from");
    expect([...from.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["Typed in ESQ", "Step 04 · BC-1 · F-REL · 0.99", "DA · P-SF · 1E-2"]);
    fireEvent.change(from, { target: { value: "cell:BC-1" } });
    expect(screen.getByLabelText("Value from")).toHaveValue("cell:BC-1");
    expect(screen.queryByLabelText("Mean")).not.toBeInTheDocument();
  });

  it("shows the PRAXIS point of component values and their expression in the detail row", async () => {
    jest.mocked(evaluateUncertainty).mockReset();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    render(<Harness initial={cooled()} openWindow={jest.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Values (4)" }));
    await settle();
    const table = screen.getByRole("table", { name: "Values" });
    const pump = within(table).getByRole("button", { name: "COOL-PMP-FS" }).closest("tr");
    const human = within(table).getByRole("button", { name: "SUP-HFE" }).closest("tr");
    if (pump === null || human === null) throw new Error("no row");
    expect(pump).toHaveTextContent("2E-3");
    expect(human).toHaveTextContent("1E-3");
    const sent = jest.mocked(evaluateUncertainty).mock.calls.flatMap(([request]) => request.expressions.map((query) => query.expression));
    expect(sent).toEqual(expect.arrayContaining([{ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "P-1" } }]));
    const parameters = jest.mocked(evaluateUncertainty).mock.calls.flatMap(([request]) => request.parameters);
    expect(parameters).toEqual(expect.arrayContaining([{ reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "P-1" }, expression: PUMP_ESTIMATE }]));
    fireEvent.click(within(pump).getByRole("button", { name: "Show the details of COOL-PMP-FS" }));
    expect(table).toHaveTextContent("P-1");
    const fan = within(table).getByRole("button", { name: "SUP-FAN-FR" }).closest("tr");
    if (fan === null) throw new Error("no row");
    fireEvent.click(within(fan).getByRole("button", { name: "Show the details of SUP-FAN-FR" }));
    expect(table).toHaveTextContent("Mission: rate 2.00E-5 per hour over 24 hours");
  });

  it("offers only component DA estimates for a component event", async () => {
    jest.mocked(evaluateUncertainty).mockReset();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    render(<Harness initial={cooled()} window={{ kind: "esqValue", id: "E-1" }} openWindow={jest.fn()} />);
    await settle();
    const options = [...screen.getByLabelText("Value from").querySelectorAll("option")].map((option) => option.textContent);
    expect(options).toEqual([
      "As SY gives it · DA · P-1 · P-1",
      "DA · P-1 · Lognormal (mean 2.00E-3, EF 5) cut to [−∞, 1]",
      "DA · P-PT · 1.00E-4",
      "DA · P-FR · Lognormal (mean 2.00E-5, EF 3)",
      "HR · HFE-1 · 1E-3",
    ]);
    expect(screen.getByText("P-1 · 2E-3")).toBeInTheDocument();
  });

  it("shows the PRAXIS point of each initiator and types its frequency as a law", async () => {
    jest.mocked(evaluateUncertainty).mockReset();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    const { unmount } = render(<Harness initial={cooled()} openWindow={jest.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Initiators (1)" }));
    await settle();
    const row = within(screen.getByRole("table", { name: "Initiator frequencies" })).getByRole("button", { name: "IEG-01" }).closest("tr");
    if (row === null) throw new Error("no row");
    expect(row).toHaveTextContent("2.94");
    fireEvent.click(within(row).getByRole("button", { name: "Show the details of IEG-01" }));
    await settle();
    expect(screen.getByRole("table", { name: "Initiator frequencies" })).toHaveTextContent("Lognormal (mean 2.94, EF 2.3)");
    unmount();
    render(<Harness initial={cooled()} window={{ kind: "esqInitiator", id: "IEG-01" }} openWindow={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Frequency from"), { target: { value: "typed" } });
    expect(screen.getByLabelText("Law")).toHaveValue("LOGNORMAL");
    fireEvent.change(screen.getByLabelText("Law"), { target: { value: "GAMMA" } });
    expect(screen.getByLabelText("Law")).toHaveValue("GAMMA");
    expect(screen.getByText("Type the frequency per plant-year.")).toBeInTheDocument();
  });

  it("shows a common cause group with the shared factor editor", async () => {
    jest.mocked(evaluateUncertainty).mockReset();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    const upstream = modelUpstream();
    if (upstream.sy !== undefined) {
      upstream.sy.commonCauseFailureGroups = [{
        uuid: "CCF-PUMPS",
        name: "Pumps",
        description: "",
        scope: "INTRASYSTEM",
        affectedComponents: [],
        affectedSystems: [],
        members: { basicEvents: [{ id: "E-1" }, { id: "E-4" }] },
        factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [19, 1] } } },
        total: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "P-1" } },
        implementsSrs: [],
      }];
    }
    const esq = withFunctionLink(withModelImported(linkedEsq(), upstream, "2026-10-05T12:00:00.000Z"), "RT", { functionId: "RT", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-RPS", gateId: "G-RPS" } } });
    expect(esq.model?.ccfGroups[0]).toMatchObject({ id: "CCF-PUMPS", factors: { model: "ALPHA_FACTOR", testing: "STAGGERED" } });
    render(<Harness initial={esq} window={{ kind: "esqValue", id: "CCF-PUMPS" }} openWindow={jest.fn()} />);
    await settle();
    expect(screen.getByLabelText("Model")).toHaveValue("ALPHA_FACTOR");
    expect(screen.getByLabelText("Model")).toBeDisabled();
    expect(screen.getByLabelText("Testing")).toHaveValue("STAGGERED");
    expect(screen.getByText("P-1 · 2E-3")).toBeInTheDocument();
  });
});
