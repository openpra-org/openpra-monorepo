import { SC_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sc-seed";
import { SC_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sc-seed-htgr";
import type { ScMissionTimeSource } from "../../sy-workbooks/syLinks";
import { setDaMissionTimes } from "../daLaws";
import { scSequenceFamilies } from "../daWorkbookContext";

const SC_EXAMPLES: ScMissionTimeSource[] = [
  { workbookId: "example-sc-sfr", sc: SC_ANALYSIS },
  { workbookId: "example-sc-htgr", sc: SC_ANALYSIS_HTGR },
];

function linkScExamples(): void {
  setDaMissionTimes({ sources: SC_EXAMPLES, families: new Map([...scSequenceFamilies(SC_ANALYSIS), ...scSequenceFamilies(SC_ANALYSIS_HTGR)]) });
}

export { SC_EXAMPLES, linkScExamples };
