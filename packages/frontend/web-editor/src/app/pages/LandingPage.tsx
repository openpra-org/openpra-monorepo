import React from "react";
import {
  EuiEmptyPrompt,
  EuiButton,
  useIsWithinBreakpoints,
  EuiTitle,
  EuiLink,
  EuiImage,
  useEuiTheme,
  useEuiPaddingCSS,
  EuiFlexGroup,
  EuiFlexItem,
} from "@elastic/eui";
import illustration from "../../assets/images/logos/logo-bw.png";

const LoginPage = () => {
  const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.xl;
  const textCss = [useEuiPaddingCSS("horizontal").m];
  const containterCss = [useEuiPaddingCSS().m];
  const smallSizes = ["xs", "s"];
  const smallScreen = useIsWithinBreakpoints(smallSizes);
  const flexGroupStyles = {
    height: "100vh",
    paddingBlockStart: 48,
    margin: "auto",
    maxWidth: largeScreenBreakpoint,
  };

  return (
    <EuiFlexGroup
      style={flexGroupStyles}
      alignItems="center"
      gutterSize="none"
    >
      <EuiFlexItem grow>
        <EuiEmptyPrompt
          hasShadow
          icon={
            <EuiImage
              size="fullWidth"
              src={illustration}
              alt=""
            />
          }
          title={<h2>Create your first visualization</h2>}
          layout="horizontal"
          color="plain"
          body={
            <>
              <p>
                There are no visualizations to display. This tool allows you to create a wide range of charts, graphs,
                maps, and other graphics.
              </p>
              <p>The visualizations you create can be easily shared with your peers.</p>
            </>
          }
          actions={
            <EuiButton
              color="primary"
              fill
            >
              Create visualization
            </EuiButton>
          }
          footer={
            <>
              <EuiTitle size="xxs">
                <span>Want to learn more?</span>
              </EuiTitle>{" "}
              <EuiLink
                href="#"
                target="_blank"
              >
                Read the docs
              </EuiLink>
            </>
          }
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};

export { LoginPage };
