import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { createBlankRc } from "../../../../../backends/web-backend/src/rc-workbooks/blank-rc";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import { HandoffScreen } from "../rcScreens";
import { stepsFromMef } from "../rcSelectors";
import { RcWorkbookProvider, type RcWorkbookData } from "../rcWorkbookContext";
import { RcWorkbench } from "../rcWorkbench";

jest.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ user: { username: "analyst", roles: [] } }),
}));

it("uses later step data for treatment and saves explicit scope decisions", () => {
  const initial = createBlankRc("RC scope test", "analyst");
  initial.scope.protectiveActionsModellingDegree = "Old manual treatment text";
  let current: RadiologicalConsequenceAnalysis = initial;

  function Harness() {
    const [rc, setRc] = useState(initial);
    return <RcWorkbookProvider data={{ rc, cc: {}, nms: [] } as unknown as RcWorkbookData} editable mutateRc={(change) => setRc((previous) => {
      current = change(previous);
      return current;
    })}>
      <HandoffScreen ccId="cc-ii" setCcId={jest.fn()} site="actual_site" setSite={jest.fn()} openDrawer={jest.fn()} />
      <button type="button" onClick={() => setRc((previous) => ({
        ...previous,
        protectiveActionParameters: {
          ...previous.protectiveActionParameters,
          protectiveActionsIncluded: [{ action: "EVACUATION", included: true }],
        },
      }))}>Record evacuation</button>
    </RcWorkbookProvider>;
  }

  render(<Harness />);
  const table = screen.getByRole("table", { name: "Evaluation by aspect" });
  expect(within(table).getAllByRole("row")).toHaveLength(8);
  expect(within(table).getByText("Consequence quantification")).toBeInTheDocument();
  expect(within(table).queryByText("Old manual treatment text")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Record evacuation" }));
  expect(within(table).getByText("evacuation")).toBeInTheDocument();

  const protectiveRow = within(table).getByText("Protective actions and site").closest("tr") as HTMLTableRowElement;
  fireEvent.change(screen.getByRole("combobox", { name: "Protective actions and site inclusion" }), { target: { value: "excluded" } });
  expect(within(protectiveRow).queryByText("evacuation")).not.toBeInTheDocument();
  expect(stepsFromMef(current, "preparer").find((step) => step.id === "protective")?.excluded).toBe(true);
  fireEvent.change(screen.getByRole("combobox", { name: "Protective actions and site inclusion" }), { target: { value: "included" } });
  expect(within(protectiveRow).getByText("evacuation")).toBeInTheDocument();
  expect(stepsFromMef(current, "preparer").find((step) => step.id === "protective")?.excluded).toBeUndefined();

  fireEvent.change(screen.getByRole("combobox", { name: "Economic factors inclusion" }), { target: { value: "excluded" } });
  const reason = screen.getByRole("textbox", { name: "Economic factors exclusion reason" });
  fireEvent.change(reason, { target: { value: "Dose-only application" } });
  fireEvent.blur(reason);
  expect(current.scope.evaluationDecisions).toContainEqual({ subElement: "RCEC", included: false, exclusionReason: "Dose-only application" });
  expect(RadiologicalConsequenceAnalysisSchema.safeParse(current).success).toBe(true);
});

it("disables excluded steps and skips them in workbook navigation", () => {
  const rc = createBlankRc("RC scope test", "analyst");
  rc.scope.evaluationDecisions = [
    { subElement: "RCPA", included: false, exclusionReason: "Outside analysis scope" },
    { subElement: "RCME", included: false, exclusionReason: "Outside analysis scope" },
  ];
  const data = { rc, cc: {}, nms: [] } as unknown as RcWorkbookData;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true }) });
  const { container } = render(<MemoryRouter><RcWorkbookProvider data={data} editable mutateRc={jest.fn()}>
    <RcWorkbench data={data} persona="preparer" setPersona={jest.fn()} showPersonaPicker={false} headerMeta={{ projectName: "Test", workbookName: rc.name, workbookVersion: rc.version }} />
  </RcWorkbookProvider></MemoryRouter>);

  const rail = screen.getByRole("complementary", { name: "RC analysis steps" });
  expect(within(rail).getByRole("button", { name: /Protective Actions & Site/ })).toBeDisabled();
  expect(within(rail).getByRole("button", { name: /Meteorology/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Next: Atmospheric Dispersion/ })).toBeInTheDocument();
  expect(container.querySelector("[data-screen-label='RC — Scope']")).toBeInTheDocument();
});
