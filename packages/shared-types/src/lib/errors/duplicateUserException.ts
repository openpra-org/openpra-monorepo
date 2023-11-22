import { HttpException, HttpStatus } from "@nestjs/common";

export class DuplicateUserException extends HttpException {
  constructor() {
    super("Duplicate Username", HttpStatus.BAD_REQUEST);
  }
}
