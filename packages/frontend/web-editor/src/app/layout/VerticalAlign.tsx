import { EuiFlexGroup, EuiFlexItem, useEuiTheme } from "@elastic/eui";
import React, { ReactElement } from "react";
import { EuiFlexItemProps } from "@elastic/eui/src/components/flex/flex_item";

/**
 * A functional component that renders its children within a vertically centered `EuiFlexItem`.
 * It utilizes the `EuiFlexGroup` to achieve vertical alignment and centers the content for large screen sizes based on
 * the `xl` breakpoint from Elastic UI's theme.
 *
 * @param props - Extends `EuiFlexItemProps` to pass any additional props to the `EuiFlexItem` component.
 * @returns A `ReactElement` that represents a vertically centered flex item.
 */
export const VerticalAlign = (props: EuiFlexItemProps): ReactElement => {
  // Uses the Elastic UI theme hook to access the current theme settings, specifically the large screen breakpoint.
  const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.xl;

  // Defines the styles for the `EuiFlexGroup` to ensure it takes the full viewport height and centers its content.
  const flexGroupStyles = {
    height: "100vh",
    paddingBlockStart: 0,
    margin: "auto",
    maxWidth: largeScreenBreakpoint,
  };

  // Destructures the `children` from props to pass them explicitly to the `EuiFlexItem`, and spreads the rest of the
  // props.
  const { children, ...others } = props;

  return (
    <EuiFlexGroup
      style={flexGroupStyles}
      alignItems="center"
      gutterSize="none"
    >
      <EuiFlexItem
        {...others}
        grow
      >
        {children}
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};
