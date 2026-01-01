import { useCurrentEuiBreakpoint } from "@elastic/eui";
import { _EuiThemeBreakpoint } from "@elastic/eui/src/global_styling/variables/breakpoint";
/** Default EUI breakpoint to fall back to when no breakpoint is resolved. */
export const DEFAULT_BREAKPOINT: _EuiThemeBreakpoint = "xl";
/**
 * React hook wrapper that returns the current Elastic UI breakpoint.
 *
 * @remarks
 * If the underlying theme breakpoint cannot be determined (for example during
 * SSR or very early in the app lifecycle), this will return the
 * {@link DEFAULT_BREAKPOINT} value.
 *
 * @returns The current EUI breakpoint name (e.g. "xs", "s", "m", "l", "xl").
 */
export const UseCurrentBreakpoint = (): string => {
  const themeBreakpoint = useCurrentEuiBreakpoint();
  if (!themeBreakpoint) {
    return DEFAULT_BREAKPOINT;
  }
  return themeBreakpoint;
};
