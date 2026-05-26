import { JSX } from "react";
import { type Workbook, type WorkbookStatus } from "interfaces-shared-types";
import { ArrowRightIcon, BookIcon } from "../welcome/icons";
import { formatRelative } from "../welcome/formatRelative";

const STATUS_LABELS: Record<WorkbookStatus, string> = {
  complete: "Complete",
  "in-progress": "In progress",
  draft: "Draft",
};

function WorkbookRow({ workbook, onOpen }: { workbook: Workbook; onOpen: (workbook: Workbook) => void }): JSX.Element {
  return (
    <button type="button" className={`wbrow wbrow--${workbook.status}`} onClick={() => { onOpen(workbook); }}>
      <span className="wbrow__icon"><BookIcon /></span>
      <span className="wbrow__main">
        <span className="wbrow__name">{workbook.name}</span>
        <span className="wbrow__meta">
          <span className="wbrow__owner" title={workbook.ownerFullName}>
            <span className="wbrow__avatar" aria-hidden="true">{workbook.ownerInitials}</span>
            {workbook.ownerFullName}
          </span>
          <span className="wbrow__sep">·</span>
          <span>v{workbook.version}</span>
          <span className="wbrow__sep">·</span>
          <span>Edited {formatRelative(workbook.updatedAt)}</span>
        </span>
      </span>
      <span className={`wbrow__status wbrow__status--${workbook.status}`}>{STATUS_LABELS[workbook.status]}</span>
      <span className="wbrow__chev" aria-hidden="true"><ArrowRightIcon /></span>
    </button>
  );
}

export { WorkbookRow };
