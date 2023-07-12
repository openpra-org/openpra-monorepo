import { EuiPageTemplate, logicalStyle, useEuiPaddingCSS } from "@elastic/eui";
import { NewItemButton } from "../buttons/newItemButton";

interface PageTitleHeaderProps {
    title: string;
    icon: string;
}

export default function PageTitleHeader({title, icon}: PageTitleHeaderProps){
    const horizontalPadding = useEuiPaddingCSS("horizontal");
    const verticalPadding = useEuiPaddingCSS("vertical");
    const headerCss = [horizontalPadding["xl"]];
    const titleCss = [verticalPadding["none"]];
    return (
        <EuiPageTemplate.Header
          // style={{paddingBottom: "-12px"}}
          alignItems="bottom"
          // paddingSize="none"
          css={headerCss}
          // pageTitleProps={{
          //   css: {headerCss}
          // }}
          pageTitle={title.concat('s')}
          pageTitleProps={{
            css: titleCss,
          }}
          iconProps={{
            size: "xxl",
            color: "accent"
          }}
          responsive={false}
          bottomBorder={true}
          iconType={icon}
          rightSideItems={[
            <NewItemButton title={title}/>
          ]}
        />
    );
}