import { patchJson } from "../client";
import { updateWorkbook } from "../../workbooks/workbookApi";
import { resultRecordsToCsv } from "../../newly-developed-methods/shared/resultCsv";
import { exportBayesianNetworkJson, exportCanonicalBayesianNetworkJson, exportBayesianNetworkXdsl, importBayesianNetworkJson, importBayesianNetworkXdsl } from "../../newly-developed-methods/bayesian-network/bayesianNetworkInterchange";

it("preserves negative zero in both browser HTTP clients", async () => {
  const previousFetch = globalThis.fetch;
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
  globalThis.fetch = fetchMock;
  try {
    const body = { operations: [{ op: "replace", path: ["p"], value: -0 }] };
    await patchJson("/api/sy-workbooks/test", body);
    // This transport check stops before validating an unrelated workbook response.
    await expect(updateWorkbook("project", "workbook", body as never)).rejects.toThrow();
    for (const [, init] of fetchMock.mock.calls) {
      expect(Object.is(JSON.parse(init!.body as string).operations[0].value, -0)).toBe(true);
    }
  } finally {
    if (previousFetch) globalThis.fetch = previousFetch;
    else Reflect.deleteProperty(globalThis, "fetch");
  }
});

it("preserves signed CPT zeros in JSON and XDSL round trips", () => {
  const input = '{"variables":[{"name":"N","states":["False","True"],"parents":[],"probabilities":[-0.0,1]}]}';
  const model = importBayesianNetworkJson(input);
  const roundTrips = [
    importBayesianNetworkJson(exportBayesianNetworkJson(model)),
    importBayesianNetworkJson(exportCanonicalBayesianNetworkJson(model)),
    importBayesianNetworkXdsl(exportBayesianNetworkXdsl(model)),
  ];
  for (const result of roundTrips) {
    const canonical = JSON.parse(exportCanonicalBayesianNetworkJson(result));
    expect(Object.is(canonical.variables[0].probabilities[0], -0)).toBe(true);
  }
});

it("exports numeric -0 separately from text labels and positive zero", () => {
  const csv = resultRecordsToCsv([{ negative: -0, positive: 0, label: "-0" }]);
  expect(csv).toContain('"-0","0","\'-0"');
});
