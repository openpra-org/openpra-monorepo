import {
  EuiText,
  EuiHideFor,
  EuiFlexGroup,
  EuiFlexItem,
  useIsWithinBreakpoints,
  useEuiPaddingCSS,
  useEuiTheme,
} from "@elastic/eui";
import { AuthCard } from "../components/cards/authCard";
function LoginPage(): JSX.Element {
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
      alignItems="baseline"
      gutterSize="none"
    >
      <EuiHideFor sizes={smallSizes}>
        <EuiFlexItem css={textCss}>
          <EuiText>
            <h1>Welcome to OpenPRA!</h1>
            <p>
              Welcome to <b>OpenPRA</b>, an open-source framework for advanced Probabilistic Risk Assessment (PRA). Our
              platform integrates cutting-edge PRA methods, solvers, and tools to help you model and analyze the
              dependability of complex systems across various safety-critical domains.
            </p>
          </EuiText>
        </EuiFlexItem>
      </EuiHideFor>
      <EuiFlexItem css={smallScreen ? undefined : containterCss}>
        <AuthCard />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}

export { LoginPage };
