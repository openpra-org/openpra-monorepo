import { usePrettyDuration } from "@elastic/eui";
import { ToTitleCase } from "../../../utils/StringUtils";

export interface LastActionTextProps {
  timestamp: number;
  action: "created" | "updated" | "viewed";
}

// TODO
function LastActionText({ timestamp, action }: LastActionTextProps): JSX.Element {
  let text = usePrettyDuration({
    timeFrom: "now-3w",
    timeTo: "now",
    dateFormat: "MMMM Do YYYY @ HH:mm:ss.SS",
  });

  text = `${ToTitleCase(action)} within the ${text.toLowerCase()}`;
  return <div>{text}</div>;
}
export { LastActionText };
