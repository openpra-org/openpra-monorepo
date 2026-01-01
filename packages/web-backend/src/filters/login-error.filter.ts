import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { Response } from "express";

/**
 * Formats login failures into a consistent JSON response shape.
 */
@Catch(HttpException)
export class LoginErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const errorStatus = exception.getStatus();
    const errorMessage = exception.getResponse();
    response.status(errorStatus).json({
      issue: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
