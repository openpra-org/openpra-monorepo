import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

// hardcoded — demo identities standing in for the auth system on the POS demo
// route. In production, persona is derived from the signed-in user's roles on
// the workbook, not from a switcher.

type DemoPersona = "preparer" | "reviewer" | "approver";

interface DemoIdentity {
  id: string;
  name: string;
  initials: string;
  title: string;
  persona: DemoPersona;
  organization: string;
}

const DEMO_IDENTITIES: DemoIdentity[] = [
  {
    id: "demo-aakash",
    name: "Aakash Patel",
    initials: "AP",
    title: "Risk engineer · workbook author",
    persona: "preparer",
    organization: "Generic Nuclear LLC",
  },
  {
    id: "demo-nadia",
    name: "Dr. Nadia Hartwell",
    initials: "NH",
    title: "Lead technical reviewer",
    persona: "reviewer",
    organization: "Generic Nuclear LLC",
  },
  {
    id: "demo-jiwon",
    name: "Dr. Ji-won Chen",
    initials: "JC",
    title: "Director, Risk Engineering",
    persona: "approver",
    organization: "Generic Nuclear LLC",
  },
];

const STORAGE_KEY = "openpra-demo-identity";

interface DemoIdentityContextValue {
  current: DemoIdentity;
  identities: DemoIdentity[];
  setCurrent: (id: string) => void;
}

const DemoIdentityContext = createContext<DemoIdentityContextValue | null>(null);

function loadInitial(): DemoIdentity {
  if (typeof window === "undefined") return DEMO_IDENTITIES[0];
  const stored = window.localStorage.getItem(STORAGE_KEY);
  const match = DEMO_IDENTITIES.find((d) => d.id === stored);
  return match ?? DEMO_IDENTITIES[0];
}

function DemoIdentityProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [current, setCurrentState] = useState<DemoIdentity>(loadInitial);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, current.id);
  }, [current]);

  const setCurrent = useCallback((id: string): void => {
    const match = DEMO_IDENTITIES.find((d) => d.id === id);
    if (match !== undefined) setCurrentState(match);
  }, []);

  return (
    <DemoIdentityContext.Provider value={{ current, identities: DEMO_IDENTITIES, setCurrent }}>
      {children}
    </DemoIdentityContext.Provider>
  );
}

function useDemoIdentity(): DemoIdentityContextValue {
  const ctx = useContext(DemoIdentityContext);
  if (ctx === null) throw new Error("useDemoIdentity must be used inside DemoIdentityProvider");
  return ctx;
}

export { DemoIdentityProvider, useDemoIdentity, type DemoIdentity, type DemoPersona };
