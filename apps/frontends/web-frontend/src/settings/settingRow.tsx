import { JSX, ReactNode } from "react";

function SettingRow({
  label,
  description,
  control,
  stack,
  top,
}: {
  label: string;
  description?: ReactNode;
  control: ReactNode;
  stack?: boolean;
  top?: boolean;
}): JSX.Element {
  const classes = ["st__row"];
  if (stack) classes.push("st__row--stack");
  if (top) classes.push("st__row--top");
  return (
    <div className={classes.join(" ")}>
      <div className="st__row-body">
        <div className="st__row-label">{label}</div>
        {description !== undefined && <div className="st__row-desc">{description}</div>}
      </div>
      <div className="st__row-control">{control}</div>
    </div>
  );
}

export { SettingRow };
