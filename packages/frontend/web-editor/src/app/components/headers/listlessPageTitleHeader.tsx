import { EuiPageTemplate, useEuiTheme } from "@elastic/eui";

interface PageTitleHeaderProps {
    title: string;
    icon: string;
}

//page header to be used on pages without a list
export default function ListlessPageTitleHeader({title, icon}: PageTitleHeaderProps){
    const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.xl;
    
    return (
        <EuiPageTemplate.Header
          alignItems="center"
          pageTitle={title}
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