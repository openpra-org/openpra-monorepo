import { EuiFlexGroup, EuiFlexItem, useEuiTheme } from "@elastic/eui";
import React, { ReactElement } from "react";
import { EuiFlexItemProps } from "@elastic/eui/src/components/flex/flex_item";
export const VerticalAlign = (props: EuiFlexItemProps): ReactElement => {
  const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.xl;
  const flexGroupStyles = {
    height: "100vh",
    paddingBlockStart: 0,
    margin: "auto",
    maxWidth: largeScreenBreakpoint,
  };
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
