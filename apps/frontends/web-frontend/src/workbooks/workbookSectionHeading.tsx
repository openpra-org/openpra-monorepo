import { type JSX, type ReactNode } from "react";
import "./css/workbookSectionHeading.css";

function WorkbookSectionHeading({
  title,
  level = 3,
  className = "poscard__title",
}: {
  title: ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
}): JSX.Element {
  const heading = level === 1
    ? <h1 className={className}>{title}</h1>
    : level === 2
      ? <h2 className={className}>{title}</h2>
      : <h3 className={className}>{title}</h3>;

  return <div className="workbook-section-heading">{heading}</div>;
}

export { WorkbookSectionHeading };
