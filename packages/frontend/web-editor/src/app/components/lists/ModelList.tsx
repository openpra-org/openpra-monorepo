import GenericItemList from "./GenericItemList";
import GenericListItem from "./GenericListItem";
import { EuiButton, EuiPageTemplate, logicalStyle, useEuiPaddingCSS } from "@elastic/eui";
import { Link } from "react-router-dom";

const getFixtures = (count = 100): JSX.Element[] => {
  return Array.from(Array(count).keys()).map((e, i) => {
    return (<GenericListItem
    key={i}
    label={{
      name: `Model #${i}`,
      description: `This is model number ${i}`,
    }}
    path={`/model/${i}`}
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
        pageTitle="Models"
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
          <Link to="/models/new">
            <EuiButton fill>Create</EuiButton>
          </Link>
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
