import {
  DeleteMechanisticSourceTerm,
  GetMechanisticSourceTerm,
  PatchMechanisticSourceTermLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";

import { NestedModelList } from "./templateList/nestedModelList";

const MechanisticSourceTermList = (): JSX.Element => {
  return (
    <NestedModelList
      getNestedEndpoint={GetMechanisticSourceTerm}
      deleteNestedEndpoint={DeleteMechanisticSourceTerm}
      patchNestedEndpoint={PatchMechanisticSourceTermLabel}
      name="mechanistic-source-term"
    />
  );
};

export { MechanisticSourceTermList };
