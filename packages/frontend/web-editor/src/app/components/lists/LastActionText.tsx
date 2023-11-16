import { usePrettyDuration } from "@elastic/eui";
import { toTitleCase } from "../../../utils/StringUtils";

export type LastActionTextProps = {
  timestamp: number,
  action: "created" | "updated" | "viewed",
}

// TODO
export default function LastActionText({ timestamp, action }: LastActionTextProps) {

  let text = usePrettyDuration({
    timeFrom: 'now-3w',
    timeTo: 'now',
    dateFormat: 'MMMM Do YYYY @ HH:mm:ss.SS',
  });

  text = `${toTitleCase(action)} within the ${text.toLowerCase()}`;
  return (
    <>
      {text}
    </>
  );
}
