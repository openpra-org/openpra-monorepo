import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "auto";

const THEME_KEY = "openpra.theme";

function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    return "auto";
  }
  return "auto";
}

function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable — ignore
    }
  }, [theme]);
  return [theme, setTheme];
}

export { useTheme };
export type { Theme };
