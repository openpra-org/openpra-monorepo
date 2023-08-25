import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function MarkovChainsList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getMarkovChains} 
          deleteNestedEndpoint={NestedModelApiManager.deleteMarkovChain} 
          patchNestedEndpoint={NestedModelApiManager.patchMakovChaionLabel} 
          name='markov-chain'
        />
    );
}
