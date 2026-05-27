import { JSX, KeyboardEvent } from "react";
import { ArrowRightIcon } from "../welcome/icons";

type ElementVisualStatus = "complete" | "in-progress" | "not-started";

function elementVisualStatus(status: string | undefined): ElementVisualStatus {
  if (status === "baseline") return "complete";
  if (status === "in-progress") return "in-progress";
  return "not-started";
}

function trackWidth(status: ElementVisualStatus): string {
  if (status === "complete") return "100%";
  if (status === "in-progress") return "50%";
  return "0%";
}

interface ElementRowProps {
  code: string;
  name: string;
  status: string | undefined;
  onOpen: () => void;
}

function ElementRow({ code, name, status, onOpen }: ElementRowProps): JSX.Element {
  const vstatus = elementVisualStatus(status);
  function handleKey(e: KeyboardEvent<HTMLElement>): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }
  return (
    <section
      className={`erow erow--${vstatus}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}
    >
      <header className="erow__head">
        <span className="erow__code">{code}</span>
        <h3 className="erow__title" title={name}>{name}</h3>
      </header>
      <div className="erow__track" aria-hidden="true">
        <div className={`erow__track-fill erow__track-fill--${vstatus}`} style={{ width: trackWidth(vstatus) }} />
      </div>
      <span className="erow__open">Open workbooks <ArrowRightIcon /></span>
    </section>
  );
}

export { ElementRow, elementVisualStatus };
export type { ElementVisualStatus };
