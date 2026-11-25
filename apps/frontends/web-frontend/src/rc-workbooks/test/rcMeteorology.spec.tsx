import { useMemo, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { RcWeatherInputs, RcWeatherModel, RcWeatherPage, RcWeatherRecord, RcWeatherSettings, RcWeatherTrial, RcWeatherTrialPage, RcWeatherTrialSet } from "interfaces-mef-types/rc/weather";
import { createPublishedRcSeed } from "../../../../../backends/web-backend/src/example-workbooks/seeds/rc-published-inputs-seed";
import { RcMeteorologyPanel } from "../rcMeteorology";
import { RcWorkbookProvider, type RcWeatherActions, type RcWorkbookData } from "../rcWorkbookContext";

const trial = (id: string, selectionGroup: string, probability: number, windTowardDegrees: number): RcWeatherTrial => ({ id, source: "file", day: 1, period: 1, selectionGroup, probability,
  windSpeedMetresPerSecond: 2.2, windTowardDegrees, stabilityClass: "E", rainMillimetresPerHour: 0, mixingHeightMetres: 500 });
const manyTrials = (count: number) => Array.from({ length: count }, (_trial, index) => trial(`T${String(index + 1).padStart(2, "0")}`, "W05", 1 / count, 84.375));
const sampled = (trialCount: number): RcWeatherTrialSet => ({ generatedAt: "2026-09-27T00:00:00.000Z", mode: "uniform_bin", trialCount, probabilityTotal: 1, bins: [], windRose: [] });

interface Options { trials?: RcWeatherTrial[]; trialSet?: RcWeatherTrialSet; editable?: boolean; open?: RegExp }

function setup(options: Options = {}) {
  const rc = createPublishedRcSeed(), seeded = rc.meteorologicalData.weatherInputs!;
  const state: { weather: RcWeatherInputs; trials: RcWeatherTrial[] } = { weather: { ...seeded, trialSet: options.trialSet ?? seeded.trialSet }, trials: options.trials ?? [trial("D001P01", "Fixed start", 1, 84.375)] };
  rc.meteorologicalData.weatherInputs = state.weather;
  const records = Array.from({ length: seeded.data?.recordCount ?? 0 }, (_record, index): RcWeatherRecord => ({ day: 1, period: index + 1, windSector: 16, windSpeedMetresPerSecond: 2.2,
    stabilityClass: "E", rainCode: 0, rainMillimetresPerHour: 0, mixingHeightMetres: 140, original: `record ${index + 1}` }));
  const trialPage = (offset: number, limit: number): RcWeatherTrialPage => ({ revision: state.weather.revision, total: state.trials.length, offset, trials: state.trials.slice(offset, offset + limit) });
  const recordPage = (offset: number, limit: number): RcWeatherPage => ({ revision: state.weather.revision, total: records.length, offset, records: records.slice(offset, offset + limit) });
  const readTrials = jest.fn(async (offset: number, limit: number) => trialPage(offset, limit));
  const readRecords = jest.fn(async (offset: number, limit: number) => recordPage(offset, limit));
  const saveSettings = jest.fn(async (revision: number, settings: RcWeatherSettings, model: RcWeatherModel, _confirm: boolean): Promise<RcWeatherInputs> => ({ ...state.weather, revision: revision + 1, settings, model }));
  function Harness() {
    const [data, setData] = useState(() => ({ rc, cc: {}, nms: [] }) as unknown as RcWorkbookData);
    const weather = useMemo(() => ({
      readRecords, readTrials,
      saveSettings: async (revision: number, settings: RcWeatherSettings, model: RcWeatherModel, confirm: boolean) => {
        const next = await saveSettings(revision, settings, model, confirm);
        state.weather = next;
        setData(current => ({ ...current, rc: { ...current.rc, meteorologicalData: { ...current.rc.meteorologicalData, weatherInputs: next } } }));
        return next;
      },
    }) as unknown as RcWeatherActions, []);
    return <RcWorkbookProvider data={data} editable={options.editable ?? false} mutateRc={jest.fn()} weather={weather}><RcMeteorologyPanel /></RcWorkbookProvider>;
  }
  render(<Harness />);
  if (options.open) fireEvent.click(screen.getByRole("tab", { name: options.open }));
  return { state, readTrials, readRecords, saveSettings, trialPage, recordPage };
}

const sections = () => within(screen.getByRole("tabpanel")).getAllByRole("heading").map(heading => heading.textContent);
const firstCells = (name: string) => within(screen.getByRole("table", { name })).getAllByRole("row").slice(1).map(row => within(row).getAllByRole("cell")[0].textContent);

describe("Step 03 weather tabs", () => {
  it("offers three tabs in the order of the work and opens the weather data", async () => {
    setup();
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Weather data 24", "Weather trials 1", "Data quality"]);
    expect(screen.getByRole("tab", { name: /Weather data/ })).toHaveAttribute("aria-selected", "true");
    await screen.findByRole("table", { name: "Weather records" });
  });

  it("moves between the tabs with the arrow, Home and End keys", async () => {
    setup();
    await screen.findByRole("table", { name: "Weather records" });
    const data = screen.getByRole("tab", { name: /Weather data/ });
    data.focus();
    fireEvent.keyDown(data, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Weather trials/ })).toHaveFocus();
    expect(screen.getByRole("tab", { name: /Weather trials/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: /Weather trials/ }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Data quality" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Data quality" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Weather data/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: /Weather data/ }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Data quality" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Data quality" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: /Weather data/ })).toHaveFocus();
    await screen.findByRole("table", { name: "Weather records" });
  });
});

describe("Step 03 weather data", () => {
  it("shows both imported files, the records and the extracted settings in one tab", async () => {
    const { readRecords } = setup();
    await screen.findByRole("table", { name: "Weather records" });
    expect(readRecords).toHaveBeenCalledWith(0, 10);
    expect(firstCells("Weather records")).toEqual(Array.from({ length: 10 }, (_row, index) => `1 / ${index + 1}`));
    expect(screen.getByText("1 to 10 of 24 records")).toBeInTheDocument();
    expect([...document.querySelectorAll(".mw-file")].map(box => [box.querySelector(".mw-small")?.textContent, box.querySelector("strong")?.textContent])).toEqual([
      ["Imported weather data file", "MacMetGen-Noah-published-day.MET"],
      ["Imported generation settings file", "MacMetGen-Noah-published-config.inp"],
    ]);
    expect(sections()).toEqual(["Imported records", "Extracted settings", "Location comparison"]);
    expect(within(screen.getByRole("table", { name: "Extracted weather settings" })).getByText("Wind direction sectors")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Weather and release locations" })).getByText("Weather station")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Generated weather trials" })).not.toBeInTheDocument();
  });

  it("keeps the records on screen while the next page loads", async () => {
    const { readRecords, recordPage } = setup();
    await screen.findByRole("table", { name: "Weather records" });
    let deliver = (): void => undefined;
    readRecords.mockImplementationOnce((offset: number, limit: number) => new Promise<RcWeatherPage>(resolve => { deliver = () => resolve(recordPage(offset, limit)); }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(readRecords).toHaveBeenLastCalledWith(10, 10);
    expect(firstCells("Weather records")[0]).toBe("1 / 1");
    expect(screen.getByText("1 to 10 of 24 records")).toBeInTheDocument();
    expect(screen.queryByText("Loading records…")).not.toBeInTheDocument();
    await act(async () => { deliver(); });
    expect(await screen.findByText("11 to 20 of 24 records")).toBeInTheDocument();
    expect(firstCells("Weather records")[0]).toBe("1 / 11");
    expect(screen.getByText("Record 11 · day 1, period 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inspect weather record 11" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Step 03 weather trials", () => {
  it("keeps the trial selection and the generated trials in one tab", async () => {
    setup({ open: /Weather trials/ });
    expect(await screen.findByRole("table", { name: "Generated weather trials" })).toHaveTextContent("D001P01");
    expect(sections()).toEqual(["Trial selection", "Outer-grid weather", "Generated trials"]);
    expect(screen.getByRole("combobox", { name: "Weather treatment" })).toHaveValue("fixed_start");
    expect(screen.getByRole("spinbutton", { name: "Starting day" })).toHaveValue(1);
    expect(screen.queryByRole("table", { name: "Weather records" })).not.toBeInTheDocument();
    expect(screen.queryByText("Probability total")).not.toBeInTheDocument();
    expect(screen.queryByText("Active groups")).not.toBeInTheDocument();
  });

  it("stacks the selection groups and wind rose under the trials when several groups are sampled", async () => {
    const trialSet: RcWeatherTrialSet = { generatedAt: "2026-09-27T00:00:00.000Z", mode: "uniform_bin", trialCount: 2, probabilityTotal: 1,
      bins: [{ id: "W05", label: "C/D; 2 < u ≤ 3 m/s", population: 15, selected: 1, probability: .625 }, { id: "W11", label: "E; 2 < u ≤ 3 m/s", population: 9, selected: 1, probability: .375 }],
      windRose: [{ sector: 15, towardDegrees: 78.75, probability: .625 }, { sector: 16, towardDegrees: 84.375, probability: .375 }] };
    setup({ trials: [trial("D001P03", "W05", .625, 78.75), trial("D001P20", "W11", .375, 84.375)], trialSet, open: /Weather trials/ });
    await screen.findByRole("table", { name: "Generated weather trials" });
    expect(screen.getByRole("tab", { name: /Weather trials/ })).toHaveTextContent("Weather trials 2");
    expect(sections()).toEqual(["Trial selection", "Outer-grid weather", "Generated trials", "Selection groups", "Wind rose"]);
    expect(within(screen.getByRole("table", { name: "Weather trial selection groups" })).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("S15 · 78.75°")).toBeInTheDocument();
    expect(screen.getByText("37.50%")).toBeInTheDocument();
    expect([...document.querySelectorAll<HTMLElement>(".mw-wind-rose b")].map(bar => bar.style.width)).toEqual(["100%", "60%"]);
  });

  it("pages the generated trials ten at a time and keeps them on screen while the next page loads", async () => {
    const { readTrials, trialPage } = setup({ trials: manyTrials(12), trialSet: sampled(12), open: /Weather trials/ });
    await screen.findByRole("table", { name: "Generated weather trials" });
    expect(readTrials).toHaveBeenCalledWith(0, 10);
    expect(firstCells("Generated weather trials")).toEqual(["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10"]);
    expect(screen.getByText("1 to 10 of 12 trials")).toBeInTheDocument();
    let deliver = (): void => undefined;
    readTrials.mockImplementationOnce((offset: number, limit: number) => new Promise<RcWeatherTrialPage>(resolve => { deliver = () => resolve(trialPage(offset, limit)); }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(readTrials).toHaveBeenLastCalledWith(10, 10);
    expect(firstCells("Generated weather trials")).toHaveLength(10);
    expect(screen.getByText("1 to 10 of 12 trials")).toBeInTheDocument();
    expect(screen.queryByText("Loading trials…")).not.toBeInTheDocument();
    await act(async () => { deliver(); });
    expect(await screen.findByText("11 to 12 of 12 trials")).toBeInTheDocument();
    expect(firstCells("Generated weather trials")).toEqual(["T11", "T12"]);
  });

  it("hides the generated trials while the selection has unsaved edits and brings them back on discard", async () => {
    setup({ editable: true, open: /Weather trials/ });
    await screen.findByRole("table", { name: "Generated weather trials" });
    expect(screen.getByRole("button", { name: "Confirm weather trials" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Weather treatment" }), { target: { value: "stratified" } });
    expect(screen.queryByRole("heading", { name: "Generated trials" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Generated weather trials" })).not.toBeInTheDocument();
    expect(sections()).toEqual(["Trial selection", "Outer-grid weather"]);
    expect(screen.getByRole("spinbutton", { name: "Samples per day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save and generate trials" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Weather trials/ })).toHaveTextContent("Weather trials");
    fireEvent.click(screen.getByRole("button", { name: "Discard edits" }));
    expect(await screen.findByRole("table", { name: "Generated weather trials" })).toHaveTextContent("D001P01");
    expect(screen.getByRole("combobox", { name: "Weather treatment" })).toHaveValue("fixed_start");
  });

  it("saves the selection and lists the new trials under it without leaving the tab", async () => {
    const { state, saveSettings, readTrials } = setup({ editable: true, open: /Weather trials/ });
    await screen.findByRole("table", { name: "Generated weather trials" });
    saveSettings.mockImplementationOnce(async (revision, settings, model) => {
      state.trials = manyTrials(12);
      return { ...state.weather, revision: revision + 1, settings, model, trialSet: { ...sampled(12), mode: model.mode, generatedAt: "2026-11-23T00:00:00.000Z" } };
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Weather treatment" }), { target: { value: "supplied_sequence" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and generate trials" }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1));
    expect(saveSettings.mock.calls[0][2].mode).toBe("supplied_sequence");
    expect(saveSettings.mock.calls[0][3]).toBe(false);
    expect(await screen.findByText("1 to 10 of 12 trials")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Weather trials/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Weather trials/ })).toHaveTextContent("Weather trials 12");
    expect(sections()).toEqual(["Trial selection", "Outer-grid weather", "Generated trials"]);
    expect(firstCells("Generated weather trials")).toHaveLength(10);
    expect(readTrials).toHaveBeenLastCalledWith(0, 10);
    expect(screen.queryByRole("button", { name: "Save and generate trials" })).not.toBeInTheDocument();
  });
});

describe("Step 03 data quality", () => {
  it("lists the quality basis in the last tab", () => {
    setup({ open: /Data quality/ });
    expect(sections()).toEqual(["Source and period", "Measurements", "Quality controls"]);
    expect(screen.getByRole("table", { name: "Source and period" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Quality controls" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Weather records" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Weather treatment" })).not.toBeInTheDocument();
  });
});
