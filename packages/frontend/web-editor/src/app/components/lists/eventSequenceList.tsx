import { EuiPageTemplate, logicalStyle, useEuiPaddingCSS } from "@elastic/eui";
import GenericListItem from "./GenericListItem";
import GenericItemList from "./GenericItemList";
import { NewItemButton } from "../buttons/newItemButton";

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
  const horizontalPadding = useEuiPaddingCSS("horizontal");
  const verticalPadding = useEuiPaddingCSS("vertical");
  const verticalMargin = logicalStyle("margin-vertical", "0px");
  const headerCss = [horizontalPadding["xl"]];
  const titleCss = [verticalPadding["none"]];
  return (
    <>
      <EuiPageTemplate.Header
        // style={{paddingBottom: "-12px"}}
        alignItems="bottom"
        // paddingSize="none"
        // css={headerCss}
        // pageTitleProps={{
        //   css: {headerCss}
        // }}
        pageTitle="Event Sequence Diagrams"
        pageTitleProps={{
          css: titleCss,
        }}
        iconProps={{
          size: "xxl",
          // color: "accent"
        }}
        responsive={false}
        bottomBorder={true}
        iconType="tokenEnumMember"
        rightSideItems={[
          <NewItemButton title="Event Sequence Network" page = ""/>
        ]}
      />
      <EuiPageTemplate.Section style={verticalMargin}>
        <GenericItemList>
          {getFixtures()}
        </GenericItemList>
      </EuiPageTemplate.Section>
      </>
  );
}
