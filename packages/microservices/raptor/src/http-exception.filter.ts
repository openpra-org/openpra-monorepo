import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Use the @Catch decorator to bind this filter to HttpException.
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * Handles a caught HttpException and customizes the response sent to the client.
   *
   * Extracts necessary information from the exception and the request context to construct
   * a detailed and structured error response.
   *
   * @param exception - The caught HttpException instance.
   * @param host - The arguments host that provides access to the request and response objects.
   */
  catch(exception: HttpException, host: ArgumentsHost): void {
    // Switch to HTTP context to extract request and response objects.
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Extract status code and response message from the exception.
    const httpStatusCode = exception.getStatus();
    const httpMessage = exception.getResponse();

    // Send a custom JSON response including error details.
    response.status(httpStatusCode).json({
      path: request.url, // The URL path where the error occurred.
      statusCode: httpStatusCode, // The HTTP status code of the error.
      message: httpMessage, // The error message or response body.
    });
  }
}
