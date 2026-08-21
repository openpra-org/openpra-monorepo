import type { MethodEntityId, MethodEntityReference } from "../shared";

interface HclEventBinding {
  id: MethodEntityId;
  faultTreeBasicEvent: MethodEntityReference;
  bayesianNetworkNode: MethodEntityReference;
  trueStateIds: HclTrueStateIds;
}

type HclTrueStateIds = [MethodEntityId, ...MethodEntityId[]];

export type { HclEventBinding, HclTrueStateIds };
