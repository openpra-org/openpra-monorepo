import GenericListItem from "./GenericListItem";
import GenericItemList from "./GenericItemList";
import { CreateInitiatingEventButton } from "../buttons/CreateItemButton";
import TemplatedPageBody from "../headers/TemplatedPageBody";

const getFixtures = (count = 100): JSX.Element[] => {
  {/** grabs the models/id part, then appends the new part to get the total overall path */}
  return Array.from(Array(count).keys()).map((e, i) => {
    return (<GenericListItem
    id={i}
    itemName="initiating event"
    key={i}
    label={{
      name: `Initiating Event #${i}`,
      description: `This is initiating event number ${i}`,
    }}
    path={window.location.pathname + `/${i}`}
    endpoint="/api/initiating-event/:id"
  />)});
}

export default function InitiatingEventsList(){
  return(
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Initiating Events",
        iconType: "tokenInterface",
        rightSideItems: [<CreateInitiatingEventButton />]
      }}>
      <GenericItemList>
        {getFixtures()}
      </GenericItemList>
    </TemplatedPageBody>
  );
}
