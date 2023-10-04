import { EuiPageTemplate, EuiPageHeaderProps, useEuiTheme } from "@elastic/eui";

/**
 * 
 * @param pageTitle optional title for the page
 * @param iconType optional icon to the left of the title
 * @param restrictWidth restricts the width if needed
 * @returns 
 */
export default function TemplatedPageHeader({pageTitle, iconType, restrictWidth, ...rest}: EuiPageHeaderProps){
  const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.xl;
  const restrictedWidth = restrictWidth === undefined ? largeScreenBreakpoint : restrictWidth;
    return (
        <EuiPageTemplate.Header
          {...rest}
          alignItems="center"
          pageTitle={pageTitle}
          iconProps={{
            size: "xxl",
            color: "accent"
          }}
          responsive={false}
          bottomBorder={true}
          iconType={iconType}
          restrictWidth={restrictedWidth}
        />
    );
}
