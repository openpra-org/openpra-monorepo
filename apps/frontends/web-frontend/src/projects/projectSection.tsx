import { JSX, ReactNode } from "react";
import "./css/projectSection.css";

function ProjectSection({
  title,
  count,
  icon,
  children,
}: {
  title: string | null;
  count: number;
  icon?: JSX.Element;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="ap__section">
      {title !== null && (
        <div className="ap__section-h">
          <h2 className="ap__section-title">
            {icon !== undefined && <span className="ap__section-icon">{icon}</span>}
            {title}
            <span className="ap__section-count">{count}</span>
          </h2>
        </div>
      )}
      {children}
    </section>
  );
}

export { ProjectSection };
