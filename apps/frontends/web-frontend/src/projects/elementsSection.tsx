import { JSX, useMemo, useState } from "react";
import { type Project, elementsForMode } from "interfaces-shared-types";
import { ElementRow } from "./elementRow";

type ElementFilter = "all" | "mine";

const FILTERS: readonly { key: ElementFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
];

function ElementsSection({
  project,
  onOpenElement,
  onGenerateExamples,
}: {
  project: Project;
  onOpenElement: (element: { code: string; name: string }) => void;
  onGenerateExamples?: () => void;
}): JSX.Element {
  const [filter, setFilter] = useState<ElementFilter>("all");
  const elements = useMemo(() => elementsForMode(project.mode), [project.mode]);

  const isOwner = project.myRole === "owner";

  const visible = useMemo(() => elements.filter(() => filter === "all" || isOwner), [elements, filter, isOwner]);

  return (
    <div className="psect">
      <div className="wfilters">
        <div className="wfilters__chips" role="tablist" aria-label="Filter technical elements">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`fchip${filter === f.key ? " fchip--active" : ""}`}
              onClick={() => { setFilter(f.key); }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {onGenerateExamples !== undefined && (
          <button type="button" className="wfilters__gen" onClick={onGenerateExamples}>Generate example</button>
        )}
      </div>

      <div className="erows erows--grid">
        {visible.map((el) => (
          <ElementRow
            key={el.code}
            code={el.code}
            name={el.name}
            onOpen={() => { onOpenElement({ code: el.code, name: el.name }); }}
          />
        ))}
        {visible.length === 0 && (
          <div className="erows__empty">
            <p>No elements match this filter.</p>
            <button type="button" className="btn btn--link" onClick={() => { setFilter("all"); }}>Show all elements</button>
          </div>
        )}
      </div>
    </div>
  );
}

export { ElementsSection };
