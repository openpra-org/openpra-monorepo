import { EuiPageTemplate, EuiPageHeaderProps, useEuiTheme } from "@elastic/eui";

//page header to be used on items with a list, differentiated by having the New Item button
//they are separate because we could add a boolean or something to toggle it, but might be an issue if setting a prop
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
