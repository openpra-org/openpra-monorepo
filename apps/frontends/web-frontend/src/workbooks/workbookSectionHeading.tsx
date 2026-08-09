import { type JSX, type ReactNode, useId, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import "./css/workbookSectionHeading.css";

function WorkbookHelpButton({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  const popoverId = useId();

  return (
    <span className="workbook-help">
      <span
        role="button"
        tabIndex={0}
        className="workbook-help__button"
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
      {open && <span className="workbook-help__popover" id={popoverId} role="note">{children}</span>}
    </span>
  );
}

function WorkbookSectionHeading({
  title,
  description,
  level = 3,
  className = "poscard__title",
}: {
  title: string;
  description: ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
}): JSX.Element {
  const heading = level === 1
    ? <h1 className={className}>{title}</h1>
    : level === 2
      ? <h2 className={className}>{title}</h2>
      : <h3 className={className}>{title}</h3>;

  return (
    <div className="workbook-section-heading">
      {heading}
      <WorkbookHelpButton label={`About ${title}`}>{description}</WorkbookHelpButton>
    </div>
  );
}

export { WorkbookHelpButton, WorkbookSectionHeading };
