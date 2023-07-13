import { EuiPageBody, EuiPageTemplate, useEuiTheme } from "@elastic/eui";
import GenericListItem from "./GenericListItem";
import GenericItemList from "./GenericItemList";
import TemplatedPageHeader from "../headers/TemplatedPageHeader";
import { CreateBayesianNetworkButton, CreateESDButton } from "../buttons/CreateItemButton";
import TemplatedPageBody from "../headers/TemplatedPageBody";

const getFixtures = (count = 100): JSX.Element[] => {
  {/** grabs the models/id part, then appends the new part to get the total overall path */}
  return Array.from(Array(count).keys()).map((e, i) => {
    return (<GenericListItem
    id={i}
    key={i}
    label={{
      name: `Event Sequence #${i}`,
      description: `This is event sequence number ${i}`,
    }}
    path={window.location.pathname + `/${i}`}
  />)});
}

export default function ESDList(){
    return(
      <TemplatedPageBody
        headerProps={{
          pageTitle: "Event Sequence Diagrams",
          iconType: "tokenEnumMember",
          rightSideItems: [<CreateESDButton />]
        }}>
        <GenericItemList>
          {getFixtures()}
        </GenericItemList>
      </TemplatedPageBody>
  );
}
