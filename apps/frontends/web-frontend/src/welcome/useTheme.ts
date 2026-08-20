import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "auto";

const THEME_KEY = "openpra.theme";

function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "auto") return value;
  } catch {
    return "auto";
  }
  return "auto";
}

function applyTheme(theme: Theme, persist = true): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.backgroundColor = "#FFFFFF";
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor !== null) themeColor.content = "#FFFFFF";
  if (!persist) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
}

function initializeTheme(): Theme {
  const theme = readStoredTheme();
  applyTheme(theme, false);
  return theme;
}

function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return [theme, setTheme];
}

export { applyTheme, initializeTheme, readStoredTheme, useTheme };
export type { Theme };
