import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { Request, Response } from "express";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const httpStatusCode = exception.getStatus();
    const httpMessage = exception.getResponse();

    response.status(httpStatusCode).json({
      path: request.url,
      statusCode: httpStatusCode,
      message: httpMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
