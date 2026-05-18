import { useEffect, useState } from "react";

type Density = "comfortable" | "compact";

interface AppearancePrefs {
  density: Density;
  fontSize: number;
  reducedMotion: boolean;
  highContrast: boolean;
  sigFigs: number;
}

const STORAGE_KEY = "openpra.appearance";

const DEFAULT: AppearancePrefs = {
  density: "comfortable",
  fontSize: 15,
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
      density: parsed.density === "compact" ? "compact" : "comfortable",
      fontSize: typeof parsed.fontSize === "number" && parsed.fontSize >= 12 && parsed.fontSize <= 20 ? parsed.fontSize : DEFAULT.fontSize,
      reducedMotion: parsed.reducedMotion === true,
      highContrast: parsed.highContrast === true,
      sigFigs: typeof parsed.sigFigs === "number" && parsed.sigFigs >= 2 && parsed.sigFigs <= 8 ? parsed.sigFigs : DEFAULT.sigFigs,
    };
  } catch {
    return DEFAULT;
  }
}

function useAppearancePrefs(): {
  prefs: AppearancePrefs;
  setDensity: (d: Density) => void;
  setFontSize: (n: number) => void;
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
  }, [prefs]);

  return {
    prefs,
    setDensity: (density) => { setPrefs((p) => ({ ...p, density })); },
    setFontSize: (fontSize) => { setPrefs((p) => ({ ...p, fontSize })); },
    setReducedMotion: (reducedMotion) => { setPrefs((p) => ({ ...p, reducedMotion })); },
    setHighContrast: (highContrast) => { setPrefs((p) => ({ ...p, highContrast })); },
    setSigFigs: (sigFigs) => { setPrefs((p) => ({ ...p, sigFigs })); },
  };
}

export { useAppearancePrefs, DEFAULT as DEFAULT_APPEARANCE };
export type { AppearancePrefs, Density };
