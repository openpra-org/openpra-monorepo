import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createBlankRc } from "../../../../../backends/web-backend/src/rc-workbooks/blank-rc";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcEarlyResponseModel } from "interfaces-mef-types/rc/early-response";
import { blankEarlyResponseModel } from "interfaces-shared-types/rc-workbooks/early-response-parser";
import { ProtectiveScreen } from "../rcScreens";
import { evacuationDelayMinutes, protectionParameterQuantity, protectiveStepComplete, responseSummary, totalEvacuationDelay } from "../rcProtective";
import { RcWorkbookProvider, type RcWorkbookData } from "../rcWorkbookContext";

it("requires response timing only for actions that are included", () => {
  const pa = createBlankRc("RC test", "analyst").protectiveActionParameters;
  pa.siteAndReceptors = { revision: 1, settings: { latitude: 35, longitude: -93, receptorHeightMetres: 1.5, cellPoint: "mid" },
    geometry: { kind: "cells", radiiKm: [1], sectors: 16, abridged: false } };
  pa.cohortModeling.cohorts = [{ name: "Local population", description: "", populationPercent: 100, compliancePercent: 90 }];
  pa.protectiveActionsIncluded = [{ action: "SHELTERING", included: false, applicabilityJustification: "Not credited" }];
  expect(protectiveStepComplete(pa)).toBe(true);
  pa.protectiveActionsIncluded[0].included = true;
  expect(protectiveStepComplete(pa)).toBe(false);
  pa.responseTiming = { declarationAfterAccidentMinutes: 5, shelterStartMinutes: 15 };
  expect(protectiveStepComplete(pa)).toBe(true);
  pa.protectiveActionsIncluded.push({ action: "SHELTERING", included: false, applicabilityJustification: "Duplicate" });
  expect(protectiveStepComplete(pa)).toBe(false);
});

it("totals numeric delays while preserving readable legacy estimates", () => {
  const delays = [
    { component: "GENERAL_EMERGENCY_DECLARATION" as const, estimate: "0 min, reference point" },
    { component: "SITE_NOTIFIES_OFFICIALS" as const, estimate: "+15 min, notification", minutes: 20 },
  ];
  expect(evacuationDelayMinutes(delays[0])).toBe(0);
  expect(totalEvacuationDelay(delays)).toBe(20);
  expect(totalEvacuationDelay([{ component: "LOAD_VEHICLES", estimate: "Needs estimate" }])).toBeUndefined();
  expect(protectionParameterQuantity({ parameter: "Breathing rate", value: "0.000266 m³/s", source: "Reference" })).toEqual({ value: "0.000266", unit: "m³/s" });
});

it("creates a response draft without inventing population or cohort weights", async () => {
  const initial = createBlankRc("RC test", "analyst");
  let current: RadiologicalConsequenceAnalysis = initial;
  function Harness() {
    const [rc, setRc] = useState(initial);
    return <RcWorkbookProvider data={{ rc, cc: {}, nms: [] } as unknown as RcWorkbookData} editable mutateRc={(change) => setRc((previous) => {
      current = change(previous);
      return current;
    })} earlyResponse={{ importFile: jest.fn(), readOriginal: jest.fn(), calculate: jest.fn(), save: async (_revision, model) => {
      const saved = { ...model, revision: 1 };
      setRc(previous => { current = { ...previous, protectiveActionParameters: { ...previous.protectiveActionParameters, earlyResponseModel: saved } }; return current; });
      return saved;
    } }}><ProtectiveScreen openDrawer={jest.fn()} /></RcWorkbookProvider>;
  }

  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Create response model" }));
  fireEvent.click(screen.getByRole("tab", { name: "Response cohorts" }));
  fireEvent.click(screen.getByRole("button", { name: "Add cohort" }));
  expect(screen.getByRole("spinbutton", { name: "Result weight (unitless, 0–1)" })).toHaveValue(null);
  expect(current.protectiveActionParameters.earlyResponseModel).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Save response inputs" }));
  await waitFor(() => expect(current.protectiveActionParameters.earlyResponseModel?.cohorts).toMatchObject([{ evacuation: { shape: "UNSET" } }]));
  expect(current.protectiveActionParameters.earlyResponseModel?.population).toEqual({ source: "UNSET", weighting: "UNSET" });
});

it("edits cohort timing in seconds and saves it with the response model", async () => {
  const initial = createBlankRc("RC test", "analyst");
  initial.protectiveActionParameters.earlyResponseModel = { ...blankEarlyResponseModel(), cohorts: [{ id: "c1", name: "Local", evacuation: { shape: "CIRCULAR", shelterAndEvacuationOuterBand: 2 } }] };
  let savedModel: RcEarlyResponseModel | undefined;
  function Harness() {
    const [rc, setRc] = useState(initial);
    return <RcWorkbookProvider data={{ rc, cc: {}, nms: [] } as unknown as RcWorkbookData} editable mutateRc={(change) => setRc((previous) => {
      return change(previous);
    })} earlyResponse={{ importFile: jest.fn(), readOriginal: jest.fn(), calculate: jest.fn(), save: async (_revision, model) => {
      savedModel = model;
      const next = { ...model, revision: 2 };
      setRc(previous => ({ ...previous, protectiveActionParameters: { ...previous.protectiveActionParameters, earlyResponseModel: next } }));
      return next;
    } }}><ProtectiveScreen openDrawer={jest.fn()} /></RcWorkbookProvider>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("tab", { name: "Response cohorts" }));
  const alarm = screen.getByRole("spinbutton", { name: "Notification after accident (s)" });
  fireEvent.change(alarm, { target: { value: "2700" } }); fireEvent.blur(alarm);
  const shelter = screen.getByRole("textbox", { name: "Shelter delays by band (s)" });
  fireEvent.change(shelter, { target: { value: "1980, 2700" } }); fireEvent.blur(shelter);
  fireEvent.click(screen.getByRole("button", { name: "Save response inputs" }));
  await waitFor(() => expect(savedModel?.cohorts[0].evacuation).toMatchObject({ notificationAfterAccidentSeconds: 2700, shelterDelaySecondsByBand: [1980, 2700] }));
});

it("computes people and response times from imported population and saved shares", () => {
  const pa = createBlankRc("RC test", "analyst").protectiveActionParameters;
  pa.cohortModeling.cohorts = [
    { name: "A", description: "", populationPercent: 60, compliancePercent: 50 },
    { name: "B", description: "", populationPercent: 40, compliancePercent: 100 },
  ];
  pa.protectiveActionsIncluded = [
    { action: "SHELTERING", included: true, applicabilityJustification: "Study" },
    { action: "EVACUATION", included: true, applicabilityJustification: "Study" },
  ];
  pa.responseTiming = { declarationAfterAccidentMinutes: 5, shelterStartMinutes: 10, evacuationStartMinutes: 40, evacuationSpeedMetresPerSecond: 1 };
  expect(responseSummary(pa, 1000)).toMatchObject({ complyingPercent: 70, complyingPeople: 700, shelterAfterAccident: 15, departureAfterAccident: 45, shelterDuration: 30 });
  expect(protectiveStepComplete(pa)).toBe(false);
  pa.siteAndReceptors = { revision: 1, settings: { latitude: 35, longitude: -93, receptorHeightMetres: 1.5, cellPoint: "mid" },
    geometry: { kind: "cells", radiiKm: [1], sectors: 16, abridged: false } };
  expect(protectiveStepComplete(pa)).toBe(true);
  pa.cohortModeling.cohorts[1].populationPercent = 30;
  expect(protectiveStepComplete(pa)).toBe(false);
});
