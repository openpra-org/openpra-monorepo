import { EuiPageTemplate, EuiPageHeaderProps, useEuiTheme } from "@elastic/eui";
function TemplatedPageHeader({ pageTitle, iconType, restrictWidth, ...rest }: EuiPageHeaderProps): JSX.Element {
  const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.xl;
  const restrictedWidth = restrictWidth ?? largeScreenBreakpoint;
  return (
    <EuiPageTemplate.Header
      {...rest}
      alignItems="center"
      pageTitle={pageTitle}
      iconProps={{
        size: "xxl",
        color: "accent",
      }}
      responsive={false}
      bottomBorder={true}
      iconType={iconType}
      restrictWidth={restrictedWidth}
    />
  );
}
export { TemplatedPageHeader };
