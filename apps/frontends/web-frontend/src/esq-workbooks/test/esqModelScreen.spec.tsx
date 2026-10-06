import { JSX, useCallback, useMemo, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { EsqWorkbookProvider } from "../esqWorkbookContext";
import { ModelScreen, ModelWindows, type EsqWindowContext } from "../esqModelScreen";
import { withModelImported } from "../esqModel";
import { withCell } from "../esqBarriers";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";
import { windowCell } from "./esqBarrierFixtures";

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
    esq = withCell(esq, "BC-1", { ...windowCell("BC-1"), typed: { value: 0.99, basis: "Window runs." }, ofRecord: "TYPED" });
    esq = withCell(esq, "BC-2", { ...windowCell("BC-2"), use: "END_STATE_ATTRIBUTE" });
    render(<Harness initial={esq} window={{ kind: "esqFunction", id: "RT" }} openWindow={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Linked to"), { target: { value: "split" } });
    const from = screen.getByLabelText("Value from");
    expect([...from.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["Typed in ESQ", "Step 04 · BC-1 · F-REL · 9.9E-1", "DA · P-1 · 2E-3", "DA · P-PT · 1E-4"]);
    fireEvent.change(from, { target: { value: "cell:BC-1" } });
    expect(screen.getByLabelText("Value from")).toHaveValue("cell:BC-1");
    expect(screen.queryByLabelText("Mean")).not.toBeInTheDocument();
  });
});
