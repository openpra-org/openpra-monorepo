import { getWorkbookRoles } from "./workbookReviewApi";
import { getWorkbookShares } from "./workbookSharingApi";

const NO_WORKBOOK_ROLE_MESSAGE = "You do not have any role on this workbook yet. Ask the workbook owner to assign you a preparer, reviewer, or approver role.";

async function canOpenWorkbook(workbookId: string): Promise<boolean> {
  const [roles, shares] = await Promise.all([getWorkbookRoles(workbookId), getWorkbookShares(workbookId)]);
  return roles.myRoles.length > 0 || shares.myAccess !== null;
}

export { NO_WORKBOOK_ROLE_MESSAGE, canOpenWorkbook };
