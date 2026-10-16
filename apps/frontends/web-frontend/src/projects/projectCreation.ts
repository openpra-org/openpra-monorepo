import { z } from "zod";

const CreationNoticeSchema = z.object({
  workbookName: z.string(),
  failed: z.array(z.string()),
  unlinked: z.array(z.string()),
});

type CreationNotice = z.infer<typeof CreationNoticeSchema>;

function listText(codes: readonly string[]): string {
  const last = codes[codes.length - 1];
  return codes.length < 2 ? codes.join("") : `${codes.slice(0, -1).join(", ")} and ${String(last)}`;
}

function creationNoticeText(notice: CreationNotice): string | undefined {
  const parts = [
    ...(notice.failed.length === 0 ? [] : [`The "${notice.workbookName}" workbook could not be created in ${listText(notice.failed)}.`]),
    ...(notice.unlinked.length === 0 ? [] : [`The "${notice.workbookName}" workbook in ${listText(notice.unlinked)} could not be linked to the others.`]),
  ];
  return parts.length === 0 ? undefined : parts.join(" ");
}

export { CreationNoticeSchema, creationNoticeText, type CreationNotice };
