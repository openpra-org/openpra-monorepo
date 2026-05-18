import { JSX } from "react";
import "./css/toggle.css";

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled === true}
      className={`st__toggle${checked ? " st__toggle--on" : ""}`}
      onClick={() => { onChange(!checked); }}
    >
      <span className="st__toggle-thumb" />
    </button>
  );
}

export { Toggle };
