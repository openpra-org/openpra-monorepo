import { JSX } from "react";
import { ArrowRightIcon, PlusIcon } from "./icons";
import "./css/newProjectCard.css";

function NewProjectCard({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="newproj" onClick={onClick} aria-label="Create new project">
      <div className="newproj__head">
        <div className="newproj__icon"><PlusIcon /></div>
        <h2 className="newproj__title">Start a new project</h2>
      </div>
      <p className="newproj__sub">
        Name the project and its workbooks. OpenPRA creates one workbook for each technical element and links them to each other. The elements follow the ASME/ANS RA-S-1.4-2021 voluntary consensus standard, as endorsed with exceptions by Regulatory Guide (RG) 1.247.
      </p>
      <span className="newproj__cta">
        New project <ArrowRightIcon />
      </span>
    </button>
  );
}

export { NewProjectCard };
