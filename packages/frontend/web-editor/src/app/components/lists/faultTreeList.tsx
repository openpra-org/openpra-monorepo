import GenericListItem from "./GenericListItem";
import GenericItemList from "./GenericItemList";
import { CreateFaultTreeButton } from "../buttons/CreateItemButton";
import TemplatedPageBody from "../headers/TemplatedPageBody";

const getFixtures = (count = 100): JSX.Element[] => {
  {/** grabs the models/id part, then appends the new part to get the total overall path */}
  return Array.from(Array(count).keys()).map((e, i) => {
    return (<GenericListItem
    id={i}
    itemName="fault tree"
    key={i}
    label={{
      name: `Fault Tree #${i}`,
      description: `This is fault tree number ${i}`,
    }}
    path={window.location.pathname + `/${i}`}
    endpoint="/api/fault-tree/:id"
  />)});
}

export default function FaultTreeList(){
  return(
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Fault Trees",
        iconType: "tokenField",
        rightSideItems: [<CreateFaultTreeButton />]
      }}>
      <GenericItemList>
        {getFixtures()}
      </GenericItemList>
    </TemplatedPageBody>
  );
}
