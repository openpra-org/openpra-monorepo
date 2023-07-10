import {
  EuiButton,
  EuiPageHeader,
  EuiPageHeaderSection,
  EuiTitle,
  EuiPageTemplate,
  useEuiPaddingCSS,
  EuiSpacer, logicalStyle
} from "@elastic/eui";
import ModelList from "../components/lists/ModelList";
import { Link } from "react-router-dom";
import { logicalCSS } from "@elastic/eui/src/global_styling/functions/logicals";
export default function ModelsPage() {
  const horizontalPadding = useEuiPaddingCSS("horizontal");
  const verticalPadding = useEuiPaddingCSS("vertical");
  // const verticalMargin = logicalCSS("margin-vertical", "-32px");
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
            <ModelList/>
          </EuiPageTemplate.Section>
     </>
  )
}
