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
      name: `Initiating Event #${i}`,
      description: `This is inititating event number ${i}`,
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
        restrictWidth
        // style={{paddingBottom: "-12px"}}
        alignItems="bottom"
        // paddingSize="none"
        css={headerCss}
        // pageTitleProps={{
        //   css: {headerCss}
        // }}
        pageTitle="Initiating Events"
        pageTitleProps={{
          css: titleCss,
        }}
        iconProps={{
          size: "xxl",
          color: "accent"
        }}
        responsive={false}
        bottomBorder={true}
        // iconType="submodule"
        rightSideItems={[
          <NewItemButton title="Initiating Event" page = ""/>
        ]}
      />
    <EuiPageTemplate.Section restrictWidth style={verticalMargin}>
      <GenericItemList>
        {getFixtures()}
      </GenericItemList>
    </EuiPageTemplate.Section>
  </>
  );
}
