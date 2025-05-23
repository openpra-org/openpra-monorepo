import { EuiPageHeaderProps, EuiPageTemplate, useEuiTheme } from "@elastic/eui";

/**
 *
 * @param pageTitle - optional title for the page
 * @param iconType - optional icon to the left of the title
 * @param restrictWidth - restricts the width if needed
 * @returns
 */
const TemplatedPageHeader = ({ pageTitle, iconType, restrictWidth, ...rest }: EuiPageHeaderProps): JSX.Element => {
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
      bottomBorder
      iconType={iconType}
      restrictWidth={restrictedWidth}
    />
  );
};
export { TemplatedPageHeader };
