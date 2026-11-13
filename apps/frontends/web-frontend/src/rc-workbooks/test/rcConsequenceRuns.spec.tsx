import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { RcCaseRecords } from "interfaces-mef-types/rc/case-records";
import type {
  RcConsequenceRun,
  RcConsequenceRunDetails,
  RcConsequenceRunFileKind,
  RcConsequenceRunRequest,
  RcConsequenceRunSetup,
  RcConsequenceRunTextPage,
  RcConsequenceRunTrialOrder,
  RcConsequenceRunTrialPage,
  RcConsequenceRunTrialRow,
} from "interfaces-mef-types/rc/consequence-runs";
import { RcConsequenceRunsTab, RcRunJobs, useRcConsequenceRuns } from "../rcConsequenceRuns";
import { RcQuantificationPanel } from "../rcQuantification";
import { RcWorkbookProvider, type RcCaseActions, type RcConsequenceRunActions, type RcWorkbookData } from "../rcWorkbookContext";

const SNAPSHOT_ID = "00000000-0000-4000-8000-000000000002";
const OTHER_SNAPSHOT_ID = "00000000-0000-4000-8000-000000000003";
const RUN_A = "10000000-0000-4000-8000-000000000001";
const RUN_B = "10000000-0000-4000-8000-000000000002";
const RUN_C = "10000000-0000-4000-8000-000000000003";
const ENGINE = `sha256:${"0123456789abcdef".repeat(4)}`;

const file = { documentId: "00000000-0000-4000-8000-000000000001", filename: "Case-01-inputs.json", sha256: "a".repeat(64), size: 10, uploadedAt: "2026-11-12T00:00:00.000Z" };
const snapshotMetrics = [
  { id: "RCM-01", name: "30-day dose at the EAB", quantity: "INDIVIDUAL_DOSE", windowSeconds: 2592000, unit: "Sv", statistics: { mean: true, percentiles: [5, 50, 95], exceedanceThresholds: [0.001] } },
  { id: "RCM-02", name: "96-hour dose by distance", quantity: "INDIVIDUAL_DOSE", windowSeconds: 345600, unit: "Sv", statistics: { mean: true, percentiles: [50, 95], exceedanceThresholds: [0.01] } },
];
const snapshotOf = (id: string, label: string, categoryId: string) => ({
  id,
  label,
  categoryId,
  file,
  inputHash: (id === SNAPSHOT_ID ? "b" : "c").repeat(64),
  createdBy: "analyst",
  reviewItems: 2,
  inventoryCount: 3,
  receptorCount: 5,
  trialCount: 24,
  metrics: snapshotMetrics,
});

const SETUP: RcConsequenceRunSetup = {
  snapshotId: SNAPSHOT_ID,
  trialCount: 24,
  heightMetres: 1.5,
  distancesMetres: [425, 2034.344, 6000, 16518.44, 80000],
  metrics: [
    { id: "RCM-01", name: "30-day dose at the EAB", receptorKind: "EAB_MAXIMUM", runnable: true, reason: "" },
    { id: "RCM-02", name: "96-hour dose by distance", receptorKind: "DISTANCE_PROFILE", runnable: true, reason: "" },
    { id: "RCM-03", name: "Early fatality risk within 1 mile of the EAB", receptorKind: null, runnable: false, reason: "OpenRC has no health-effect model yet." },
  ],
};

function runOf(patch: Partial<RcConsequenceRun> = {}): RcConsequenceRun {
  return {
    id: RUN_A,
    label: "Run 01",
    categoryId: "RC-1",
    snapshotId: SNAPSHOT_ID,
    snapshotLabel: "Case 01",
    metricId: "RCM-01",
    metricName: "30-day dose at the EAB",
    unit: "Sv",
    receptorKind: "EAB_MAXIMUM",
    windowSeconds: 2592000,
    statistics: { mean: true, percentiles: [5, 50, 95], exceedanceThresholds: [0.001] },
    distancesMetres: [425],
    heightMetres: 1.5,
    trialCount: 24,
    jobCount: 2,
    notes: [{ code: "NUCLIDES_WITHOUT_CHEMICAL_GROUP", message: "OpenRC has no chemical group for H-3 and leaves it out of the dose" }],
    status: "SUCCEEDED",
    requestedBy: "analyst",
    requestedAt: "2026-11-12T12:00:00.000Z",
    startedAt: "2026-11-12T12:00:01.000Z",
    completedAt: "2026-11-12T12:00:05.000Z",
    engineVersion: ENGINE,
    failure: null,
    progress: null,
    ...patch,
  };
}

const statisticsOf = (scale: number) => ({
  mean: 0.0123 * scale,
  percentiles: [
    { percentile: 5, value: 0.002 * scale },
    { percentile: 50, value: 0.01 * scale },
    { percentile: 95, value: 0.03 * scale },
  ],
  exceedances: [{ threshold: 0.001, probability: 1 }],
});

function detailsOf(run: RcConsequenceRun): RcConsequenceRunDetails {
  return { run, result: { distances: [{ distanceMetres: 425, statistics: statisticsOf(1), minimumSv: 0.0015, maximumSv: 0.035 }] } };
}

const trialRow = (index: number): RcConsequenceRunTrialRow => ({
  trialId: `D001P${String(index + 1).padStart(2, "0")}`,
  start: `Day 1, period ${String(index + 1)}`,
  selectionGroup: "Day 1",
  stabilityClass: "D",
  windSpeedMetresPerSecond: 3,
  windTowardDegrees: 90,
  mixingHeightMetres: 1000,
  doseSv: 0.001 * (index + 1),
  dispersionSecondsPerCubicMetre: 0.00002,
});

const trialPageOf = (total: number, offset: number): RcConsequenceRunTrialPage => ({
  distanceMetres: 425,
  total,
  offset,
  size: 10,
  rows: Array.from({ length: Math.min(10, total - offset) }, (_row, index) => trialRow(offset + index)),
});

function workbook(records?: RcCaseRecords, boundary: number | null = 425): RcWorkbookData {
  const data: RcWorkbookData = JSON.parse(
    JSON.stringify({
      rc: {
        releaseCategoryToConsequence: {
          siteInformation:
            boundary === null
              ? { isBounding: false, siteReference: "SITE-1" }
              : { isBounding: true, boundingSite: { description: "", characteristics: { siteBoundaryDistance: boundary }, boundingJustification: "" } },
          releaseCategoryInputs: [
            { releaseCategory: "RC-1", releaseCharacteristics: {} },
            { releaseCategory: "RC-2", releaseCharacteristics: {} },
          ],
        },
        protectiveActionParameters: {},
        meteorologicalData: {},
        atmosphericTransportAndDispersion: {},
        dosimetry: {},
        consequenceQuantification: { caseRecords: records },
      },
      cc: {},
      nms: [],
    }),
  );
  return data;
}

function recordsOf(results: object[] = []): RcCaseRecords {
  const records: RcCaseRecords = JSON.parse(
    JSON.stringify({ revision: 1, snapshots: [snapshotOf(SNAPSHOT_ID, "Case 01", "RC-1"), snapshotOf(OTHER_SNAPSHOT_ID, "Case 02", "RC-2")], results }),
  );
  return records;
}

function actionsOf(runs: RcConsequenceRun[]): jest.Mocked<RcConsequenceRunActions> {
  return {
    list: jest.fn<Promise<RcConsequenceRun[]>, []>(async () => [...runs]),
    setup: jest.fn<Promise<RcConsequenceRunSetup>, [string]>(async () => SETUP),
    start: jest.fn<Promise<RcConsequenceRun>, [RcConsequenceRunRequest]>(async () => runOf({ id: RUN_C, label: "Run 03", status: "QUEUED", startedAt: null, completedAt: null, engineVersion: null, progress: { completed: 0, total: 2, queuedJobs: null, workers: null } })),
    read: jest.fn<Promise<RcConsequenceRunDetails>, [string]>(async (runId) => detailsOf(runs.find((run) => run.id === runId) ?? runOf())),
    readTrials: jest.fn<Promise<RcConsequenceRunTrialPage>, [string, number, number, RcConsequenceRunTrialOrder]>(async (_runId, _distanceIndex, offset) => trialPageOf(24, offset)),
    readFile: jest.fn<Promise<RcConsequenceRunTextPage>, [string, RcConsequenceRunFileKind, number]>(async (_runId, kind, offset) => ({
      text: Array.from({ length: 20 }, (_line, index) => `${kind} line ${String(offset + index + 1)}`).join("\n"),
      offset,
      total: 45,
      size: 20,
    })),
    cancel: jest.fn<Promise<RcConsequenceRun>, [string]>(async () => runOf({ status: "CANCELLED" })),
    remove: jest.fn<Promise<void>, [string]>(async () => undefined),
    record: jest.fn<Promise<RcCaseRecords>, [number, string, number]>(async () => recordsOf()),
  };
}

function Harness({ actions, categoryId = "RC-1" }: { actions: RcConsequenceRunActions; categoryId?: string }) {
  const feed = useRcConsequenceRuns(actions);
  return (
    <>
      <RcRunJobs feed={feed} />
      <section className="rc-quantification">
        <RcConsequenceRunsTab categoryId={categoryId} feed={feed} />
      </section>
    </>
  );
}

interface ShowOptions {
  records?: RcCaseRecords;
  editable?: boolean;
  boundary?: number | null;
  categoryId?: string;
}

function mount(actions: RcConsequenceRunActions, options: ShowOptions = {}) {
  return render(
    <RcWorkbookProvider data={workbook(options.records ?? recordsOf(), options.boundary)} editable={options.editable ?? true} mutateRc={jest.fn()} consequenceRuns={actions}>
      <Harness actions={actions} categoryId={options.categoryId} />
    </RcWorkbookProvider>,
  );
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let tick = 0; tick < 10; tick += 1) await Promise.resolve();
  });
}

async function show(actions: RcConsequenceRunActions, options: ShowOptions = {}) {
  const view = mount(actions, options);
  await settle();
  return view;
}

const startsWith = (start: string) => (text: string): boolean => text.startsWith(start);

const recordName = (name: string): boolean => name.includes("as category result");

const valueOf = (label: string): string => {
  const term = within(screen.getByLabelText("Run statistics")).getByText(label);
  return term.nextElementSibling?.textContent ?? "";
};

const cells = (table: HTMLElement): string[][] =>
  within(table)
    .getAllByRole("row")
    .map((row) => within(row).queryAllByRole("cell").map((cell) => cell.textContent ?? ""))
    .filter((row) => row.length > 0);

describe("OpenRC runs in Step 08", () => {
  afterEach(settle);

  it("offers the snapshot, the metrics OpenRC can run and the receptor of the workbook, and starts a run", async () => {
    const runs: RcConsequenceRun[] = [];
    const actions = actionsOf(runs);
    actions.start.mockImplementation(async () => {
      const started = runOf({ id: RUN_C, label: "Run 03", status: "QUEUED", startedAt: null, completedAt: null, engineVersion: null, progress: { completed: 0, total: 2, queuedJobs: null, workers: null } });
      runs.unshift(started);
      return started;
    });
    await show(actions);
    await screen.findByRole("option", { name: "30-day dose at the EAB" });
    expect(actions.setup).toHaveBeenCalledWith(SNAPSHOT_ID);
    expect(within(screen.getByLabelText("Run input snapshot")).getAllByRole("option").map((option) => option.textContent)).toEqual(["Case 01 · 2 metrics · 2 review items"]);
    const metric = screen.getByLabelText("Run consequence metric");
    expect(metric).toHaveValue("RCM-01");
    expect(screen.getByRole("option", { name: "Early fatality risk within 1 mile of the EAB (not in OpenRC)" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "96-hour dose by distance" })).toBeEnabled();
    expect(screen.getByLabelText("Receptor distance source")).toHaveValue("linked");
    expect(screen.getByRole("option", { name: "Site boundary distance, 425 m" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Typed receptor distance")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Receptor height source")).toHaveValue("linked");
    expect(screen.getByRole("option", { name: "Step 02 receptor height, 1.5 m" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Typed receptor height")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "OpenRC runs" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run OpenRC" }));
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith({ snapshotId: SNAPSHOT_ID, metricId: "RCM-01", distancesMetres: [425], heightMetres: 1.5 }));
    const list = await screen.findByRole("table", { name: "OpenRC runs" });
    expect(cells(list)[0].slice(0, 4)).toEqual(["Run 03", "30-day dose at the EAB", "425 m", "24"]);
    expect(cells(list)[0][5]).toBe("Queued");
    expect(screen.getByRole("heading", { name: "Run 03 · 30-day dose at the EAB" })).toBeInTheDocument();
    expect(screen.getByText("Waiting for a PRAETOR worker")).toBeInTheDocument();
  });

  it("takes typed distances and a typed height, and flags text that is not a distance", async () => {
    const actions = actionsOf([]);
    await show(actions);
    await screen.findByRole("option", { name: "30-day dose at the EAB" });
    fireEvent.change(screen.getByLabelText("Receptor distance source"), { target: { value: "typed" } });
    const distance = screen.getByLabelText("Typed receptor distance");
    const run = screen.getByRole("button", { name: "Run OpenRC" });
    expect(run).toBeDisabled();
    fireEvent.change(distance, { target: { value: "0" } });
    expect(screen.getByText("Positive numbers only")).toBeInTheDocument();
    fireEvent.change(distance, { target: { value: "425, 600" } });
    expect(screen.getByText("One distance only")).toBeInTheDocument();
    expect(run).toBeDisabled();
    fireEvent.change(distance, { target: { value: " 600 " } });
    expect(screen.queryByText("One distance only")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Receptor height source"), { target: { value: "typed" } });
    expect(run).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Typed receptor height"), { target: { value: "-1" } });
    expect(screen.getByText("Zero or more")).toBeInTheDocument();
    expect(run).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Typed receptor height"), { target: { value: "0" } });
    fireEvent.click(run);
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith({ snapshotId: SNAPSHOT_ID, metricId: "RCM-01", distancesMetres: [600], heightMetres: 0 }));

    fireEvent.change(screen.getByLabelText("Run consequence metric"), { target: { value: "RCM-02" } });
    const distances = screen.getByLabelText("Typed receptor distances");
    fireEvent.change(distances, { target: { value: "1000, 2000 ,3000," } });
    await waitFor(() => expect(run).toBeEnabled());
    fireEvent.click(run);
    await waitFor(() => expect(actions.start).toHaveBeenLastCalledWith({ snapshotId: SNAPSHOT_ID, metricId: "RCM-02", distancesMetres: [1000, 2000, 3000], heightMetres: 0 }));
    fireEvent.change(distances, { target: { value: "1000, 1000" } });
    expect(screen.getByText("Positive numbers only")).toBeInTheDocument();
    fireEvent.change(distances, { target: { value: "1000, far" } });
    expect(screen.getByText("Positive numbers only")).toBeInTheDocument();
  });

  it("links a dose by distance to the Step 02 distances of the snapshot, and types when the workbook has no boundary distance", async () => {
    const actions = actionsOf([]);
    const { unmount } = await show(actions);
    await screen.findByRole("option", { name: "30-day dose at the EAB" });
    fireEvent.change(screen.getByLabelText("Run consequence metric"), { target: { value: "RCM-02" } });
    expect(screen.getByRole("option", { name: "Step 02 evaluation distances, 5 distances" })).toBeInTheDocument();
    expect(screen.getByLabelText("Receptor distance source")).toHaveValue("linked");
    fireEvent.click(screen.getByRole("button", { name: "Run OpenRC" }));
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith({ snapshotId: SNAPSHOT_ID, metricId: "RCM-02", distancesMetres: [425, 2034.344, 6000, 16518.44, 80000], heightMetres: 1.5 }));
    unmount();

    await show(actionsOf([]), { boundary: null });
    await screen.findByRole("option", { name: "30-day dose at the EAB" });
    expect(screen.getByLabelText("Receptor distance source")).toHaveValue("typed");
    expect(screen.queryByRole("option", { name: "Site boundary distance, 425 m" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Typed receptor distance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run OpenRC" })).toBeDisabled();
  });

  it("shows the statistics the metric asks for, pages the weather trials ten at a time and records the run", async () => {
    const actions = actionsOf([runOf(), runOf({ id: RUN_B, label: "Run 02", categoryId: "RC-2", snapshotId: OTHER_SNAPSHOT_ID })]);
    await show(actions);
    const list = await screen.findByRole("table", { name: "OpenRC runs" });
    expect(cells(list)).toHaveLength(1);
    expect(cells(list)[0][0]).toBe("Run 01");
    expect(cells(list)[0][5]).toBe("Finished");
    await screen.findByLabelText("Run statistics");
    expect(actions.read).toHaveBeenCalledWith(RUN_A);
    expect(valueOf("Receptor distance")).toBe("425 m");
    expect(valueOf("Receptor height")).toBe("1.5 m");
    expect(valueOf("Exposure window")).toBe("30 days");
    expect(valueOf("Weather trials")).toBe("24");
    expect(valueOf("Mean")).toBe("0.0123 Sv");
    expect(valueOf("5th percentile")).toBe("0.002 Sv");
    expect(valueOf("50th percentile")).toBe("0.01 Sv");
    expect(valueOf("95th percentile")).toBe("0.03 Sv");
    expect(valueOf("Chance of exceeding 0.001 Sv (100 mrem)")).toBe("1");
    expect(valueOf("Lowest and highest dose")).toBe("0.0015 to 0.035 Sv");
    expect(screen.queryByRole("table", { name: "Dose by distance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Dose by nuclide" })).not.toBeInTheDocument();
    expect(screen.getByText("OpenRC has no chemical group for H-3 and leaves it out of the dose.")).toBeInTheDocument();
    expect(screen.getByText(startsWith("Case 01 · RC-1 · 425 m at 1.5 m height · 2 jobs · started by analyst"))).toHaveTextContent("OpenRC 0123456789ab");

    const trials = await screen.findByRole("table", { name: "Dose by weather trial" });
    expect(actions.readTrials).toHaveBeenCalledWith(RUN_A, 0, 0, "trial");
    expect(cells(trials)).toHaveLength(10);
    expect(cells(trials)[0]).toEqual(["D001P01", "D", "3", "90", "1000", "0.001", "2e-5"]);
    const pager = screen.getByRole("navigation", { name: "Weather trials pagination" });
    expect(within(pager).getByText("1 to 10 of 24")).toBeInTheDocument();
    expect(within(pager).getByRole("button", { name: "First" })).toBeDisabled();
    fireEvent.click(within(pager).getByRole("button", { name: "Last" }));
    await waitFor(() => expect(actions.readTrials).toHaveBeenLastCalledWith(RUN_A, 0, 20, "trial"));
    await screen.findByText("21 to 24 of 24");
    expect(cells(screen.getByRole("table", { name: "Dose by weather trial" }))).toHaveLength(4);
    fireEvent.change(screen.getByLabelText("Trial order"), { target: { value: "dose" } });
    await waitFor(() => expect(actions.readTrials).toHaveBeenLastCalledWith(RUN_A, 0, 0, "dose"));

    fireEvent.click(screen.getByRole("button", { name: "Record as category result" }));
    await waitFor(() => expect(actions.record).toHaveBeenCalledWith(1, RUN_A, 0));
    expect(await screen.findByText("Run 01 is recorded as the category result.")).toBeInTheDocument();
  });

  it("names every engine build that served a run", async () => {
    const mixed = runOf({ engineVersion: `${ENGINE}, sha256:${"ab".repeat(32)}` });
    await show(actionsOf([mixed]));
    expect(await screen.findByText(startsWith("Case 01 · RC-1 · 425 m at 1.5 m height · 2 jobs · started by analyst"))).toHaveTextContent("OpenRC 0123456789ab, abababababab");
  });

  it("shows a newly started run in place of the run that was picked before", async () => {
    const runs: RcConsequenceRun[] = [runOf({ id: RUN_B, label: "Run 02" }), runOf()];
    const actions = actionsOf(runs);
    actions.start.mockImplementation(async () => {
      const started = runOf({ id: RUN_C, label: "Run 03", status: "QUEUED", startedAt: null, completedAt: null, engineVersion: null, progress: { completed: 0, total: 2, queuedJobs: null, workers: null } });
      runs.unshift(started);
      return started;
    });
    await show(actions);
    fireEvent.click(within(await screen.findByRole("table", { name: "OpenRC runs" })).getByRole("button", { name: "Run 01" }));
    expect(await screen.findByRole("heading", { name: "Run 01 · 30-day dose at the EAB" })).toBeInTheDocument();
    await screen.findByRole("option", { name: "30-day dose at the EAB" });
    fireEvent.click(screen.getByRole("button", { name: "Run OpenRC" }));
    expect(await screen.findByRole("heading", { name: "Run 03 · 30-day dose at the EAB" })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "OpenRC runs" })).getByRole("button", { name: "Run 03" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("table", { name: "OpenRC runs" })).getByRole("button", { name: "Run 01" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks a run that is already the category result", async () => {
    const recorded = { id: "00000000-0000-4000-8000-000000000009", snapshotId: SNAPSHOT_ID, categoryId: "RC-1", metricId: "RCM-01", unit: "Sv", version: "OpenRC 0123456789ab", reference: "Run 01", confirmed: true,
      statistics: statisticsOf(1), file, recordedBy: "analyst", valueSource: "calculated",
      calculation: { engine: "OPENRC", engineVersion: ENGINE, runId: RUN_A, runLabel: "Run 01", distanceMetres: 425, heightMetres: 1.5, trialCount: 24 } };
    const actions = actionsOf([runOf()]);
    await show(actions, { records: recordsOf([recorded]) });
    const list = await screen.findByRole("table", { name: "OpenRC runs" });
    expect(cells(list)[0][5]).toBe("Finished, recorded");
    expect(await screen.findByRole("button", { name: "Recorded as category result" })).toBeDisabled();
  });

  it("shows one weather trial as a point, with its nuclides and the nuclides without dose coefficients", async () => {
    const single = runOf({ trialCount: 1 });
    const actions = actionsOf([single]);
    actions.read.mockResolvedValue({
      run: single,
      result: {
        missingDoseCoefficients: ["Nb-97m"],
        distances: [{
          distanceMetres: 425,
          statistics: { mean: 0.02, percentiles: [{ percentile: 5, value: 0.02 }, { percentile: 50, value: 0.02 }, { percentile: 95, value: 0.02 }], exceedances: [{ threshold: 0.001, probability: 1 }] },
          minimumSv: 0.02,
          maximumSv: 0.02,
          groundDepositionBqPerSquareMetre: 123456,
          nuclideDoses: [{ nuclide: "I-131", doseSv: 0.015 }, { nuclide: "Cs-137", doseSv: 0.005 }],
        }],
      },
    });
    actions.readTrials.mockResolvedValue(trialPageOf(1, 0));
    await show(actions);
    await screen.findByLabelText("Run statistics");
    expect(valueOf("Mean")).toBe("0.02 Sv");
    expect(valueOf("5th percentile")).toBe("—");
    expect(valueOf("50th percentile")).toBe("0.02 Sv");
    expect(valueOf("95th percentile")).toBe("—");
    expect(valueOf("Ground deposition")).toBe("123500 Bq/m²");
    expect(valueOf("No dose coefficients for")).toBe("Nb-97m");
    expect(screen.queryByText("Lowest and highest dose")).not.toBeInTheDocument();
    expect(cells(screen.getByRole("table", { name: "Dose by nuclide" }))).toEqual([
      ["I-131", "0.015", "75"],
      ["Cs-137", "0.005", "25"],
    ]);
    await screen.findByRole("table", { name: "Dose by weather trial" });
    expect(screen.queryByLabelText("Trial order")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Weather trials pagination" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Nuclides pagination" })).not.toBeInTheDocument();
  });

  it("pages the nuclides of one weather trial ten at a time", async () => {
    const single = runOf({ trialCount: 1 });
    const actions = actionsOf([single]);
    const nuclideDoses = Array.from({ length: 12 }, (_nuclide, index) => ({ nuclide: `N-${String(index + 1)}`, doseSv: 12 - index }));
    actions.read.mockResolvedValue({
      run: single,
      result: {
        distances: [{
          distanceMetres: 425,
          statistics: { mean: 78, percentiles: [{ percentile: 5, value: 78 }, { percentile: 50, value: 78 }, { percentile: 95, value: 78 }], exceedances: [{ threshold: 0.001, probability: 1 }] },
          minimumSv: 78,
          maximumSv: 78,
          nuclideDoses,
        }],
      },
    });
    actions.readTrials.mockResolvedValue(trialPageOf(1, 0));
    await show(actions);
    const table = await screen.findByRole("table", { name: "Dose by nuclide" });
    expect(cells(table).map((row) => row[0])).toEqual(nuclideDoses.slice(0, 10).map((entry) => entry.nuclide));
    const pager = screen.getByRole("navigation", { name: "Nuclides pagination" });
    expect(within(pager).getByText("1 to 10 of 12")).toBeInTheDocument();
    fireEvent.click(within(pager).getByRole("button", { name: "Next" }));
    expect(cells(screen.getByRole("table", { name: "Dose by nuclide" }))).toEqual([
      ["N-11", "2", "2.564"],
      ["N-12", "1", "1.282"],
    ]);
  });

  it("shows a dose by distance, follows the picked distance and records at that distance", async () => {
    const profile = runOf({ metricId: "RCM-02", metricName: "96-hour dose by distance", receptorKind: "DISTANCE_PROFILE", windowSeconds: 345600, statistics: { mean: true, percentiles: [50, 95], exceedanceThresholds: [0.01] }, distancesMetres: [2000, 8046.7], jobCount: 6, notes: [] });
    const actions = actionsOf([profile]);
    actions.read.mockResolvedValue({
      run: profile,
      result: {
        distances: [
          { distanceMetres: 2000, statistics: { mean: 0.5, percentiles: [{ percentile: 50, value: 0.4 }, { percentile: 95, value: 0.9 }], exceedances: [{ threshold: 0.01, probability: 1 }] }, minimumSv: 0.1, maximumSv: 1 },
          { distanceMetres: 8046.7, statistics: { mean: 0.02, percentiles: [{ percentile: 50, value: 0.015 }, { percentile: 95, value: 0.04 }], exceedances: [{ threshold: 0.01, probability: 0.75 }] }, minimumSv: 0.004, maximumSv: 0.05 },
        ],
      },
    });
    await show(actions);
    const table = await screen.findByRole("table", { name: "Dose by distance" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Distance", "Mean (Sv)", "50th percentile (Sv)", "95th percentile (Sv)", "Chance of exceeding 0.01 Sv"]);
    expect(cells(table)).toEqual([
      ["2000 m", "0.5", "0.4", "0.9", "1"],
      ["8046.7 m", "0.02", "0.015", "0.04", "0.75"],
    ]);
    expect(valueOf("Receptor distance")).toBe("2000 m");
    expect(valueOf("Exposure window")).toBe("96 hours");
    expect(valueOf("Chance of exceeding 0.01 Sv (1 rem)")).toBe("1");
    expect(screen.getByRole("button", { name: "Record as category result at 2000 m" })).toBeEnabled();
    await waitFor(() => expect(actions.readTrials).toHaveBeenCalledWith(RUN_A, 0, 0, "trial"));

    fireEvent.change(screen.getByLabelText("Receptor distance of the run"), { target: { value: "1" } });
    await waitFor(() => expect(actions.readTrials).toHaveBeenLastCalledWith(RUN_A, 1, 0, "trial"));
    expect(valueOf("Receptor distance")).toBe("8046.7 m");
    expect(valueOf("Mean")).toBe("0.02 Sv");
    expect(valueOf("Chance of exceeding 0.01 Sv (1 rem)")).toBe("0.75");
    fireEvent.click(screen.getByRole("button", { name: "Record as category result at 8046.7 m" }));
    await waitFor(() => expect(actions.record).toHaveBeenCalledWith(1, RUN_A, 1));
    expect(screen.queryByRole("navigation", { name: "Dose by distance pagination" })).not.toBeInTheDocument();
  });

  it("pages a dose by distance ten distances at a time", async () => {
    const distancesMetres = Array.from({ length: 12 }, (_distance, index) => 1000 * (index + 1));
    const profile = runOf({ metricId: "RCM-02", metricName: "96-hour dose by distance", receptorKind: "DISTANCE_PROFILE", windowSeconds: 345600, statistics: { mean: true, percentiles: [50, 95], exceedanceThresholds: [0.01] }, distancesMetres, jobCount: 24, notes: [] });
    const actions = actionsOf([profile]);
    actions.read.mockResolvedValue({
      run: profile,
      result: {
        distances: distancesMetres.map((distanceMetres, index) => ({
          distanceMetres,
          statistics: { mean: 12 - index, percentiles: [{ percentile: 50, value: 11 - index }, { percentile: 95, value: 13 - index }], exceedances: [{ threshold: 0.01, probability: 1 }] },
          minimumSv: 1,
          maximumSv: 20,
        })),
      },
    });
    await show(actions);
    const table = await screen.findByRole("table", { name: "Dose by distance" });
    expect(cells(table).map((row) => row[0])).toEqual(distancesMetres.slice(0, 10).map((distance) => `${String(distance)} m`));
    const pager = screen.getByRole("navigation", { name: "Dose by distance pagination" });
    expect(within(pager).getByText("1 to 10 of 12")).toBeInTheDocument();
    expect(within(pager).getByText("Page 1 of 2")).toBeInTheDocument();
    fireEvent.click(within(pager).getByRole("button", { name: "Next" }));
    expect(cells(screen.getByRole("table", { name: "Dose by distance" }))).toEqual([
      ["11000 m", "2", "1", "3", "1"],
      ["12000 m", "1", "0", "2", "1"],
    ]);
    expect(within(screen.getByRole("navigation", { name: "Dose by distance pagination" })).getByText("11 to 12 of 12")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Dose by distance pagination" })).getByRole("button", { name: "First" }));
    expect(cells(screen.getByRole("table", { name: "Dose by distance" })).map((row) => row[0])).toEqual(distancesMetres.slice(0, 10).map((distance) => `${String(distance)} m`));
    expect(within(screen.getByLabelText("Receptor distance of the run")).getAllByRole("option")).toHaveLength(12);
  });

  it("shows a dose by distance of one weather trial as points", async () => {
    const profile = runOf({ metricId: "RCM-02", metricName: "96-hour dose by distance", receptorKind: "DISTANCE_PROFILE", windowSeconds: 345600, statistics: { mean: true, percentiles: [50, 95], exceedanceThresholds: [0.01] }, distancesMetres: [2000, 8046.7], trialCount: 1, notes: [] });
    const actions = actionsOf([profile]);
    actions.read.mockResolvedValue({
      run: profile,
      result: {
        distances: [
          { distanceMetres: 2000, statistics: { mean: 0.5, percentiles: [{ percentile: 50, value: 0.5 }, { percentile: 95, value: 0.5 }], exceedances: [{ threshold: 0.01, probability: 1 }] }, minimumSv: 0.5, maximumSv: 0.5 },
          { distanceMetres: 8046.7, statistics: { mean: 0.002, percentiles: [{ percentile: 50, value: 0.002 }, { percentile: 95, value: 0.002 }], exceedances: [{ threshold: 0.01, probability: 0 }] }, minimumSv: 0.002, maximumSv: 0.002 },
        ],
      },
    });
    actions.readTrials.mockResolvedValue(trialPageOf(1, 0));
    await show(actions);
    expect(cells(await screen.findByRole("table", { name: "Dose by distance" }))).toEqual([
      ["2000 m", "0.5", "0.5", "—", "1"],
      ["8046.7 m", "0.002", "0.002", "—", "0"],
    ]);
    expect(valueOf("50th percentile")).toBe("0.5 Sv");
    expect(valueOf("95th percentile")).toBe("—");
  });

  it("reports a running job on the status button and cancels it after a confirmation", async () => {
    const running = runOf({ id: RUN_B, label: "Run 02", metricId: "RCM-02", metricName: "96-hour dose by distance", status: "RUNNING", completedAt: null, engineVersion: null, jobCount: 3, progress: { completed: 1, total: 3, queuedJobs: 0, workers: 2 } });
    const actions = actionsOf([running, runOf()]);
    await show(actions);
    const button = await screen.findByRole("button", { name: "1 running" });
    expect(screen.getByText("Running · 1 of 3 jobs done · 2 workers")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: recordName })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View engine output" })).not.toBeInTheDocument();
    fireEvent.click(button);
    const panel = screen.getByRole("dialog", { name: "Running jobs" });
    expect(within(panel).getByText("Run 02 · RC-1 · 96-hour dose by distance")).toBeInTheDocument();
    expect(within(panel).getByText(startsWith("Running · 1 of 3 jobs done · 2 workers · "))).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel Run 02" }));
    expect(actions.cancel).not.toHaveBeenCalled();
    const confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByText("Stop this run?")).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole("button", { name: "Stop run" }));
    await waitFor(() => expect(actions.cancel).toHaveBeenCalledWith(RUN_B));

    fireEvent.click(screen.getByRole("button", { name: "Cancel run" }));
    await waitFor(() => expect(actions.cancel).toHaveBeenCalledTimes(2));
  });

  it("says when no PRAETOR worker is connected and counts queued jobs on the status button", async () => {
    const waiting = runOf({ id: RUN_B, label: "Run 02", status: "QUEUED", startedAt: null, completedAt: null, engineVersion: null, progress: { completed: 0, total: 2, queuedJobs: 2, workers: 0 } });
    const queued = runOf({ id: RUN_C, label: "Run 03", categoryId: "RC-2", snapshotId: OTHER_SNAPSHOT_ID, status: "QUEUED", startedAt: null, completedAt: null, engineVersion: null, progress: { completed: 0, total: 1, queuedJobs: 3, workers: 1 } });
    await show(actionsOf([queued, waiting]));
    expect(await screen.findByRole("button", { name: "2 queued" })).toBeEnabled();
    expect(screen.getByText("Waiting. No PRAETOR worker is connected, so nothing can run until one starts.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2 queued" }));
    await settle();
    expect(within(screen.getByRole("dialog", { name: "Running jobs" })).getByText(startsWith("Waiting for a PRAETOR worker · 3 jobs in the queue · 1 worker · "))).toBeInTheDocument();
  });

  it("shows why a run failed, pages its engine input and removes it", async () => {
    const failed = runOf({ status: "FAILED", engineVersion: null, failure: { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "[meteorology] wind_speed_m_s must be > 0" } });
    const actions = actionsOf([failed]);
    await show(actions);
    expect(await screen.findByText("[meteorology] wind_speed_m_s must be > 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No jobs running" })).toBeDisabled();
    expect(actions.read).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Run statistics")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: recordName })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View engine output" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View engine input" }));
    const input = await screen.findByLabelText("Engine input");
    expect(actions.readFile).toHaveBeenCalledWith(RUN_A, "input", 0);
    expect(input).toHaveTextContent("input line 1");
    const pager = screen.getByRole("navigation", { name: "Engine input pagination" });
    expect(within(pager).getByText("1 to 20 of 45")).toBeInTheDocument();
    fireEvent.click(within(pager).getByRole("button", { name: "Next" }));
    await waitFor(() => expect(actions.readFile).toHaveBeenLastCalledWith(RUN_A, "input", 20));
    await waitFor(() => expect(screen.getByLabelText("Engine input")).toHaveTextContent("input line 21"));
    fireEvent.click(screen.getByRole("button", { name: "Hide engine input" }));
    expect(screen.queryByLabelText("Engine input")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove run" }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith(RUN_A));
  });

  it("pages the runs ten at a time and goes back to the last page with runs when the list gets shorter", async () => {
    const runs = Array.from({ length: 11 }, (_run, index) =>
      runOf({
        id: `20000000-0000-4000-8000-0000000000${String(index + 10)}`,
        label: `Run ${String(11 - index).padStart(2, "0")}`,
        status: "FAILED",
        engineVersion: null,
        failure: { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "[meteorology] wind_speed_m_s must be > 0" },
      }),
    );
    const actions = actionsOf(runs);
    await show(actions);
    const list = await screen.findByRole("table", { name: "OpenRC runs" });
    expect(cells(list).map((row) => row[0])).toEqual(runs.slice(0, 10).map((run) => run.label));
    const pager = screen.getByRole("navigation", { name: "OpenRC runs pagination" });
    expect(within(pager).getByText("1 to 10 of 11")).toBeInTheDocument();
    fireEvent.click(within(pager).getByRole("button", { name: "Last" }));
    expect(cells(screen.getByRole("table", { name: "OpenRC runs" })).map((row) => row[0])).toEqual(["Run 01"]);
    fireEvent.click(screen.getByRole("button", { name: "Run 01" }));
    actions.list.mockResolvedValue(runs.slice(0, 10));
    fireEvent.click(screen.getByRole("button", { name: "Remove run" }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith(runs[10].id));
    await waitFor(() => expect(cells(screen.getByRole("table", { name: "OpenRC runs" })).map((row) => row[0])).toEqual(runs.slice(0, 10).map((run) => run.label)));
    expect(screen.queryByRole("navigation", { name: "OpenRC runs pagination" })).not.toBeInTheDocument();
  });

  it("shows the engine output of a finished run and the message of a refused start", async () => {
    const actions = actionsOf([runOf()]);
    actions.start.mockRejectedValue(new Error("Release category 'RC-1' has no saved deposition velocities and decay mode"));
    await show(actions);
    fireEvent.click(await screen.findByRole("button", { name: "View engine output" }));
    expect(await screen.findByLabelText("Engine output")).toHaveTextContent("output line 1");
    expect(actions.readFile).toHaveBeenCalledWith(RUN_A, "output", 0);
    await screen.findByRole("option", { name: "30-day dose at the EAB" });
    fireEvent.click(screen.getByRole("button", { name: "Run OpenRC" }));
    expect(await screen.findByText("Release category 'RC-1' has no saved deposition velocities and decay mode")).toBeInTheDocument();
  });

  it("lets a reader see runs without the controls that change them", async () => {
    const running = runOf({ id: RUN_B, label: "Run 02", status: "RUNNING", completedAt: null, engineVersion: null, progress: { completed: 0, total: 2, queuedJobs: 0, workers: 1 } });
    await show(actionsOf([running, runOf()]), { editable: false });
    await screen.findByRole("table", { name: "OpenRC runs" });
    expect(screen.queryByRole("button", { name: "Run OpenRC" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel run" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1 running" }));
    expect(within(screen.getByRole("dialog", { name: "Running jobs" })).queryByRole("button")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("table", { name: "OpenRC runs" })).getByRole("button", { name: "Run 01" }));
    await screen.findByLabelText("Run statistics");
    expect(screen.queryByRole("button", { name: recordName })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove run" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View engine output" })).toBeInTheDocument();
  });

  it("asks for the runs again every two seconds while one is active and slows down when none is", async () => {
    jest.useFakeTimers();
    try {
      const runs = [runOf({ status: "RUNNING", completedAt: null, engineVersion: null, progress: { completed: 0, total: 2, queuedJobs: 0, workers: 1 } })];
      const actions = actionsOf(runs);
      mount(actions);
      await flush();
      await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(1));
      await act(async () => { jest.advanceTimersByTime(1900); });
      await flush();
      expect(actions.list).toHaveBeenCalledTimes(1);
      await act(async () => { jest.advanceTimersByTime(200); });
      await flush();
      await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(2));
      runs[0] = runOf();
      await act(async () => { jest.advanceTimersByTime(2000); });
      await flush();
      await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(3));
      await act(async () => { jest.advanceTimersByTime(14000); });
      await flush();
      expect(actions.list).toHaveBeenCalledTimes(3);
      await act(async () => { jest.advanceTimersByTime(1100); });
      await flush();
      await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(4));
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Step 08 panel with OpenRC", () => {
  afterEach(settle);

  const caseActions = (): RcCaseActions => ({
    saveSnapshot: jest.fn(),
    saveResult: jest.fn(async () => recordsOf()),
    removeResult: jest.fn(async () => recordsOf()),
    readTable: jest.fn(async () => ({ columns: ["Name"], rows: [], total: 0, offset: 0, units: "" })),
    readReview: jest.fn(async () => ({ schemaVersion: 3 as const, files: [], embedded: [], excludedSteps: [], checks: [] })),
    readText: jest.fn(async () => ({ text: "", offset: 0, total: 0 })),
    readOutput: jest.fn(async () => ({ text: "", offset: 0, total: 0 })),
  });

  it("has an OpenRC runs tab between the prepared inputs and the results, and the job status on the card", async () => {
    const actions = actionsOf([runOf()]);
    render(
      <RcWorkbookProvider data={workbook(recordsOf())} editable mutateRc={jest.fn()} caseRecords={caseActions()} consequenceRuns={actions}>
        <RcQuantificationPanel />
      </RcWorkbookProvider>,
    );
    await settle();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Case & checks", "Prepared inputs", "OpenRC runs", "Results"]);
    expect(await screen.findByRole("button", { name: "No jobs running" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "OpenRC runs" }));
    expect(screen.getByRole("form", { name: "OpenRC run" })).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "OpenRC runs" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Case release category"), { target: { value: "RC-2" } });
    await waitFor(() => expect(screen.queryByRole("table", { name: "OpenRC runs" })).not.toBeInTheDocument());
    expect(within(screen.getByLabelText("Run input snapshot")).getAllByRole("option").map((option) => option.textContent)).toEqual(["Case 02 · 2 metrics · 2 review items"]);
  });

  it("lists a calculated result with its run, receptor and dose by distance", async () => {
    const calculated = { id: "00000000-0000-4000-8000-000000000009", snapshotId: SNAPSHOT_ID, categoryId: "RC-1", metricId: "RCM-02", unit: "Sv", version: "OpenRC 0123456789ab", reference: "Run 01", confirmed: true,
      statistics: { mean: 0.02, percentiles: [{ percentile: 50, value: 0.015 }, { percentile: 95, value: 0.04 }], exceedances: [{ threshold: 0.01, probability: 0.75 }] },
      file: { ...file, documentId: "00000000-0000-4000-8000-000000000008", filename: "OpenRC-Run-01-output.txt" }, recordedBy: "analyst", valueSource: "calculated",
      calculation: { engine: "OPENRC", engineVersion: ENGINE, runId: RUN_A, runLabel: "Run 01", distanceMetres: 8046.7, heightMetres: 0, trialCount: 24 },
      profile: [
        { distanceMetres: 2000, statistics: { mean: 0.5, percentiles: [{ percentile: 50, value: 0.4 }, { percentile: 95, value: 0.9 }], exceedances: [{ threshold: 0.01, probability: 1 }] } },
        { distanceMetres: 8046.7, statistics: { mean: 0.02, percentiles: [{ percentile: 50, value: 0.015 }, { percentile: 95, value: 0.04 }], exceedances: [{ threshold: 0.01, probability: 0.75 }] } },
      ] };
    render(
      <RcWorkbookProvider data={workbook(recordsOf([calculated]))} editable mutateRc={jest.fn()} caseRecords={caseActions()} consequenceRuns={actionsOf([])}>
        <RcQuantificationPanel />
      </RcWorkbookProvider>,
    );
    await settle();
    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    expect(screen.getByText("RC-1 · 96-hour dose by distance")).toBeInTheDocument();
    expect(screen.getByText("Case 01 · OpenRC Run 01, receptor at 8046.7 m, 24 weather trials")).toBeInTheDocument();
    expect(screen.getByText("OpenRC-Run-01-output.txt · OpenRC 0123456789ab")).toBeInTheDocument();
    expect(cells(screen.getByRole("table", { name: "Dose by distance of Run 01", hidden: true }))).toEqual([
      ["2000", "Mean 0.5 Sv · 50th percentile 0.4 Sv · 95th percentile 0.9 Sv · Chance of exceeding 0.01 Sv: 1"],
      ["8046.7", "Mean 0.02 Sv · 50th percentile 0.015 Sv · 95th percentile 0.04 Sv · Chance of exceeding 0.01 Sv: 0.75"],
    ]);
    expect(screen.queryByRole("navigation", { name: "Dose by distance of Run 01 pagination", hidden: true })).not.toBeInTheDocument();
  });

  it("pages the dose by distance of a calculated result ten distances at a time", async () => {
    const distancesMetres = Array.from({ length: 12 }, (_distance, index) => 1000 * (index + 1));
    const calculated = { id: "00000000-0000-4000-8000-000000000009", snapshotId: SNAPSHOT_ID, categoryId: "RC-1", metricId: "RCM-02", unit: "Sv", version: "OpenRC 0123456789ab", reference: "Run 01", confirmed: true,
      statistics: { mean: 3, percentiles: [{ percentile: 50, value: 2 }, { percentile: 95, value: 4 }], exceedances: [{ threshold: 0.01, probability: 1 }] },
      file: { ...file, documentId: "00000000-0000-4000-8000-000000000008", filename: "OpenRC-Run-01-output.txt" }, recordedBy: "analyst", valueSource: "calculated",
      calculation: { engine: "OPENRC", engineVersion: ENGINE, runId: RUN_A, runLabel: "Run 01", distanceMetres: 10000, heightMetres: 0, trialCount: 1 },
      profile: distancesMetres.map((distanceMetres, index) => ({
        distanceMetres,
        statistics: { mean: 12 - index, percentiles: [{ percentile: 50, value: 12 - index }, { percentile: 95, value: 12 - index }], exceedances: [{ threshold: 0.01, probability: 1 }] },
      })) };
    render(
      <RcWorkbookProvider data={workbook(recordsOf([calculated]))} editable mutateRc={jest.fn()} caseRecords={caseActions()} consequenceRuns={actionsOf([])}>
        <RcQuantificationPanel />
      </RcWorkbookProvider>,
    );
    await settle();
    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    const name = "Dose by distance of Run 01";
    expect(cells(screen.getByRole("table", { name, hidden: true })).map((row) => row[0])).toEqual(distancesMetres.slice(0, 10).map(String));
    const pager = screen.getByRole("navigation", { name: `${name} pagination`, hidden: true });
    expect(within(pager).getByText("1 to 10 of 12")).toBeInTheDocument();
    fireEvent.click(within(pager).getByRole("button", { name: "Last", hidden: true }));
    expect(cells(screen.getByRole("table", { name, hidden: true }))).toEqual([
      ["11000", "Mean 2 Sv · 50th percentile 2 Sv · 95th percentile — · Chance of exceeding 0.01 Sv: 1"],
      ["12000", "Mean 1 Sv · 50th percentile 1 Sv · 95th percentile — · Chance of exceeding 0.01 Sv: 1"],
    ]);
    fireEvent.click(within(screen.getByRole("navigation", { name: `${name} pagination`, hidden: true })).getByRole("button", { name: "Previous", hidden: true }));
    expect(cells(screen.getByRole("table", { name, hidden: true })).map((row) => row[0])).toEqual(distancesMetres.slice(0, 10).map(String));
  });
});
