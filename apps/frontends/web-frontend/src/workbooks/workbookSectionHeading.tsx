import { type JSX, type ReactNode, useId, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { composeWorkbookCue, type WorkbookCueCode } from "./workbookCueContent";
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
  workbook,
  cueKey,
  level = 3,
  className = "poscard__title",
}: {
  title: ReactNode;
  description?: ReactNode;
  workbook?: WorkbookCueCode;
  cueKey?: string;
  level?: 1 | 2 | 3;
  className?: string;
}): JSX.Element {
  const resolvedTitle = cueKey ?? (typeof title === "string" ? title : "this section");
  const cue = workbook === undefined
    ? description
    : composeWorkbookCue(workbook, resolvedTitle, description);
  const heading = level === 1
    ? <h1 className={className}>{title}</h1>
    : level === 2
      ? <h2 className={className}>{title}</h2>
      : <h3 className={className}>{title}</h3>;

  return (
    <div className="workbook-section-heading">
      {heading}
      {cue !== undefined && <WorkbookHelpButton label={`About ${resolvedTitle}`}>{cue}</WorkbookHelpButton>}
    </div>
  );
}

function WorkbookCueLabel({
  title,
  workbook,
  cueKey,
  description,
  className,
}: {
  title: ReactNode;
  workbook: WorkbookCueCode;
  cueKey?: string;
  description?: ReactNode;
  className: string;
}): JSX.Element {
  const resolvedTitle = cueKey ?? (typeof title === "string" ? title : "this subsection");
  const cue = composeWorkbookCue(workbook, resolvedTitle, description);
  return (
    <div className={`${className} workbook-cue-label`}>
      <span>{title}</span>
      <WorkbookHelpButton label={`About ${resolvedTitle}`}>{cue}</WorkbookHelpButton>
    </div>
  );
}

export { WorkbookCueLabel, WorkbookHelpButton, WorkbookSectionHeading };
