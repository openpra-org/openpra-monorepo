import React, { ReactElement, useEffect, useState } from "react";
import { EuiProvider, EuiThemeModifications } from "@elastic/eui";
import { EuiProviderProps } from "@elastic/eui/src/components/provider/provider";
import { EuiThemeColorMode } from "@elastic/eui/src/services/theme/types";

/** {@link https://eui.elastic.co/#/utilities/provider#euiprovider-props} **/
export interface ThemeProviderProps extends EuiProviderProps<unknown> {
  children: ReactElement;
}

export const ThemeMods: EuiThemeModifications = {
  font: {
    family: "SF Pro Text,system-ui,-apple-system,BlinkMacSystemFont,Helvetica Neue,Helvetica,Arial,sans-serif",
    // weight: {
    //   light: 600,
    //   regular: 600,
    //   medium: 600,
    //   semiBold: 500,
    //   bold: 600,
    // },
  },
};

export enum MediaQueryListEventColorSchemeKey {
  DARK = "dark",
  LIGHT = "light",
  NO_PREFERENCE = "no-preference",
}
export type MediaQueryListEventColorScheme =
  | MediaQueryListEventColorSchemeKey.DARK
  | MediaQueryListEventColorSchemeKey.LIGHT
  | MediaQueryListEventColorSchemeKey.NO_PREFERENCE
  | EuiThemeColorMode;

const detectColorScheme = (window: Window): EuiThemeColorMode => {
  try {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return MediaQueryListEventColorSchemeKey.DARK;
    }
    return MediaQueryListEventColorSchemeKey.LIGHT;
  } catch (e) {
    return MediaQueryListEventColorSchemeKey.LIGHT;
  }
};

export const ThemeProvider = (props: ThemeProviderProps): ReactElement => {
  const { children, ...others } = props;
  const [colorMode, setColorMode] = useState<EuiThemeColorMode>(MediaQueryListEventColorSchemeKey.DARK);

  useEffect(() => {
    console.log("gonna set the color mode now");
    setColorMode(detectColorScheme(window));
    console.log("...done");
  }, []);

  // useEffect(() => {
  //   const handleColorChange = (e: MediaQueryListEvent): void => {
  //     console.log(e, `New color scheme: ${e.matches ? "dark" : "light"}`);
  //     setColorMode(e.matches ? MediaQueryListEventColorSchemeKey.DARK : MediaQueryListEventColorSchemeKey.LIGHT);
  //   };
  //
  //   /**
  //    * Creates a listener for changes in the user's preferred color scheme.
  //    * @param callback - The function to call when the color scheme changes.
  //    */
  //   const createColorSchemeListener = (callback: (e: MediaQueryListEvent) => void): void => {
  //     const matcher = window.matchMedia("(prefers-color-scheme: dark)");
  //     matcher.addEventListener("change", callback);
  //     console.log("added event listener");
  //   };
  //
  //   setColorMode(detectColorScheme(window));
  //   createColorSchemeListener(handleColorChange);
  //
  //   return (): void => {
  //     // Cleanup listener when component unmounts
  //     window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", handleColorChange);
  //     console.log("removed event listener");
  //   };
  // }, []);

  return (
    <EuiProvider
      {...others}
      modify={ThemeMods}
      colorMode={colorMode}
    >
      {children}
    </EuiProvider>
  );
};
