import React, { ReactElement } from "react";
import { EuiProvider } from "@elastic/eui";
import { EuiThemeColorMode } from "@elastic/eui";
import { ThemeMods } from "./ThemeMods";
const ThemeSettingsContext = React.createContext<Partial<ThemeContextProps>>({});
type NonEmptyArray<T> = [T, ...T[]];
const LOCALSTORAGE_KEY_THEME_PREFERENCES = "themePreferences";
export enum PreferenceModes {
  AUTO = "auto",
  LIGHT = "light",
  DARK = "dark",
}
const DEFAULT_THEME_KEY = "default";
const DEFAULT_MODE_KEY = PreferenceModes.AUTO;
export interface Theme {
  name: string;
  mode: PreferenceModes;
}
const DEFAULT_THEME_OPTION: Theme = {
  name: DEFAULT_THEME_KEY,
  mode: DEFAULT_MODE_KEY,
};
const DEFAULT_LOCALSTORAGE_PREFERENCES = DEFAULT_THEME_OPTION;
export interface ThemeProviderProps {
  themeOptions: Readonly<NonEmptyArray<Theme>>;
  children?: ReactElement;
}
export interface ThemeContextProps {
  themeOptions: string[];
  changeTheme: (e: Theme) => void;
  getStoredThemePreferences(): Theme;
}
class ThemeProvider extends React.Component<ThemeProviderProps, Theme> {
  static defaultProps: ThemeProviderProps = {
    themeOptions: [DEFAULT_THEME_OPTION],
  };
  private listener?: MediaQueryList = undefined;
  constructor(props: ThemeProviderProps) {
    super(props);
    this.state = this.getThemeToApply();
  }
  private static readonly storeThemePreference = (theme: Readonly<Theme>): Readonly<Theme> => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY_THEME_PREFERENCES, JSON.stringify(theme));
      return theme;
    } catch (_e) {
      return theme;
    }
  };
  private static readonly getThemePreference = (): Theme => {
    try {
      const storedPreferences: string | null = localStorage.getItem(LOCALSTORAGE_KEY_THEME_PREFERENCES);
      if (!storedPreferences) {
        return DEFAULT_LOCALSTORAGE_PREFERENCES;
      }
      return JSON.parse(storedPreferences) as Theme;
    } catch (_e) {
      return DEFAULT_LOCALSTORAGE_PREFERENCES;
    }
  };
  override render(): ReactElement {
    const { children, themeOptions } = this.props;
    const themePreference = ThemeProvider.getThemePreference();
    const colorMode: EuiThemeColorMode = themePreference.mode === PreferenceModes.DARK ? "dark" : "light";
    if (colorMode === "dark") {
      void import("../../assets/css/eui_theme_dark.css");
    } else {
      void import("../../assets/css/eui_theme_light.css");
    }
    return (
      <ThemeSettingsContext.Provider
        value={{
          themeOptions: themeOptions.map((option: Theme) => option.name),
          getStoredThemePreferences: ThemeProvider.getThemePreference,
          changeTheme: this.onRequestChangeTheme,
        }}
      >
        {
          <EuiProvider
            colorMode={colorMode}
            modify={ThemeMods}
          >
            {children}
          </EuiProvider>
        }
      </ThemeSettingsContext.Provider>
    );
  }
  onRequestChangeTheme = (value: Theme): void => {
    ThemeProvider.storeThemePreference(value);
    this.setState(value);
  };
  onMediaPreferenceChange = (ev: MediaQueryListEvent): void => {
    const stateToApply: Theme = {
      ...this.state,
      mode: ev.matches ? PreferenceModes.DARK : PreferenceModes.LIGHT,
    };
    this.onRequestChangeTheme(stateToApply);
  };
  override componentDidMount = (): void => {
    if (!this.listener) {
      this.listener = window.matchMedia("(prefers-color-scheme: dark)");
      this.listener.addEventListener("change", this.onMediaPreferenceChange, false);
    }
  };
  override componentWillUnmount(): void {
    if (this.listener) {
      this.listener.removeEventListener("change", this.onMediaPreferenceChange);
      this.listener = undefined;
    }
  }
  private readonly getCurrentColorMode = (): PreferenceModes.LIGHT | PreferenceModes.DARK => {
    try {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return PreferenceModes.DARK;
      }
    } catch (_e) {}
    return PreferenceModes.LIGHT;
  };
  private getThemeToApply(): Theme {
    const { themeOptions } = this.props;
    const preference: Theme = ThemeProvider.getThemePreference();
    const currentColorMode = this.getCurrentColorMode();
    const themeToApply = themeOptions.find((option: Readonly<Theme>) => option.name === preference.name);
    if (!themeToApply) {
      const defaultTheme = DEFAULT_THEME_OPTION;
      defaultTheme.mode = currentColorMode;
      return defaultTheme;
    }
    if (preference.mode === PreferenceModes.AUTO) {
      themeToApply.mode = currentColorMode;
    }
    return themeToApply;
  }
}
export const ThemeSettingsConsumer = ThemeSettingsContext.Consumer;
export { ThemeProvider };
