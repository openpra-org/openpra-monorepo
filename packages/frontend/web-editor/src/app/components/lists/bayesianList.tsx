import GenericListItem from "./GenericListItem";
import GenericItemList from "./GenericItemList";
import { CreateBayesianNetworkButton } from "../buttons/CreateItemButton";
import TemplatedPageBody from "../headers/TemplatedPageBody";

const getFixtures = (count = 100): JSX.Element[] => {
  {/** grabs the models/id part, then appends the new part to get the total overall path */}
  return Array.from(Array(count).keys()).map((e, i) => {
    return (<GenericListItem
    id={i}
    key={i}
    label={{
      name: `Bayesian #${i}`,
      description: `This is Bayesian number ${i}`,
    }}
    path={window.location.pathname + `/${i}`}
  />)});
}

export default function BayesianNetworkList(){
  return(
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Bayesian Networks",
        iconType: "tokenPercolator",
        rightSideItems: [<CreateBayesianNetworkButton />]
      }}>
      <GenericItemList>
        {getFixtures()}
      </GenericItemList>
    </TemplatedPageBody>
  );
}
