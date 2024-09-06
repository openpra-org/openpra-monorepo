import { EuiHideFor, EuiSplitPanel } from "@elastic/eui";
import React, { ReactElement, ReactNode } from "react";
import {
  _EuiSplitPanelInnerProps,
  _EuiSplitPanelOuterProps,
} from "@elastic/eui/src/components/panel/split_panel/split_panel";
import { EuiHideForBreakpoints } from "@elastic/eui/src/components/responsive/hide_for";

export type HideForBreakpoints = EuiHideForBreakpoints[] | "all" | "none";
export interface HideForProps {
  children: ReactNode;
  sizes?: HideForBreakpoints;
}

export type ResponsiveSplitPanelProps = Omit<_EuiSplitPanelOuterProps, "children"> & {
  contentWrapperProps?: _EuiSplitPanelInnerProps;

  contentLeft?: ReactElement;
  contentLeftWrapperProps?: _EuiSplitPanelInnerProps;
  hideLeftForSizes?: EuiHideForBreakpoints[] | "all" | "none";

  contentRight?: ReactElement;
  contentRightWrapperProps?: _EuiSplitPanelInnerProps;

  footer?: ReactElement;
  footerProps?: _EuiSplitPanelInnerProps;
};

export const HideableContent = (props: HideForProps): ReactElement => {
  const { sizes, children } = props;
  if (!sizes) {
    return <EuiHideFor sizes={"none"}>{children}</EuiHideFor>;
  } else {
    return <EuiHideFor sizes={sizes}>{children}</EuiHideFor>;
  }
};

export const ResponsiveSplitPanel = (props: ResponsiveSplitPanelProps): ReactElement => {
  const {
    contentWrapperProps,
    contentLeft,
    contentLeftWrapperProps,
    contentRightWrapperProps,
    contentRight,
    hideLeftForSizes,
    footerProps,
    footer,
    ...others
  } = props;

  return (
    <EuiSplitPanel.Outer
      grow
      hasBorder={false}
      color="transparent"
      borderRadius="none"
      hasShadow={false}
      {...others}
    >
      <EuiSplitPanel.Inner
        paddingSize="none"
        color="transparent"
      >
        <EuiSplitPanel.Outer
          direction="row"
          hasBorder={false}
          hasShadow={false}
          color="transparent"
          paddingSize="l"
          {...contentWrapperProps}
        >
          {contentLeft && (
            <HideableContent sizes={hideLeftForSizes}>
              <EuiSplitPanel.Inner
                grow
                color="transparent"
                paddingSize="none"
                {...contentLeftWrapperProps}
              >
                {contentLeft}
              </EuiSplitPanel.Inner>
            </HideableContent>
          )}
          {contentRight && (
            <EuiSplitPanel.Inner
              grow={false}
              color="transparent"
              paddingSize="none"
              {...contentRightWrapperProps}
            >
              {contentRight}
            </EuiSplitPanel.Inner>
          )}
        </EuiSplitPanel.Outer>
      </EuiSplitPanel.Inner>
      {footer && (
        <EuiSplitPanel.Inner
          grow={false}
          color="subdued"
          paddingSize="m"
          {...footerProps}
        >
          {footer}
        </EuiSplitPanel.Inner>
      )}
    </EuiSplitPanel.Outer>
  );
};
