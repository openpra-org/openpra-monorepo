import { EuiPageTemplate, logicalStyle, useEuiPaddingCSS, useEuiTheme } from "@elastic/eui";
import { NewItemButton } from "../buttons/newItemButton";

interface PageTitleHeaderProps {
    title: string;
    icon: string;
}

export default function ListlessPageTitleHeader({title, icon}: PageTitleHeaderProps){
    //const horizontalPadding = useEuiPaddingCSS("horizontal");
    //const verticalPadding = useEuiPaddingCSS("vertical");
    //const headerCss = [horizontalPadding["xl"]];
    //const titleCss = [verticalPadding["none"]];
    const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.xl;
    
    return (
        <EuiPageTemplate.Header
          // style={{paddingBottom: "-12px"}}
          alignItems="center"
          // paddingSize="none"
          // css={headerCss}
          // pageTitleProps={{
          //   css: {headerCss}
          // }}
          pageTitle={title}
          pageTitleProps={{
            //css: titleCss,
          }}
          iconProps={{
            size: "l",
            color: "accent"
          }}
          responsive={false}
          bottomBorder={true}
          iconType={icon}
          restrictWidth={largeScreenBreakpoint}
        />
    );
}