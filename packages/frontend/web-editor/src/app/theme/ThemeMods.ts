import { EuiThemeModifications } from "@elastic/eui";

export const ThemeMods: EuiThemeModifications = {
  font: {
    family:
      'Cereal,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"',
    weight: {
      medium: 400,
      semiBold: 500,
      bold: 600,
    },
  },
  colors: {
    LIGHT: {
      primary: "#0079A5",
      text: "#000000",
    },
    DARK: {
      primary: "#0A3755",
      text: "#FFFFFF",
    },
  },
};

export type ColorModes = "LIGHT" | "DARK";
export const getColorsForMode = (colorMode: ColorModes) =>
  ThemeMods.colors ? ThemeMods.colors[colorMode] : undefined;
