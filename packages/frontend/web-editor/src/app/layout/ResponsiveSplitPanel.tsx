import { EuiHideFor, EuiSplitPanel } from "@elastic/eui";
import React, { ReactElement, ReactNode } from "react";
import {
  _EuiSplitPanelInnerProps,
  _EuiSplitPanelOuterProps,
} from "@elastic/eui/src/components/panel/split_panel/split_panel";
import { EuiHideForBreakpoints } from "@elastic/eui/src/components/responsive/hide_for";

/**
 * Type definition for breakpoints where content should be hidden.
 */
export type HideForBreakpoints = EuiHideForBreakpoints[] | "all" | "none";

/**
 * Properties for the HideableContent component.
 */
export interface HideForProps {
  /** Child nodes to be rendered within the component. */
  children: ReactNode;
  /** Breakpoints at which the children will be hidden. */
  sizes?: HideForBreakpoints;
}

/**
 * Properties for the ResponsiveSplitPanel component.
 */
export type ResponsiveSplitPanelProps = Omit<_EuiSplitPanelOuterProps, "children"> & {
  /** Properties for the content wrapper panel. */
  contentWrapperProps?: _EuiSplitPanelInnerProps;

  /** Left content element to be rendered. */
  contentLeft?: ReactElement;
  /** Properties for the left content wrapper panel. */
  contentLeftWrapperProps?: _EuiSplitPanelInnerProps;
  /** Breakpoints at which the left content will be hidden. */
  hideLeftForSizes?: EuiHideForBreakpoints[] | "all" | "none";

  /** Right content element to be rendered. */
  contentRight?: ReactElement;
  /** Properties for the right content wrapper panel. */
  contentRightWrapperProps?: _EuiSplitPanelInnerProps;

  /** Footer element to be rendered. */
  footer?: ReactElement;
  /** Properties for the footer panel. */
  footerProps?: _EuiSplitPanelInnerProps;
};

/**
 * Component that conditionally hides its children based on specified breakpoints.
 * @param props - The properties of the component.
 * @returns The component with possibly hidden children.
 */
export const HideableContent = (props: HideForProps): ReactElement => {
  const { sizes, children } = props;
  if (!sizes) {
    return <EuiHideFor sizes={"none"}>{children}</EuiHideFor>;
  } else {
    return <EuiHideFor sizes={sizes}>{children}</EuiHideFor>;
  }
};

/**
 * A responsive panel component that organizes content into left, right, and footer sections with configurable properties.
 * @param props - The properties of the component.
 * @returns The responsive split panel component.
 */
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
