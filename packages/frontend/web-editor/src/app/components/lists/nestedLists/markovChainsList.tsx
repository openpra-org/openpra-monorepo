import NestedModelApiManager from "packages/shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function MarkovChainsList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getMarkovChains} 
          deleteNestedEndpoint={NestedModelApiManager.deleteMarkovChain} 
          name='markov-chain'
        />
    );
}
