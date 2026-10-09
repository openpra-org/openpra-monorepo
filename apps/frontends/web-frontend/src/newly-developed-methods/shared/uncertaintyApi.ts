import {
  UncertaintyResponseSchema,
  type UncertaintyRequest,
  type UncertaintyResponse,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { postJson } from "../../api/client";

async function evaluateUncertainty(request: UncertaintyRequest): Promise<UncertaintyResponse> {
  return UncertaintyResponseSchema.parse(await postJson<UncertaintyResponse>("/api/uncertainty", request));
}

export { evaluateUncertainty };
