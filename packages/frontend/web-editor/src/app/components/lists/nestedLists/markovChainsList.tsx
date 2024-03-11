import {
  DeleteMarkovChain,
  GetMarkovChains,
  PatchMarkovChainLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function MarkovChainsList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetMarkovChains}
      deleteNestedEndpoint={DeleteMarkovChain}
      patchNestedEndpoint={PatchMarkovChainLabel}
      name="markov-chain"
    />
  );
}

export { MarkovChainsList };
