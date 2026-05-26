import { JSX } from "react";
import { type PageLayout } from "interfaces-shared-types";
import { CheckIcon } from "../welcome/icons";
import "./css/layoutPicker.css";

interface LayoutOption {
  value: PageLayout;
  title: string;
  tag: string;
  preview: JSX.Element;
}

function ModernPreview(): JSX.Element {
  return (
    <svg className="layout-card__wire" viewBox="0 0 200 120" role="img" aria-hidden="true">
      <rect className="layout-card__wire-bar" x="0" y="0" width="200" height="16" />
      <rect className="layout-card__wire-h" x="12" y="26" width="70" height="6" rx="3" />
      {[0, 1, 2].map((col) =>
        [0, 1, 2].map((row) => (
          <rect
            key={`${col}-${row}`}
            className="layout-card__wire-card"
            x={12 + col * 60}
            y={44 + row * 24}
            width="50"
            height="18"
            rx="3"
          />
        )),
      )}
      <rect className="layout-card__wire-modal" x="48" y="40" width="104" height="64" rx="6" />
      <rect className="layout-card__wire-modal-h" x="58" y="50" width="48" height="5" rx="2.5" />
      {[0, 1, 2].map((i) => (
        <rect key={i} className="layout-card__wire-row" x="58" y={62 + i * 12} width="84" height="8" rx="2" />
      ))}
    </svg>
  );
}

function LegacyPreview(): JSX.Element {
  return (
    <svg className="layout-card__wire" viewBox="0 0 200 120" role="img" aria-hidden="true">
      <rect className="layout-card__wire-bar" x="0" y="0" width="200" height="16" />
      <rect className="layout-card__wire-rail" x="0" y="16" width="62" height="104" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          className={i === 2 ? "layout-card__wire-rail-active" : "layout-card__wire-nav"}
          x="8"
          y={26 + i * 15}
          width="46"
          height="9"
          rx="2"
        />
      ))}
      <rect className="layout-card__wire-h" x="74" y="28" width="64" height="6" rx="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} className="layout-card__wire-row" x="74" y={44 + i * 14} width="114" height="9" rx="2" />
      ))}
    </svg>
  );
}

const LAYOUT_OPTIONS: readonly LayoutOption[] = [
  {
    value: "modern",
    title: "Modern",
    tag: "Recommended",
    preview: <ModernPreview />,
  },
  {
    value: "legacy",
    title: "Legacy",
    tag: "Familiar",
    preview: <LegacyPreview />,
  },
];

function LayoutPicker({
  value,
  onChange,
}: {
  value: PageLayout;
  onChange: (next: PageLayout) => void;
}): JSX.Element {
  return (
    <div className="layout-picker" role="radiogroup" aria-label="Workspace layout">
      {LAYOUT_OPTIONS.map((opt) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={`layout-card${checked ? " layout-card--checked" : ""}`}
            htmlFor={`layout-${opt.value}`}
          >
            <input
              id={`layout-${opt.value}`}
              className="layout-card__radio-input"
              type="radio"
              name="page-layout"
              value={opt.value}
              checked={checked}
              onChange={() => { onChange(opt.value); }}
            />
            <span className="layout-card__preview">{opt.preview}</span>
            <span className="layout-card__body">
              <span className="layout-card__head">
                <span className="layout-card__title">{opt.title}</span>
                <span className="layout-card__tag">{opt.tag}</span>
              </span>
            </span>
            <span className="layout-card__tick" aria-hidden="true">
              <CheckIcon />
            </span>
          </label>
        );
      })}
    </div>
  );
}

export { LayoutPicker };
