import { JSX } from "react";
import "./css/slider.css";

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  suffix?: string;
}): JSX.Element {
  return (
    <div className="st__slider-wrap">
      <input
        type="range"
        className="st__slider"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => { onChange(Number(e.target.value)); }}
        aria-label={ariaLabel}
      />
      <span className="st__slider-readout">
        {value}
        {suffix !== undefined && <span className="st__slider-suffix">{suffix}</span>}
      </span>
    </div>
  );
}

export { Slider };
