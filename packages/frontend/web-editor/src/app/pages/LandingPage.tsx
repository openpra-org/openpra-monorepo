import {
  EuiText,
  EuiHideFor,
  EuiFlexGroup,
  EuiFlexItem,
  useIsWithinBreakpoints,
  useEuiPaddingCSS,
  useEuiTheme,
} from "@elastic/eui";
import AuthCard from "../components/cards/authCard";
export default function LoginPage() {
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
    <EuiFlexGroup style={flexGroupStyles} alignItems="center" gutterSize="none">
      <EuiHideFor sizes={smallSizes}>
        <EuiFlexItem css={textCss}>
          <EuiText>
            <h1>Welcome to OpenPRA</h1>
            <p>
              Far out in the uncharted backwaters of the unfashionable end of
              the western spiral arm of the Galaxy lies a small unregarded
              yellow sun. When suddenly some wild JavaScript code appeared!{" "}
              <code>const whoa = &quot;!&quot;</code>
              Far out in the uncharted backwaters of the unfashionable end of
              the western spiral arm of the Galaxy lies a small unregarded
              yellow sun. When suddenly some wild JavaScript code appeared!{" "}
              <code>const whoa = &quot;!&quot;</code>
              Far out in the uncharted backwaters of the unfashionable end of
              the western spiral arm of the Galaxy lies a small unregarded
              yellow sun. When suddenly some wild JavaScript code appeared!{" "}
              <code>const whoa = &quot;!&quot;</code>
            </p>
            <p>
              Far out in the uncharted backwaters of the unfashionable end of
              the western spiral arm of the Galaxy lies a small unregarded
              yellow sun. When suddenly some wild JavaScript code appeared!{" "}
              <code>const whoa = &quot;!&quot;</code>
            </p>
            <p>
              Far out in the uncharted backwaters of the unfashionable end of
              the western spiral arm of the Galaxy lies a small unregarded
              yellow sun. When suddenly some wild JavaScript code appeared!{" "}
              <code>const whoa = &quot;!&quot;</code>
              Far out in the uncharted backwaters of the unfashionable end of
              the western spiral arm of the Galaxy lies a small unregarded
              yellow sun. When suddenly some wild JavaScript code appeared!{" "}
              <code>const whoa = &quot;!&quot;</code>
              Far out in the uncharted backwaters of the unfashionable end of
              the western spiral arm of the Galaxy lies a small unregarded
              yellow sun. When suddenly some wild JavaScript code appeared!{" "}
              <code>const whoa = &quot;!&quot;</code>
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
