import React, { ReactElement } from "react";
import { EuiProvider } from "@elastic/eui";
import { EuiThemeColorMode } from "@elastic/eui";
import { ThemeMods } from "./ThemeMods";

/**
 * Context for providing theme settings.
 */
const ThemeSettingsContext = React.createContext<Partial<ThemeContextProps>>(
  {},
);

/**
 * Type representing a non-empty array where the first element is guaranteed to exist.
 */
type NonEmptyArray<T> = [T, ...T[]];

/**
 * Key used for storing theme preferences in localStorage.
 */
const LOCALSTORAGE_KEY_THEME_PREFERENCES = "themePreferences";

/**
 * Enum representing the possible preference modes for the theme.
 */
export enum PreferenceModes {
  AUTO = "auto",
  LIGHT = "light",
  DARK = "dark",
}

/**
 * Default key for the theme.
 */
const DEFAULT_THEME_KEY = "default";

/**
 * Default mode key for the theme preferences.
 */
const DEFAULT_MODE_KEY = PreferenceModes.AUTO;

/**
 * Interface representing a theme configuration.
 */
export type Theme = {
  name: string;
  mode: PreferenceModes;
};

/**
 * Default theme option used as a fallback.
 */
const DEFAULT_THEME_OPTION: Theme = {
  name: DEFAULT_THEME_KEY,
  mode: DEFAULT_MODE_KEY,
};

/**
 * Default theme preferences to be used when none are stored in localStorage.
 */
const DEFAULT_LOCALSTORAGE_PREFERENCES = DEFAULT_THEME_OPTION;

/**
 * Interface representing the props for the ThemeProvider component.
 */
export type ThemeProviderProps = {
  themeOptions: Readonly<NonEmptyArray<Theme>>;
  children?: ReactElement;
};

/**
 * Interface representing the context props for the ThemeSettingsContext.
 */
export type ThemeContextProps = {
  themeOptions: string[];
  changeTheme: (e: Theme) => void;
  getStoredThemePreferences(): Theme;
};

/**
 * Provides a theme context to its children components.
 */
class ThemeProvider extends React.Component<ThemeProviderProps, Theme> {
  /**
   * The default theme options
   */
  static defaultProps: ThemeProviderProps = {
    themeOptions: [DEFAULT_THEME_OPTION],
  };

  /**
   * The {@link MediaQueryList} event listener that watches for theme
   * changes
   */
  private listener?: MediaQueryList = undefined;

  constructor(props: ThemeProviderProps) {
    super(props);
    this.state = this.getThemeToApply();
  }

  /**
   * Stores the theme preferences in localStorage.
   * @param theme - The theme preferences object to store.
   * @returns The stored theme preferences.
   */
  private static readonly storeThemePreference = (
    theme: Readonly<Theme>,
  ): Readonly<Theme> => {
    try {
      localStorage.setItem(
        LOCALSTORAGE_KEY_THEME_PREFERENCES,
        JSON.stringify(theme),
      );
      return theme;
    } catch (e) {
      return theme;
    }
  };

  /**
   * Retrieves the theme preferences from localStorage.
   * @returns The retrieved theme preferences.
   */
  private static readonly getThemePreference = (): Theme => {
    try {
      const storedPreferences: string | null = localStorage.getItem(
        LOCALSTORAGE_KEY_THEME_PREFERENCES,
      );
      if (!storedPreferences) {
        return DEFAULT_LOCALSTORAGE_PREFERENCES;
      }
      return JSON.parse(storedPreferences) as Theme;
    } catch (e) {
      return DEFAULT_LOCALSTORAGE_PREFERENCES;
    }
  };

  /**
   * Renders the ThemeProvider component.
   * @returns The React element to be rendered.
   */
  override render(): ReactElement {
    const { children, themeOptions } = this.props;
    const themePreference = ThemeProvider.getThemePreference();
    const colorMode: EuiThemeColorMode =
      themePreference.mode === PreferenceModes.DARK ? "dark" : "light";
    if (colorMode === "dark") {
      import("../../assets/css/eui_theme_dark.css");
    } else {
      import("../../assets/css/eui_theme_light.css");
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
          <EuiProvider colorMode={colorMode} modify={ThemeMods}>
            {children}
          </EuiProvider>
        }
      </ThemeSettingsContext.Provider>
    );
  }

  /**
   * Handles requests to change the theme.
   * @param value - The new theme to apply.
   */
  onRequestChangeTheme = (value: Theme): void => {
    ThemeProvider.storeThemePreference(value);
    this.setState(value);
  };

  /**
   * Handles changes in media preference for color scheme.
   * @param ev - The event object containing information about the media query change.
   */
  onMediaPreferenceChange = (ev: MediaQueryListEvent): void => {
    const stateToApply: Theme = {
      ...this.state,
      mode: ev.matches ? PreferenceModes.DARK : PreferenceModes.LIGHT,
    };
    this.onRequestChangeTheme(stateToApply);
  };

  /**
   * Lifecycle method that sets up the media query listener after the component mounts.
   */
  override componentDidMount = (): void => {
    if (!this.listener) {
      this.listener = window.matchMedia("(prefers-color-scheme: dark)");
      this.listener.addEventListener(
        "change",
        this.onMediaPreferenceChange,
        false,
      );
    }
  };

  /**
   * Lifecycle method that cleans up the media query listener before the component unmounts.
   */
  override componentWillUnmount(): void {
    if (this.listener) {
      this.listener.removeEventListener("change", this.onMediaPreferenceChange);
      this.listener = undefined;
    }
  }

  /**
   * Determines the current color mode based on the media query.
   * @returns The current color mode.
   */
  private readonly getCurrentColorMode = ():
    | PreferenceModes.LIGHT
    | PreferenceModes.DARK => {
    try {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return PreferenceModes.DARK;
      }
    } catch (e) {
      // should log this error if needed
    }
    return PreferenceModes.LIGHT;
  };

  /**
   * Determines the theme to apply based on the stored preferences and current color mode.
   * @returns The theme to apply.
   */
  private getThemeToApply(): Theme {
    const { themeOptions } = this.props;
    const preference: Theme = ThemeProvider.getThemePreference();
    const currentColorMode = this.getCurrentColorMode();
    const themeToApply = themeOptions.find(
      (option: Readonly<Theme>) => option.name === preference.name,
    );
    if (!themeToApply) {
      const defaultTheme = DEFAULT_THEME_OPTION;
      defaultTheme.mode = currentColorMode;
      return defaultTheme;
    }
    // if theme preference is auto, get current color mode and apply that
    if (preference.mode === PreferenceModes.AUTO) {
      themeToApply.mode = currentColorMode;
    }
    return themeToApply;
  }
}

/**
 * Consumer component for the ThemeSettingsContext.
 */
export const ThemeSettingsConsumer = ThemeSettingsContext.Consumer;

/**
 * Default export of the ThemeProvider component.
 */
export default ThemeProvider;
