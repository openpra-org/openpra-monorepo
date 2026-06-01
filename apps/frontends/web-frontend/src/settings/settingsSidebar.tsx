import { JSX } from "react";
import { BellIcon, DatabaseIcon, EditIcon, KeyboardIcon, PaletteIcon, ShieldIcon } from "../welcome/icons";
import "./css/settingsSidebar.css";

interface NavItem {
  id: string;
  label: string;
  icon: JSX.Element;
  danger?: boolean;
}

const ITEMS: NavItem[] = [
  { id: "account", label: "Account & security", icon: <ShieldIcon /> },
  { id: "notifications", label: "Notifications", icon: <BellIcon /> },
  { id: "appearance", label: "Appearance", icon: <PaletteIcon /> },
  { id: "signature", label: "Signature", icon: <EditIcon /> },
  { id: "shortcuts", label: "Shortcuts", icon: <KeyboardIcon /> },
  { id: "data", label: "Data & privacy", icon: <DatabaseIcon />, danger: true },
];

function SettingsSidebar({
  activeId,
  onJump,
}: {
  activeId: string;
  onJump: (id: string) => void;
}): JSX.Element {
  return (
    <nav className="st__nav" aria-label="Settings sections">
      {ITEMS.map((item) => {
        const isActive = activeId === item.id;
        const classes = ["st__nav-link"];
        if (isActive) classes.push("st__nav-link--active");
        if (item.danger) classes.push("st__nav-link--danger");
        return (
          <button
            key={item.id}
            type="button"
            className={classes.join(" ")}
            onClick={() => { onJump(item.id); }}
            aria-current={isActive ? "true" : undefined}
          >
            {item.icon} {item.label}
          </button>
        );
      })}
    </nav>
  );
}

export { SettingsSidebar, ITEMS as SETTINGS_NAV_ITEMS };
