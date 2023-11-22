import { useCurrentEuiBreakpoint } from "@elastic/eui";
import { _EuiThemeBreakpoint } from "@elastic/eui/src/global_styling/variables/breakpoint";
export const DEFAULT_BREAKPOINT: _EuiThemeBreakpoint = "xl";
export const useCurrentBreakpoint = (): string => {
  const themeBreakpoint = useCurrentEuiBreakpoint();
  if (!themeBreakpoint) {
    return DEFAULT_BREAKPOINT;
  }
  return themeBreakpoint;
};
