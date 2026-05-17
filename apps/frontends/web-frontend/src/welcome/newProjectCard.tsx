import { JSX } from "react";
import { ArrowRightIcon, PlusIcon } from "./icons";
import "./css/newProjectCard.css";

function NewProjectCard({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="newproj" onClick={onClick} aria-label="Create new project">
      <div>
        <div className="newproj__icon"><PlusIcon /></div>
        <h2 className="newproj__title">Start a new project</h2>
        <p className="newproj__sub">
          Choose a risk mode and OpenPRA scaffolds the technical elements from the ASME-ANS-RA-S-1.4 standard.
        </p>
      </div>
      <span className="newproj__cta">
        New project <ArrowRightIcon />
      </span>
    </button>
  );
}

export { NewProjectCard };
