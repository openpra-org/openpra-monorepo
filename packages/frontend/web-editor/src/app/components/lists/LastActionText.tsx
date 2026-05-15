export interface LastActionTextProps {
  timestamp: number;
}
function LastActionText({ timestamp }: LastActionTextProps): JSX.Element {
  const date = new Date(timestamp);
  const datePart = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return <div>{`Updated ${datePart} at ${timePart}`}</div>;
}
export { LastActionText };
