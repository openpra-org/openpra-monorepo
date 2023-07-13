import GenericListItem from "./GenericListItem";
import GenericItemList from "./GenericItemList";
import { CreateEventTreeButton } from "../buttons/CreateItemButton";
import TemplatedPageBody from "../headers/TemplatedPageBody";

const getFixtures = (count = 100): JSX.Element[] => {
  {/** grabs the models/id part, then appends the new part to get the total overall path */}
  return Array.from(Array(count).keys()).map((e, i) => {
    return (<GenericListItem
    id={i}
    key={i}
    label={{
      name: `Event Tree #${i}`,
      description: `This is event tree number ${i}`,
    }}
    path={window.location.pathname + `/${i}`}
  />)});
}

export default function EventTreeList(){
  return(
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Event Trees",
        iconType: "tokenEnum",
        rightSideItems: [<CreateEventTreeButton />]
      }}>
      <GenericItemList>
        {getFixtures()}
      </GenericItemList>
    </TemplatedPageBody>
  );
}
