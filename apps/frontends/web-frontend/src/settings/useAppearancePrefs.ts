import { useEffect, useState } from "react";

interface AppearancePrefs {
  reducedMotion: boolean;
  highContrast: boolean;
  sigFigs: number;
}

const STORAGE_KEY = "openpra.appearance";

const DEFAULT: AppearancePrefs = {
  reducedMotion: false,
  highContrast: false,
  sigFigs: 4,
};

function readStored(): AppearancePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
    return {
      reducedMotion: parsed.reducedMotion === true,
      highContrast: parsed.highContrast === true,
      sigFigs: typeof parsed.sigFigs === "number" && parsed.sigFigs >= 2 && parsed.sigFigs <= 8 ? parsed.sigFigs : DEFAULT.sigFigs,
    };
  } catch {
    return DEFAULT;
  }
}

function applyAppearance(prefs: AppearancePrefs): void {
  const root = document.documentElement;
  root.setAttribute("data-reduced-motion", prefs.reducedMotion ? "true" : "false");
  root.setAttribute("data-high-contrast", prefs.highContrast ? "true" : "false");
}

function useAppearancePrefs(): {
  prefs: AppearancePrefs;
  setReducedMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setSigFigs: (n: number) => void;
} {
  const [prefs, setPrefs] = useState<AppearancePrefs>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // storage unavailable — ignore
    }
    applyAppearance(prefs);
  }, [prefs]);

  return {
    prefs,
    setReducedMotion: (reducedMotion) => { setPrefs((p) => ({ ...p, reducedMotion })); },
    setHighContrast: (highContrast) => { setPrefs((p) => ({ ...p, highContrast })); },
    setSigFigs: (sigFigs) => { setPrefs((p) => ({ ...p, sigFigs })); },
  };
}

export { useAppearancePrefs, applyAppearance, readStored as loadStoredAppearance, DEFAULT as DEFAULT_APPEARANCE };
export type { AppearancePrefs };
