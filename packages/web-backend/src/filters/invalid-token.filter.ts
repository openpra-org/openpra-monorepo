import { ArgumentsHost, Catch, ExceptionFilter, HttpException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class InvalidTokenFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();
        const errorStatus = exception.getStatus();
        const errorMessage = exception.getResponse();

        if(errorStatus === 401) {
            throw new UnauthorizedException('Token is invalid')
        } else {
            response.status(errorStatus)
                .json({
                    issue: errorMessage,
                    timestamp: new Date().toISOString(),
                    path: request.url
                })
        }
    }
}
