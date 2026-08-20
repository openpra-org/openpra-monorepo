import { JSX } from "react";
import { type Project } from "interfaces-shared-types";
import { ProjectCard, type ProjectCardProps } from "./projectCard";
import "./css/projectGrid.css";

type CardHandlers = Omit<ProjectCardProps, "project">;

function ProjectGrid({
  projects,
  cardHandlers,
}: {
  projects: Project[];
  cardHandlers: (project: Project) => CardHandlers;
}): JSX.Element {
  return (
    <div className="ap__grid">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} {...cardHandlers(p)} />
      ))}
    </div>
  );
}

export { ProjectGrid };
