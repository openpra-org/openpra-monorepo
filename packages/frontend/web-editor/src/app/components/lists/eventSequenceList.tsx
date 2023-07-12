import { EuiPageTemplate, logicalStyle, useEuiPaddingCSS } from "@elastic/eui";
import GenericListItem from "./GenericListItem";
import GenericItemList from "./GenericItemList";
import { NewItemButton } from "../buttons/newItemButton";
import PageTitleHeader from "../headers/listPageTitleHeader";

const getFixtures = (count = 100): JSX.Element[] => {
  {/** grabs the models/id part, then appends the new part to get the total overall path */}
  return Array.from(Array(count).keys()).map((e, i) => {
    return (<GenericListItem
    key={i}
    label={{
      name: `Event Sequence #${i}`,
      description: `This is event sequence number ${i}`,
    }}
    path={window.location.pathname + `/${i}`}
  />)});
}

export default function ModelList(){
  const verticalMargin = logicalStyle("margin-vertical", "0px");

    return(
    <>
      <PageTitleHeader title="Event Sequence Diagram" icon="tokenEnumMember"/>
      <EuiPageTemplate.Section style={verticalMargin}>
        <GenericItemList>
          {getFixtures()}
        </GenericItemList>
      </EuiPageTemplate.Section>
      </>
  );
}
