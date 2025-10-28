import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { Response } from "express";

/**
 * Formats 401/invalid token errors into a consistent JSON response shape.
 */
@Catch(HttpException)
export class InvalidTokenFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const errorStatus = exception.getStatus();
    const errorMessage = exception.getResponse();

    if (errorStatus === 401) {
      response.status(errorStatus).json({
        issue: { message: "invalid token" },
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    } else {
      response.status(errorStatus).json({
        issue: errorMessage,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }
}
