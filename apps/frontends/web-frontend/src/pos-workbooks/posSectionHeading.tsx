import { JSX } from "react";

function PosSectionHeading({
  title,
  level = 3,
  className = "poscard__title",
  main = false,
}: {
  title: string;
  level?: 1 | 2 | 3;
  className?: string;
  main?: boolean;
}): JSX.Element {
  const heading = level === 1
    ? <h1 className={className}>{title}</h1>
    : level === 2
      ? <h2 className={className}>{title}</h2>
      : <h3 className={className}>{title}</h3>;

  return <div className={`possectionheading${main ? " possectionheading--main" : ""}`}>{heading}</div>;
}

export { PosSectionHeading };
