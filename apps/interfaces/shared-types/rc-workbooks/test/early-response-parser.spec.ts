import { readFileSync } from "fs";
import { resolve } from "path";
import { parseEarlyResponseRecords } from "../early-response-parser";
import { earlyResponseIssues } from "../early-response";

const fixture = readFileSync(resolve(__dirname, "../../../../backends/web-backend/example-documents/RC-Published-Inputs/MACCS-Noah-response-settings-excerpt.inp"), "utf8");

describe("MACCS response import", () => {
  it("keeps cohort weights distinct from population shares and preserves unmapped cards", () => {
    const model = parseEarlyResponseRecords(fixture);
    expect(model.population).toEqual({ source: "UNSET", weighting: "UNSET" });
    expect(model.cohorts.map(c => [c.name, c.resultWeightFraction])).toEqual([
      ["90th Percentile Evacuation Cohort", 0.8955], ["100th Percentile Evacuation Cohort", 0.0995], ["Non-Evacuating Cohort", 0.005],
    ]);
    expect(model.cohorts[0].evacuation).toMatchObject({ shape: "UNSET", notificationAfterAccidentSeconds: 2700,
      shelterDelaySecondsByBand: [1980], evacuationDelaySecondsByBand: [9000] });
    expect(model.cohorts[0].evacuation.phaseSpeedsMetresPerSecond).toBeUndefined();
    expect(model.unassignedRecords).toContainEqual({ cohortId: "cohort-1", card: "EZESPEED001", value: "1.8" });
    expect(earlyResponseIssues(model).join(" ")).toContain("choose how cohort results are weighted");
  });
  it("does not invent missing bands or accept files without response records", () => {
    const model = parseEarlyResponseRecords("EZDLTSHL002 100\nEZWTFRAC001 .5\n");
    expect(model.cohorts[0].evacuation.shelterDelaySecondsByBand).toBeUndefined();
    expect(model.unassignedRecords).toContainEqual({ cohortId: "cohort-1", card: "EZDLTSHL002", value: "100" });
    expect(() => parseEarlyResponseRecords("EZESPEED001 1.8\n")).toThrow("No supported MACCS response cards");
  });
});
