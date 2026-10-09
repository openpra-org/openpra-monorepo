import { BadRequestException, ForbiddenException, Logger } from "@nestjs/common";

const logger = new Logger("StoredWorkbookFormat");

function olderFormatMessage(workbookId: string): string {
  return `This workbook was saved in an older format and could not be converted. Workbook ${workbookId}. The server log has the details.`;
}

function storedWorkbookRejection(element: string, workbookId: string, details: string): BadRequestException {
  logger.error(`Stored ${element} workbook ${workbookId} failed validation. ${details}`);
  return new BadRequestException(olderFormatMessage(workbookId));
}

function storedPriorRejection(element: string, workbookId: string, details: string): ForbiddenException {
  logger.error(`The prior contents of ${element} workbook ${workbookId} failed validation. ${details}`);
  return new ForbiddenException(olderFormatMessage(workbookId));
}

export { olderFormatMessage, storedPriorRejection, storedWorkbookRejection };
