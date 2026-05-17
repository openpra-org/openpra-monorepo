import { JSX, useEffect, useRef, useState } from "react";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "./icons";
import type { Theme } from "./useTheme";
import "./css/themePicker.css";

interface ThemeOption {
  id: Theme;
  label: string;
  Icon: () => JSX.Element;
}

const OPTIONS: ThemeOption[] = [
  { id: "light", label: "Light", Icon: SunIcon },
  { id: "dark", label: "Dark", Icon: MoonIcon },
  { id: "auto", label: "System", Icon: MonitorIcon },
];

function ThemePicker({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("mousedown", onClick); };
  }, [open]);

  const active = OPTIONS.find((o) => o.id === theme) ?? OPTIONS[2];
  const ActiveIcon = active.Icon;

  return (
    <div className="wp__theme" ref={wrapRef}>
      <button
        type="button"
        className="wp__theme-btn"
        aria-label={`Theme: ${active.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); }}
      >
        <ActiveIcon />
      </button>
      {open && (
        <div className="wp__theme-pop" role="menu">
          {OPTIONS.map((o) => {
            const OptIcon = o.Icon;
            const isActive = o.id === theme;
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={`wp__theme-opt${isActive ? " wp__theme-opt--active" : ""}`}
                onClick={() => { setTheme(o.id); setOpen(false); }}
              >
                <OptIcon /> {o.label}
                {isActive && <span className="wp__theme-check"><CheckIcon /></span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { ThemePicker };
