import { useEffect, useState } from "react";

type Engine = "scram" | "saphire" | "openpra";
type Approximation = "rare-event" | "mcub" | "exact";

interface WorkspaceDefaults {
  engine: Engine;
  approximation: Approximation;
  truncation: string;
}

const STORAGE_KEY = "openpra.workspaceDefaults";

const DEFAULT: WorkspaceDefaults = {
  engine: "scram",
  approximation: "rare-event",
  truncation: "1e-12",
};

const ENGINE_VALUES: Engine[] = ["scram", "saphire", "openpra"];
const APPROX_VALUES: Approximation[] = ["rare-event", "mcub", "exact"];

function isEngine(v: unknown): v is Engine {
  return typeof v === "string" && (ENGINE_VALUES as string[]).includes(v);
}

function isApprox(v: unknown): v is Approximation {
  return typeof v === "string" && (APPROX_VALUES as string[]).includes(v);
}

function readStored(): WorkspaceDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<WorkspaceDefaults>;
    return {
      engine: isEngine(parsed.engine) ? parsed.engine : DEFAULT.engine,
      approximation: isApprox(parsed.approximation) ? parsed.approximation : DEFAULT.approximation,
      truncation: typeof parsed.truncation === "string" && parsed.truncation.length > 0 ? parsed.truncation : DEFAULT.truncation,
    };
  } catch {
    return DEFAULT;
  }
}

function useWorkspaceDefaults(): {
  defaults: WorkspaceDefaults;
  setEngine: (e: Engine) => void;
  setApproximation: (a: Approximation) => void;
  setTruncation: (t: string) => void;
} {
  const [defaults, setDefaults] = useState<WorkspaceDefaults>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    } catch {
      // storage unavailable — ignore
    }
  }, [defaults]);

  return {
    defaults,
    setEngine: (engine) => { setDefaults((d) => ({ ...d, engine })); },
    setApproximation: (approximation) => { setDefaults((d) => ({ ...d, approximation })); },
    setTruncation: (truncation) => { setDefaults((d) => ({ ...d, truncation })); },
  };
}

export { useWorkspaceDefaults };
export type { WorkspaceDefaults, Engine, Approximation };
