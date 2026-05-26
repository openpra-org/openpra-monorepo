import { JSX } from "react";
import { type ToolDefinition } from "interfaces-shared-types";

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
  tools: ToolDefinition[];
  onOpenTool: (tool: ToolDefinition) => void;
}

function ElementRow({ code, name, status, tools, onOpenTool }: ElementRowProps): JSX.Element {
  const vstatus = elementVisualStatus(status);
  return (
    <section className={`erow erow--${vstatus}`}>
      <header className="erow__head">
        <span className="erow__code">{code}</span>
        <h3 className="erow__title" title={name}>{name}</h3>
      </header>
      <div className="erow__track" aria-hidden="true">
        <div className={`erow__track-fill erow__track-fill--${vstatus}`} style={{ width: trackWidth(vstatus) }} />
      </div>
      {tools.length > 0 ? (
        <ul className="erow__tools">
          {tools.map((tool) => (
            <li key={tool.id}>
              <button type="button" className="tool-link" onClick={() => { onOpenTool(tool); }}>
                {tool.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="erow__empty-tools">No tools yet</p>
      )}
    </section>
  );
}

export { ElementRow, elementVisualStatus };
export type { ElementVisualStatus };
