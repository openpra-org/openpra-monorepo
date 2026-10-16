import { JSX, KeyboardEvent } from "react";
import { ArrowRightIcon } from "../welcome/icons";

interface ElementRowProps {
  code: string;
  name: string;
  onOpen: () => void;
}

function ElementRow({ code, name, onOpen }: ElementRowProps): JSX.Element {
  function handleKey(e: KeyboardEvent<HTMLElement>): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }
  return (
    <section
      className="erow"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}
    >
      <header className="erow__head">
        <span className="erow__code">{code}</span>
        <h3 className="erow__title" title={name}>{name}</h3>
      </header>
      <span className="erow__open">Open workbooks <ArrowRightIcon /></span>
    </section>
  );
}

export { ElementRow };
