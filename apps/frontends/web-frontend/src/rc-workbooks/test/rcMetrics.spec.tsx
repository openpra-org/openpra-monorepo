import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { createBlankRc } from "../../../../../backends/web-backend/src/rc-workbooks/blank-rc";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import { RcMetricDrawer, RcMetricsCard } from "../rcMetrics";
import { RcWorkbookProvider, type RcWorkbookData } from "../rcWorkbookContext";

it("adds published metrics, edits them in the drawer and keeps the workbook valid", () => {
  const initial = createBlankRc("RC metrics test", "analyst");
  let current: RadiologicalConsequenceAnalysis = initial;

  function Harness() {
    const [rc, setRc] = useState(initial);
    const [openId, setOpenId] = useState<string>();
    return <RcWorkbookProvider data={{ rc, cc: {}, nms: [] } as unknown as RcWorkbookData} editable mutateRc={(change) => setRc((previous) => {
      current = change(previous);
      return current;
    })}>
      <RcMetricsCard openDrawer={(context) => setOpenId(context.id)} />
      {openId !== undefined && <RcMetricDrawer key={openId} id={openId} onClose={() => setOpenId(undefined)} centered />}
    </RcWorkbookProvider>;
  }

  render(<Harness />);
  expect(screen.getByText("No consequence metrics yet.")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Add metric" }));
  const table = screen.getByRole("table", { name: "Consequence metrics" });
  const lmpRow = within(table).getByRole("button", { name: "30-day dose at the EAB" }).closest("tr") as HTMLTableRowElement;
  expect(lmpRow).toHaveTextContent("Highest value on the EAB");
  expect(lmpRow).toHaveTextContent("30 days from release onset");
  expect(lmpRow).toHaveTextContent("Not credited");
  expect(lmpRow).toHaveTextContent("Chance of exceeding 0.001 Sv (100 mrem)");
  expect(lmpRow).toHaveTextContent("YesOpenRC returns TEDE per weather trial at each receptor.");
  expect(screen.getByRole("option", { name: "30-day dose at the EAB (NEI 18-04 F-C Target)" })).toBeDisabled();
  expect(screen.getByDisplayValue("30-day dose at the EAB")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Metric to add"), { target: { value: "qho-early" } });
  fireEvent.click(screen.getByRole("button", { name: "Add metric" }));
  const earlyRow = within(table).getByRole("button", { name: "Early fatality risk within 1 mile of the EAB" }).closest("tr") as HTMLTableRowElement;
  expect(earlyRow).toHaveTextContent("Average individual within 1.609 km (1 mi) of the EAB");
  expect(earlyRow).toHaveTextContent("Not yetOpenRC has no health-effect model yet.");
  expect(current.scope.metrics?.map((metric) => metric.id)).toEqual(["RCM-01", "RCM-02"]);

  const percentiles = screen.getByDisplayValue("5, 50, 95");
  fireEvent.change(percentiles, { target: { value: "95, 5, 150" } });
  fireEvent.blur(percentiles);
  expect(current.scope.metrics?.[1].statistics.percentiles).toEqual([5, 95]);

  const windowValue = screen.getByLabelText("Exposure window");
  expect(windowValue).toHaveValue(30);
  fireEvent.change(windowValue, { target: { value: "4" } });
  fireEvent.blur(windowValue);
  expect(current.scope.metrics?.[1].window).toEqual({ seconds: 345600, start: "PLUME_ARRIVAL" });
  fireEvent.change(screen.getByLabelText("Exposure window unit"), { target: { value: "hours" } });
  expect(current.scope.metrics?.[1].window?.seconds).toBe(345600);
  expect(screen.getByLabelText("Exposure window")).toHaveValue(96);

  fireEvent.click(screen.getByRole("button", { name: "Remove metric" }));
  expect(current.scope.metrics?.map((metric) => metric.name)).toEqual(["30-day dose at the EAB"]);
  expect(within(table).queryByText("Early fatality risk within 1 mile of the EAB")).not.toBeInTheDocument();
  expect(RadiologicalConsequenceAnalysisSchema.safeParse(current).success).toBe(true);
});
