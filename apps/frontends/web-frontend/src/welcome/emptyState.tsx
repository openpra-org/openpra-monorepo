import { JSX } from "react";
import { PlusIcon } from "./icons";
import "./css/emptyState.css";

function EmptyState({ onCreate }: { onCreate: () => void }): JSX.Element {
  return (
    <div className="empty">
      <div className="empty__art"><PlusIcon /></div>
      <h2 className="empty__title">No projects yet</h2>
      <p className="empty__sub">
        Create your first analysis to get started. Name the project and its workbooks. OpenPRA creates one
        workbook for each technical element and links them to each other. The elements follow the ASME/ANS
        RA-S-1.4-2021 voluntary consensus standard, as endorsed with exceptions by Regulatory Guide (RG) 1.247.
      </p>
      <button type="button" className="btn btn--primary btn--lg" onClick={onCreate}>
        <PlusIcon /> Create your first project
      </button>
    </div>
  );
}

export { EmptyState };
