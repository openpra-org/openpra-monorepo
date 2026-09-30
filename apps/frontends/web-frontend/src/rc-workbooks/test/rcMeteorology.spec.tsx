import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RcWeatherTrial, RcWeatherTrialSet } from "interfaces-mef-types/rc/weather";
import { createPublishedRcSeed } from "../../../../../backends/web-backend/src/example-workbooks/seeds/rc-published-inputs-seed";
import { RcMeteorologyPanel } from "../rcMeteorology";
import { RcWorkbookProvider, type RcWeatherActions, type RcWorkbookData } from "../rcWorkbookContext";

const trial = (id: string, selectionGroup: string, probability: number, windTowardDegrees: number): RcWeatherTrial => ({ id, source: "file", day: 1, period: 1, selectionGroup, probability,
  windSpeedMetresPerSecond: 2.2, windTowardDegrees, stabilityClass: "E", rainMillimetresPerHour: 0, mixingHeightMetres: 500 });

function setup(trials: RcWeatherTrial[], trialSet?: RcWeatherTrialSet) {
  const rc = createPublishedRcSeed(), saved = rc.meteorologicalData.weatherInputs!;
  rc.meteorologicalData.weatherInputs = { ...saved, trialSet: trialSet ?? saved.trialSet };
  const weather = {
    readRecords: jest.fn(() => new Promise(() => undefined)),
    readTrials: jest.fn(async (offset: number) => ({ revision: saved.revision, total: trials.length, offset, trials: trials.slice(offset, offset + 6) })),
  } as unknown as RcWeatherActions;
  render(<RcWorkbookProvider data={{ rc, cc: {}, nms: [] } as unknown as RcWorkbookData} editable={false} mutateRc={jest.fn()} weather={weather}><RcMeteorologyPanel /></RcWorkbookProvider>);
  fireEvent.click(screen.getByRole("tab", { name: /Generated trials/ }));
}

describe("Step 03 generated trials", () => {
  it("shows only the trial table for one fixed-start trial", async () => {
    setup([trial("D001P01", "Fixed start", 1, 84.375)]);
    expect(await screen.findByRole("table", { name: "Generated weather trials" })).toHaveTextContent("D001P01");
    expect(screen.queryByText("Probability total")).not.toBeInTheDocument();
    expect(screen.queryByText("Active groups")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Selection groups" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Wind rose" })).not.toBeInTheDocument();
  });

  it("stacks the selection groups and wind rose under the trials when several groups are sampled", async () => {
    const trialSet: RcWeatherTrialSet = { generatedAt: "2026-09-27T00:00:00.000Z", mode: "uniform_bin", trialCount: 2, probabilityTotal: 1,
      bins: [{ id: "W05", label: "C/D; 2 < u ≤ 3 m/s", population: 15, selected: 1, probability: .625 }, { id: "W11", label: "E; 2 < u ≤ 3 m/s", population: 9, selected: 1, probability: .375 }],
      windRose: [{ sector: 15, towardDegrees: 78.75, probability: .625 }, { sector: 16, towardDegrees: 84.375, probability: .375 }] };
    setup([trial("D001P03", "W05", .625, 78.75), trial("D001P20", "W11", .375, 84.375)], trialSet);
    await screen.findByRole("table", { name: "Generated weather trials" });
    const headings = screen.getAllByRole("heading").map(heading => heading.textContent);
    expect(headings.indexOf("Weather trials")).toBeLessThan(headings.indexOf("Selection groups"));
    expect(headings.indexOf("Selection groups")).toBeLessThan(headings.indexOf("Wind rose"));
    expect(within(screen.getByRole("table", { name: "Weather trial selection groups" })).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("S15 · 78.75°")).toBeInTheDocument();
    expect(screen.getByText("37.50%")).toBeInTheDocument();
    expect([...document.querySelectorAll<HTMLElement>(".mw-wind-rose b")].map(bar => bar.style.width)).toEqual(["100%", "60%"]);
  });
});
