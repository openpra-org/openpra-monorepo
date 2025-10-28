import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Thrown when a user registration or update would create a duplicate username.
 *
 * This exception maps to HTTP 400 Bad Request.
 */
export class DuplicateUserException extends HttpException {
  constructor() {
    super("Duplicate Username", HttpStatus.BAD_REQUEST);
  }
}
