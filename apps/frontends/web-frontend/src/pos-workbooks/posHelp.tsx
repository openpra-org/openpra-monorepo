import { JSX, ReactNode, useId, useState } from "react";
import { POSIcon } from "./posIcons";
import { composeWorkbookCue } from "../workbooks/workbookCueContent";

function PosHelpButton({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  const popoverId = useId();

  return (
    <span className="poshelp">
      <span
        role="button"
        tabIndex={0}
        className="poshelp__button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setOpen((value) => !value);
        }}
      >
        <POSIcon.Help />
      </span>
      {open && <span className="poshelp__popover" id={popoverId} role="note">{children}</span>}
    </span>
  );
}

function PosSectionHeading({
  title,
  description,
  level = 3,
  className = "poscard__title",
  main = false,
}: {
  title: string;
  description: ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
  main?: boolean;
}): JSX.Element {
  const heading = level === 1
    ? <h1 className={className}>{title}</h1>
    : level === 2
      ? <h2 className={className}>{title}</h2>
      : <h3 className={className}>{title}</h3>;

  return (
    <div className={`possectionheading${main ? " possectionheading--main" : ""}`}>
      {heading}
      <PosHelpButton label={`About ${title}`}>{composeWorkbookCue("POS", title, description)}</PosHelpButton>
    </div>
  );
}

export { PosHelpButton, PosSectionHeading };
