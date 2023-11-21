import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function MechanisticSourceTermList() {
  return (
    <NestedModelList
      getNestedEndpoint={NestedModelApiManager.getMechanisticSourceTerm}
      deleteNestedEndpoint={NestedModelApiManager.deleteMechanisticSourceTerm}
      patchNestedEndpoint={
        NestedModelApiManager.patchMechanisticSourceTermLabel
      }
      name="mechanistic-source-term"
    />
  );
}
