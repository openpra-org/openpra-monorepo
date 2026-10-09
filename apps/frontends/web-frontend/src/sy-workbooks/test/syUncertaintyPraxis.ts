import type { UncertaintyRequest, UncertaintyResponse } from "interfaces-shared-types/newly-developed-methods/shared";
import { praxisUncertainty } from "../../newly-developed-methods/shared/test/praxisUncertainty";

const requests: UncertaintyRequest[] = [];

function evaluateUncertainty(request: UncertaintyRequest): Promise<UncertaintyResponse> {
  requests.push(request);
  return praxisUncertainty(request);
}

async function settleUncertainty(): Promise<void> {
  for (let round = 0; round < 4; round += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

export { evaluateUncertainty, requests, settleUncertainty };
