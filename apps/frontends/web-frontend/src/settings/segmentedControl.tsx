import { JSX, ReactNode } from "react";
import "./css/segmentedControl.css";

interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <div className="st__seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`st__seg-btn${active ? " st__seg-btn--active" : ""}`}
            onClick={() => { onChange(opt.id); }}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };
export type { SegmentedOption };
