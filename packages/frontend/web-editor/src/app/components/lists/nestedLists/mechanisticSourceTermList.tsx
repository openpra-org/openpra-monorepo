import {
  DeleteMechanisticSourceTerm,
  GetMechanisticSourceTerm,
  PatchMechanisticSourceTermLabel,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function MechanisticSourceTermList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetMechanisticSourceTerm}
      deleteNestedEndpoint={DeleteMechanisticSourceTerm}
      patchNestedEndpoint={PatchMechanisticSourceTermLabel}
      name="mechanistic-source-term"
    />
  );
}

export { MechanisticSourceTermList };
