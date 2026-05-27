import { JSX, useMemo, useState } from "react";
import { type Project, elementsForMode } from "interfaces-shared-types";
import { ElementRow, elementVisualStatus } from "./elementRow";

type ElementFilter = "all" | "mine" | "in-progress" | "not-started";

const FILTERS: readonly { key: ElementFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "in-progress", label: "In progress" },
  { key: "not-started", label: "Not started" },
];

function ElementsSection({
  project,
  onOpenElement,
}: {
  project: Project;
  onOpenElement: (element: { code: string; name: string }) => void;
}): JSX.Element {
  const [filter, setFilter] = useState<ElementFilter>("all");
  const elements = useMemo(() => elementsForMode(project.mode), [project.mode]);

  const isOwner = project.myRole === "owner";
  const startedCount = elements.filter((e) => elementVisualStatus(project.status[e.code]) !== "not-started").length;
  const pct = Math.round(project.progress * 100);

  const visible = useMemo(() => {
    return elements.filter((e) => {
      const vstatus = elementVisualStatus(project.status[e.code]);
      if (filter === "all") return true;
      if (filter === "mine") return isOwner;
      if (filter === "in-progress") return vstatus !== "not-started";
      return vstatus === "not-started";
    });
  }, [elements, filter, project.status, isOwner]);

  return (
    <div className="psect">
      <div className="wfilters">
        <span className="wfilters__summary">
          {pct}% · {startedCount} of {elements.length} elements in progress
        </span>
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
      </div>

      <div className="erows erows--grid">
        {visible.map((el) => (
          <ElementRow
            key={el.code}
            code={el.code}
            name={el.name}
            status={project.status[el.code]}
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
